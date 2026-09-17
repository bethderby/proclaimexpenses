import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  createWiseBatchGroup,
  addWiseBatchTransfer,
  completeWiseBatchGroup,
  createWiseQuote,
  createWiseRecipient,
  getWiseBatchGroup,
  getWiseTransfer,
  getWiseTransferRequirements,
  getWiseTransferDetails,
  validateWiseReference,
  isWiseConfigured,
} from '@/lib/wise';
import { decryptBankDetail } from '@/lib/bank';
import { deterministicWiseTransactionId } from '@/lib/wise-sync';
import {
  dedupeExpenseIds,
  wouldExceedWiseBatchLimit,
  parseWiseRecipientId,
} from '@/lib/payment-workflow';

/**
 * These functions all touch the single shared "open Wise batch" and must
 * never run concurrently with each other - two simultaneous approvals could
 * otherwise both decide to create a new batch, or both add the same expense
 * twice. A single-row lock (`WiseBatchLock`) plus a short lease serialises
 * every caller; `acquireWiseBatchLease` fails fast rather than queuing, so a
 * user just gets a "try again" message instead of a long hang.
 */
export async function acquireWiseBatchLease() {
  const token = crypto.randomUUID();
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + 10 * 60 * 1000);
  const result = await prisma.$executeRaw`
    UPDATE "WiseBatchLock"
    SET "lockToken" = ${token}, "lockedUntil" = ${lockedUntil}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = 'default'
      AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now})
  `;
  if (result !== 1) {
    throw new Error('Another Wise batch update is in progress. Please try again in a few seconds.');
  }
  return token;
}

export async function releaseWiseBatchLease(token: string) {
  await prisma.$executeRaw`
    UPDATE "WiseBatchLock"
    SET "lockToken" = NULL, "lockedUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = 'default' AND "lockToken" = ${token}
  `;
}

export async function markClosedWiseRun(runId: string, status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED') {
    await prisma.paymentRun.update({
      where: { id: runId },
      data: { status: 'WISE_PREPARED', wiseStatus: normalized, exportedAt: new Date() },
    });
  } else if (normalized === 'CANCELLED') {
    await prisma.paymentRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED', wiseStatus: normalized, preparationKey: null },
    });
  }
}

