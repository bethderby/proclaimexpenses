'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { completeWiseBatchGroup, cancelWiseBatchGroup, getWiseBatchGroup, getWiseTransfer, cancelWiseTransfer, isWiseConfigured } from '@/lib/wise';
import { syncWisePaymentRunById } from '@/lib/wise-sync';
import { recordAuditEvent } from '@/lib/audit';
import { acquireWiseBatchLease, releaseWiseBatchLease, addExpensesToOpenWiseBatch, createWisePaymentRunForUser } from '@/lib/wise-batch';
import { requireUser } from './shared';
import { notify, renderEmail } from '@/lib/notify';

export async function createWisePaymentRun() {
  const user = await requireUser();
  if (!user.isAdmin && !user.isApprover) throw new Error('Only approvers or admins can create payment runs.');
  if (!isWiseConfigured()) throw new Error('Wise is not configured. Add WISE_API_TOKEN and WISE_PROFILE_ID first.');

  const approverEmail = (user.email ?? '').toLowerCase();
  const run = await createWisePaymentRunForUser(user.id, user.isAdmin, approverEmail);
  await recordAuditEvent({ actor: user, action: 'PAYMENT_RUN_CREATED', entityType: 'PAYMENT_RUN', entityId: run?.id ?? null, paymentRunId: run?.id ?? null, summary: run?.id ? `Wise payment batch ${run.id} opened` : 'Wise payment batch opening requested', metadata: { runId: run?.id ?? null, status: run?.status ?? null } });
  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard/expenses');
  revalidatePath('/dashboard/expense-history');
}

export async function completeWisePaymentRun(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin && !user.isApprover) throw new Error('Only approvers or admins can close payment batches.');
  const runId = String(formData.get('runId') || '');
  if (!runId) throw new Error('Payment run not found.');

  const leaseToken = await acquireWiseBatchLease();
  try {
    const run = await prisma.paymentRun.findUnique({ where: { id: runId }, include: { expenses: { include: { team: true, user: true } } } });
    if (!run) throw new Error('Payment run not found.');
    if (run.status !== 'WISE_OPEN' || !run.wiseBatchGroupId) throw new Error('This payment batch is not open for review.');
    if (!user.isAdmin) {
      const email = (user.email ?? '').toLowerCase();
      const allowed = run.expenses.length > 0 && run.expenses.every(e => e.team.approverEmails.some(a => a.toLowerCase() === email));
      if (!allowed) throw new Error('You are not authorised to close this payment batch.');
    }

    // A review is the single intentional point at which the open batch is
    // closed. Before closing it, pull in any eligible approved expenses that
    // have not yet been added to a payment run. This means the approver does
    // not need a separate Prepare step and we do not accidentally close a
    // batch while an approved expense is still waiting.
    const readyWhere: Prisma.ExpenseWhereInput = user.isAdmin
      ? { paymentStatus: 'READY', paymentRunId: null }
      : {
          paymentStatus: 'READY',
          paymentRunId: null,
          team: { approverEmails: { has: (user.email ?? '').toLowerCase() } },
        };
    const readyExpenses = await prisma.expense.findMany({
      where: readyWhere,
      include: { user: true },
      orderBy: { submittedAt: 'asc' },
    });
    const eligibleReadyIds = readyExpenses
      .filter(e => e.user.bankAccountName && e.user.bankSortCode && e.user.bankAccountNumber)
      .map(e => e.id);
    if (eligibleReadyIds.length) {
      await addExpensesToOpenWiseBatch(eligibleReadyIds, user.id);
    }

    // Re-read the run because the batch may have just received additional
    // transfers during the review step.
    const refreshedRun = await prisma.paymentRun.findUnique({
      where: { id: runId },
      include: { expenses: { include: { team: true } } },
    });
    if (!refreshedRun || refreshedRun.status !== 'WISE_OPEN' || !refreshedRun.wiseBatchGroupId) {
      throw new Error('This payment batch is no longer open for review.');
    }

    const batch = await getWiseBatchGroup(refreshedRun.wiseBatchGroupId);
    const batchStatus = String(batch.status || '').toUpperCase();
    if (batchStatus === 'COMPLETED') {
      await prisma.paymentRun.update({ where: { id: refreshedRun.id }, data: { status: 'WISE_PREPARED', wiseStatus: 'COMPLETED', exportedAt: new Date() } });
    } else if (batchStatus === 'NEW') {
      const completed = await completeWiseBatchGroup(refreshedRun.wiseBatchGroupId, Number(batch.version));
      await prisma.$transaction(async tx => {
        await tx.paymentRun.update({ where: { id: refreshedRun.id }, data: { status: 'WISE_PREPARED', wiseStatus: String(completed.status || 'COMPLETED'), exportedAt: new Date() } });
        await tx.expense.updateMany({ where: { paymentRunId: refreshedRun.id }, data: { wiseStatus: 'prepared' } });
      });
    } else {
      throw new Error(`Wise reports this batch as ${batchStatus.toLowerCase()}, so it cannot be completed here.`);
    }
  } finally {
    await releaseWiseBatchLease(leaseToken);
  }

  await recordAuditEvent({ actor: user, action: 'PAYMENT_RUN_COMPLETED', entityType: 'PAYMENT_RUN', entityId: runId, paymentRunId: runId, summary: 'Wise payment batch completed/prepared', metadata: { runId } });
  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard/expenses');
  revalidatePath('/dashboard/expense-history');
}

export async function syncWisePaymentRun(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin && !user.isApprover) throw new Error('Only approvers or admins can sync payment runs.');
  const runId = String(formData.get('runId') || '');
  if (!runId) throw new Error('Payment run not found.');
  const run = await prisma.paymentRun.findUnique({ where: { id: runId }, include: { expenses: { include: { team: true } } } });
  if (!run) throw new Error('Payment run not found.');
  if (!user.isAdmin) {
    const email = (user.email ?? '').toLowerCase();
    const allowed = run.expenses.some((e) => e.team.approverEmails.some((a) => a.toLowerCase() === email));
    if (!allowed) throw new Error('You are not authorised to sync this payment batch.');
  }
  await syncWisePaymentRunById(runId);
  await recordAuditEvent({ actor: user, action: 'PAYMENT_RUN_SYNCED', entityType: 'PAYMENT_RUN', entityId: runId, paymentRunId: runId, summary: 'Wise payment batch synchronised', metadata: { runId } });
  revalidatePath('/dashboard/payments'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard');
}

export async function cancelPaymentRun(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin && !user.isApprover) throw new Error('Only approvers or admins can cancel payment runs.');
  const runId = String(formData.get('runId') || '');
  const run = await prisma.paymentRun.findUnique({ where: { id: runId }, include: { expenses: { include: { team: true, user: true } } } });
  if (!run) throw new Error('Payment run not found.');
  if (!user.isAdmin) {
    const email = (user.email ?? '').toLowerCase();
    const allowed = run.expenses.length > 0 && run.expenses.every((e) => e.team.approverEmails.some((a) => a.toLowerCase() === email));
    if (!allowed) throw new Error('You are not authorised to cancel this payment batch.');
  }
  if (run.status === 'COMPLETED') throw new Error('A completed payment run cannot be cancelled.');

  const batchLeaseToken = run.status === 'WISE_OPEN' ? await acquireWiseBatchLease() : null;
  let finalWiseStatus = 'cancelled';
  try {
    if (run.wiseBatchGroupId) {
      const batch = await getWiseBatchGroup(run.wiseBatchGroupId);
      const batchStatus = String(batch.status || '').toUpperCase();
      finalWiseStatus = batchStatus === 'CANCELLED' ? 'cancelled' : batchStatus.toLowerCase();

      if (batchStatus === 'COMPLETED' || batchStatus === 'NEW') {
        const transferIds = Array.isArray(batch.transferIds) ? batch.transferIds.map((id: unknown) => String(id)) : [];
        const localTransferIds = run.expenses.map(e => e.wiseTransferId).filter(Boolean).map(String);
        const allTransferIds = [...new Set([...transferIds, ...localTransferIds])];
        for (const transferId of allTransferIds) {
          const transfer = await getWiseTransfer(transferId);
          const state = String(transfer.status || '').toLowerCase();
          if (state === 'incoming_payment_waiting') {
            await cancelWiseTransfer(transferId);
          } else if (!['cancelled', 'bounced_back', 'funds_refunded'].includes(state)) {
            throw new Error(`Wise transfer ${transferId} cannot be cancelled because it is already ${transfer.status}.`);
          }
        }
      }

      // If the batch itself is still editable, cancel it too. A completed batch
      // is closed; its individual unfunded transfers were handled above.
      if (batchStatus === 'NEW') {
        await cancelWiseBatchGroup(run.wiseBatchGroupId, Number(batch.version));
      } else if (batchStatus === 'MARKED_FOR_CANCELLATION' || batchStatus === 'PROCESSING_CANCEL') {
        // Wise cancellation is asynchronous. If cancellation has already been
        // requested, do not make the user click Cancel again while Wise moves
        // the batch through its cancellation states. We can safely make the
        // local run cancelled now; a later sync will keep it cancelled and will
        // update the Wise status to CANCELLED once Wise has finished.
      }
    }

    await prisma.$transaction(async tx => {
      await tx.paymentRun.update({ where: { id: runId }, data: { status: 'CANCELLED', wiseStatus: finalWiseStatus, preparationKey: null } });
      await tx.expense.updateMany({
        where: { paymentRunId: runId, status: 'PAYMENT_PENDING' },
        data: {
          paymentRunId: null,
          paymentStatus: 'NOT_READY',
          status: 'PENDING',
          approvedAmount: null,
          decisionNote: 'Payment run was cancelled. Approval is required again.',
          decidedAt: null,
          paymentReference: null,
          wiseBatchGroupId: null,
          wiseTransferId: null,
          wiseStatus: null,
          wasInCancelledPaymentRun: true,
        },
      });
    });
  } finally {
    if (batchLeaseToken) await releaseWiseBatchLease(batchLeaseToken);
  }
  await recordAuditEvent({ actor: user, action: 'PAYMENT_RUN_CANCELLED', entityType: 'PAYMENT_RUN', entityId: runId, paymentRunId: runId, summary: 'Wise payment batch cancelled', metadata: { runId } });
  const cancelledByEmail = new Map<string, typeof run.expenses>();
  for (const expense of run.expenses) {
    if (expense.paymentStatus !== 'PAID' && expense.status === 'PAYMENT_PENDING' && expense.user.email) {
      const email = expense.user.email.trim().toLowerCase();
      if (!email) continue;
      const existing = cancelledByEmail.get(email) ?? [];
      existing.push(expense);
      cancelledByEmail.set(email, existing);
    }
  }
  for (const [email, expenses] of cancelledByEmail) {
    const details = expenses.map(e => `£${e.amount.toFixed(2)} - ${e.description}`).join('\n');
    const { html, text } = renderEmail({
      heading: 'Payment batch cancelled',
      intro: 'Your payment batch was cancelled, so the affected expense(s) have been returned to Pending and must be approved again before they can be paid.',
      plainTextExtra: `Expenses returned to approval:\n${details}`,
      ctaPath: '/dashboard/expense-history',
      ctaLabel: 'View expenses',
    });
    await notify(email, 'Payment batch cancelled - approval required again', html, text);
  }

  // Notify the configured approvers for the affected teams as well. The
  // cancellation clears the previous approval, so these expenses need to be
  // reviewed and approved again before they can enter a new payment batch.
  const approverEmails = new Set<string>();
  for (const expense of run.expenses) {
    if (expense.paymentStatus !== 'PAID' && expense.status === 'PAYMENT_PENDING') {
      for (const email of expense.team.approverEmails) {
        const normalized = email.trim().toLowerCase();
        if (normalized) approverEmails.add(normalized);
      }
    }
  }

  const affectedDetails = [...cancelledByEmail.values()]
    .flat()
    .map(e => `£${e.amount.toFixed(2)} - ${e.description}`)
    .join('\n');

  if (affectedDetails && approverEmails.size > 0) {
    const { html, text } = renderEmail({
      heading: 'Payment batch cancelled - approval required',
      intro: 'A payment batch has been cancelled. The affected expense(s) have been returned to Pending and the previous approval has been cleared. Please review and approve them again before they can be paid.',
      plainTextExtra: `Expenses returned to approval:\n${affectedDetails}`,
      ctaPath: '/dashboard/approvals',
      ctaLabel: 'Review approvals',
    });
    await notify([...approverEmails], 'Payment batch cancelled - approval required again', html, text);
  }

  revalidatePath('/dashboard/payments'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history');
}