export async function findOrCreateOpenWiseRun(userId: string) {
  let run = await prisma.paymentRun.findFirst({
    where: { status: 'WISE_OPEN', wiseBatchGroupId: { not: null } },
    orderBy: { createdAt: 'asc' },
  });

  if (run?.wiseBatchGroupId) {
    const batch = await getWiseBatchGroup(run.wiseBatchGroupId);
    const batchStatus = String(batch.status || 'UNKNOWN').toUpperCase();

    if (batchStatus === 'NEW') {
      return run;
    }

    if (batchStatus === 'COMPLETED' || batchStatus === 'CANCELLED') {
      await markClosedWiseRun(run.id, batchStatus);
      run = null;
    } else {
      throw new Error(`The current Wise batch is ${batchStatus.toLowerCase()} and cannot accept new payments. Sync it before continuing.`);
    }
  }

  const reference = `PRO${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  validateWiseReference(reference);

  // Create the local run first. The batch lease plus the partial unique index
  // make this the single owner of the current open-batch slot.
  const draft = await prisma.paymentRun.create({
    data: {
      reference,
      status: 'DRAFT',
      totalAmount: 0,
      createdById: userId,
    },
  });

  try {
    const batch = await createWiseBatchGroup(`Proclaim Expenses ${reference}`);
    return prisma.paymentRun.update({
      where: { id: draft.id },
      data: {
        wiseBatchGroupId: String(batch.id),
        wiseStatus: String(batch.status || 'NEW'),
        status: 'WISE_OPEN',
      },
    });
  } catch (error) {
    await prisma.paymentRun.update({
      where: { id: draft.id },
      data: { status: 'CANCELLED', wiseStatus: 'batch_creation_failed', preparationKey: null },
    });
    throw error;
  }
}

export async function findExistingWiseTransferInBatch(batchId: string, customerTransactionId: string) {
  const batch = await getWiseBatchGroup(batchId);
  const transferIds = Array.isArray(batch.transferIds) ? batch.transferIds.map((id: unknown) => String(id)) : [];
  for (const transferId of transferIds) {
    const transfer = await getWiseTransfer(transferId);
    if (String(transfer.customerTransactionId || '') === customerTransactionId) return transfer;
  }
  return null;
}

export async function addExpensesToOpenWiseBatch(expenseIds: string[], userId: string) {
  const leaseToken = await acquireWiseBatchLease();
  try {
    const uniqueExpenseIds = dedupeExpenseIds(expenseIds);
    if (!uniqueExpenseIds.length) return null;

    const run = await findOrCreateOpenWiseRun(userId);
    if (!run.wiseBatchGroupId) throw new Error('The open Wise batch does not have a Wise batch ID.');

    const batchBefore = await getWiseBatchGroup(run.wiseBatchGroupId);
    const existingTransferCount = Array.isArray(batchBefore.transferIds) ? batchBefore.transferIds.length : 0;
    if (wouldExceedWiseBatchLimit(existingTransferCount, uniqueExpenseIds.length)) {
      throw new Error('The current Wise batch has reached Wise\'s 1,000-transfer limit. Close this batch and start a new one.');
    }

    const expenses = await prisma.expense.findMany({
      where: { id: { in: uniqueExpenseIds }, paymentStatus: 'READY', paymentRunId: null },
      include: { user: true, team: true },
      orderBy: { submittedAt: 'asc' },
    });
    if (!expenses.length) return run;

    // Reserve each expense before calling Wise. This prevents a second request
    // from creating a second transfer for the same expense.
    const reservedIds: string[] = [];
    for (const expense of expenses) {
      const reserved = await prisma.expense.updateMany({
        where: { id: expense.id, paymentStatus: 'READY', paymentRunId: null },
        data: {
          paymentRunId: run.id,
          paymentStatus: 'EXPORTED',
          status: 'PAYMENT_PENDING',
          paymentReference: run.reference,
          wiseBatchGroupId: run.wiseBatchGroupId,
          wiseStatus: 'preparing',
        },
      });
      if (reserved.count === 1) reservedIds.push(expense.id);
    }

    const reservedExpenses = expenses.filter(e => reservedIds.includes(e.id));
    if (!reservedExpenses.length) return run;

    try {
      for (const expense of reservedExpenses) {
        let recipientId = expense.wiseRecipientId ?? undefined;
        if (!recipientId) {
          const recipient = await createWiseRecipient({
            name: decryptBankDetail(expense.user.bankAccountName!),
            sortCode: decryptBankDetail(expense.user.bankSortCode!),
            accountNumber: decryptBankDetail(expense.user.bankAccountNumber!),
          });
          recipientId = String(recipient.id);
        }

        await prisma.expense.update({ where: { id: expense.id }, data: { wiseRecipientId: recipientId, wiseStatus: 'recipient_created' } });

        const recipientIdNumber = parseWiseRecipientId(recipientId);
        const quote = await createWiseQuote(recipientIdNumber, Number(expense.amount));
        const quoteUuid = quote.id || quote.uuid;
        if (!quoteUuid) throw new Error(`Wise did not return a quote ID for expense ${expense.id}.`);

        const details = getWiseTransferDetails(run.reference);
        await getWiseTransferRequirements({ targetAccount: recipientIdNumber, quoteUuid: String(quoteUuid), details });

        const customerTransactionId = deterministicWiseTransactionId(run.id, expense.id);
        let transfer = await findExistingWiseTransferInBatch(run.wiseBatchGroupId, customerTransactionId);
        if (!transfer) {
          transfer = await addWiseBatchTransfer(run.wiseBatchGroupId, {
            targetAccount: recipientIdNumber,
            quoteUuid: String(quoteUuid),
            details,
            customerTransactionId,
          });
        }

        const transferId = String(transfer.id);
        if (!/^\d+$/.test(transferId)) throw new Error(`Wise did not return a transfer ID for expense ${expense.id}.`);

        await prisma.expense.update({
          where: { id: expense.id },
          data: { wiseRecipientId: recipientId, wiseTransferId: transferId, wiseStatus: String(transfer.status || 'incoming_payment_waiting') },
        });

        await prisma.paymentRun.update({
          where: { id: run.id },
          data: { totalAmount: { increment: expense.amount }, wiseStatus: 'NEW' },
        });
      }

      const total = await prisma.expense.aggregate({
        where: { paymentRunId: run.id },
        _sum: { amount: true },
      });
      await prisma.paymentRun.update({
        where: { id: run.id },
        data: { totalAmount: total._sum.amount ?? 0, status: 'WISE_OPEN', wiseStatus: 'NEW' },
      });
      await prisma.expense.updateMany({
        where: { id: { in: reservedIds }, paymentRunId: run.id },
        data: { wiseStatus: 'in_open_batch' },
      });
      return run;
    } catch (error) {
      console.error('Wise open-batch preparation failed', { runId: run.id, error });

      // Never release an expense if Wise may already have accepted its
      // transfer. The deterministic customerTransactionId plus recovery scan
      // above makes retries safe after a network failure.
      const batch = await getWiseBatchGroup(run.wiseBatchGroupId);
      const batchStatus = String(batch.status || 'UNKNOWN').toUpperCase();
      if (batchStatus !== 'NEW') {
        await prisma.paymentRun.update({ where: { id: run.id }, data: { status: 'WISE_RECOVERY_REQUIRED', wiseStatus: `recovery_required:${batchStatus}` } });
        await prisma.expense.updateMany({ where: { id: { in: reservedIds } }, data: { wiseStatus: `recovery_required:${batchStatus}` } });
        throw error;
      }

      // Reconcile every reserved expense against the live batch. If Wise did
      // accept a transfer but our response was lost, persist the transfer ID.
      // If Wise did not accept it, release just that expense back to READY.
      for (const expense of reservedExpenses) {
        const current = await prisma.expense.findUnique({ where: { id: expense.id }, select: { wiseTransferId: true } });
        if (current?.wiseTransferId) continue;
        const customerTransactionId = deterministicWiseTransactionId(run.id, expense.id);
        const recovered = await findExistingWiseTransferInBatch(run.wiseBatchGroupId, customerTransactionId);
        if (recovered) {
          await prisma.expense.update({
            where: { id: expense.id },
            data: { wiseTransferId: String(recovered.id), wiseStatus: String(recovered.status || 'incoming_payment_waiting') },
          });
          await prisma.paymentRun.update({ where: { id: run.id }, data: { totalAmount: { increment: expense.amount } } });
        } else {
          await prisma.expense.update({
            where: { id: expense.id },
            data: { paymentRunId: null, paymentStatus: 'READY', status: 'READY_TO_PAY', paymentReference: null, wiseBatchGroupId: null, wiseTransferId: null, wiseStatus: null },
          });
        }
      }

      const recoveredTotal = await prisma.expense.aggregate({
        where: { paymentRunId: run.id },
        _sum: { amount: true },
      });
      await prisma.paymentRun.update({ where: { id: run.id }, data: { totalAmount: recoveredTotal._sum.amount ?? 0, status: 'WISE_OPEN', wiseStatus: 'NEW' } });
      throw error;
    }
  } finally {
    await releaseWiseBatchLease(leaseToken);
  }
}

export async function createWisePaymentRunForUser(userId: string, isAdmin: boolean, approverEmail: string) {
  const where: Prisma.ExpenseWhereInput = isAdmin
    ? { paymentStatus: 'READY', paymentRunId: null }
    : { paymentStatus: 'READY', paymentRunId: null, team: { approverEmails: { has: approverEmail } } };

  const expenses = await prisma.expense.findMany({
    where,
    include: { user: true },
    orderBy: { submittedAt: 'asc' },
  });
  const eligible = expenses.filter(e => e.user.bankAccountName && e.user.bankSortCode && e.user.bankAccountNumber);
  if (!eligible.length) throw new Error('No ready expenses with complete bank details are available.');
  return await addExpensesToOpenWiseBatch(eligible.map(e => e.id), userId);
}

/**
 * Called after any approval decision. Once the deciding approver has no
 * remaining pending approvals in their scope, this pulls in any last
 * eligible ready expenses and closes the open Wise batch, so the approver's
 * only remaining step is funding/confirming the batch in Wise itself - there
 * is no separate "Review and close" step in the app.
 */
export async function autoCompleteWiseBatchIfApprovalsAreComplete(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true, email: true } });
  if (!user || !isWiseConfigured()) return false;

  const approverEmail = (user.email ?? '').toLowerCase();
  const approverTeamCount = user.isAdmin || !approverEmail
    ? 0
    : await prisma.team.count({ where: { approverEmails: { has: approverEmail } } });
  const isApprover = user.isAdmin || approverTeamCount > 0;
  if (!isApprover) return false;
  const pendingWhere: Prisma.ExpenseWhereInput = user.isAdmin
    ? { status: 'PENDING' }
    : { status: 'PENDING', team: { approverEmails: { has: approverEmail } } };

  const pendingCount = await prisma.expense.count({ where: pendingWhere });
  if (pendingCount > 0) return false;

  // Pick up any eligible ready expenses that may have become payable without
  // going through decideExpense (for example after a purchase/receipt update).
  // createWisePaymentRunForUser owns its own Wise lease, so do this before
  // acquiring the lease used to close the batch.
  try {
    await createWisePaymentRunForUser(user.id, user.isAdmin, approverEmail);
  } catch (error: unknown) {
    // There may simply be nothing eligible to add. Do not treat that as a
    // failure: an existing open batch can still be completed below.
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (!message.toLowerCase().includes('no ready expenses')) {
      throw error;
    }
  }

  const leaseToken = await acquireWiseBatchLease();
  try {
    // Re-check after taking the lease so a concurrent approval gets a chance
    // to add its transfer before the batch is closed.
    const latestPendingCount = await prisma.expense.count({ where: pendingWhere });
    if (latestPendingCount > 0) return false;

    const run = await prisma.paymentRun.findFirst({
      where: user.isAdmin
        ? { status: 'WISE_OPEN', wiseBatchGroupId: { not: null } }
        : {
            status: 'WISE_OPEN',
            wiseBatchGroupId: { not: null },
            expenses: { some: { team: { approverEmails: { has: approverEmail } } } },
          },
      include: { expenses: { include: { team: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!run?.wiseBatchGroupId) return false;
    if (!user.isAdmin) {
      const canControlEveryExpense = run.expenses.length > 0 && run.expenses.every((expense) =>
        expense.team.approverEmails.some((approver) => approver.toLowerCase() === approverEmail)
      );
      if (!canControlEveryExpense) return false;
    }

    const batch = await getWiseBatchGroup(run.wiseBatchGroupId);
    const batchStatus = String(batch.status || '').toUpperCase();
    if (batchStatus === 'COMPLETED') {
      await prisma.paymentRun.update({
        where: { id: run.id },
        data: { status: 'WISE_PREPARED', wiseStatus: 'COMPLETED', exportedAt: new Date() },
      });
      await prisma.expense.updateMany({ where: { paymentRunId: run.id }, data: { wiseStatus: 'prepared' } });
      return true;
    }

    if (batchStatus !== 'NEW') {
      throw new Error(`Wise reports this batch as ${batchStatus.toLowerCase()}, so it cannot be completed automatically.`);
    }

    const completed = await completeWiseBatchGroup(run.wiseBatchGroupId, Number(batch.version));
    await prisma.$transaction(async tx => {
      await tx.paymentRun.update({
        where: { id: run.id },
        data: { status: 'WISE_PREPARED', wiseStatus: String(completed.status || 'COMPLETED'), exportedAt: new Date() },
      });
      await tx.expense.updateMany({ where: { paymentRunId: run.id }, data: { wiseStatus: 'prepared' } });
    });
    return true;
  } finally {
    await releaseWiseBatchLease(leaseToken);
  }
}
