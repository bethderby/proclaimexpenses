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
  if (!runId) throw new Error('Payment run not found.');

  const run = await prisma.paymentRun.findUnique({
    where: { id: runId },
    include: { expenses: { include: { team: true, user: true } } },
  });
  if (!run) throw new Error('Payment run not found.');

  if (!user.isAdmin) {
    const email = (user.email ?? '').toLowerCase();
    const allowed = run.expenses.length > 0 &&
      run.expenses.every((e) => e.team.approverEmails.some((a) => a.toLowerCase() === email));
    if (!allowed) throw new Error('You are not authorised to cancel this payment batch.');
  }

  if (run.status === 'COMPLETED') throw new Error('A completed payment run cannot be cancelled.');
  if (run.status === 'CANCELLED') return;

  const batchLeaseToken = await acquireWiseBatchLease();
  try {
    // Claim the run locally before touching Wise. This is important because
    // Wise cancellation can be asynchronous: webhooks must still be able to
    // find the paymentRunId from the affected expenses while Wise settles the
    // individual transfers.
    await prisma.paymentRun.update({
      where: { id: runId },
      data: { status: 'WISE_CANCELLING', wiseStatus: 'CANCELLING' },
    });

    if (run.wiseBatchGroupId) {
      let batch = await getWiseBatchGroup(run.wiseBatchGroupId);
      const batchStatus = String(batch.status || '').toUpperCase();

      if (batchStatus === 'NEW') {
        try {
          batch = await cancelWiseBatchGroup(run.wiseBatchGroupId, Number(batch.version));
        } catch (error) {
          console.error('Wise batch cancellation request failed', runId, error);
        }
      } else if (batchStatus === 'COMPLETED') {
        const transferIds = Array.isArray(batch.transferIds)
          ? batch.transferIds.map((id: unknown) => String(id))
          : [];
        const localTransferIds = run.expenses
          .map((e) => e.wiseTransferId)
          .filter(Boolean)
          .map(String);
        const allTransferIds = [...new Set([...transferIds, ...localTransferIds])];

        // Cancel every transfer that is still explicitly cancellable. A
        // transfer caught in a transient Wise state must not abort the whole
        // run after earlier transfers have already been cancelled. The
        // webhook/cron will reconcile it again once Wise changes its state.
        for (const transferId of allTransferIds) {
          try {
            const transfer = await getWiseTransfer(transferId);
            const state = String(transfer.status || '').toLowerCase();

            if (state === 'incoming_payment_waiting') {
              await cancelWiseTransfer(transferId);
            } else if (state === 'outgoing_payment_sent') {
              // Money has already left Wise. Never attempt to cancel it.
            } else if (!['cancelled', 'bounced_back', 'funds_refunded'].includes(state)) {
              // Transient state such as incoming_payment_initiated,
              // processing, or funds_converted. Leave it alone for now and
              // let the next webhook/cron reconciliation decide its outcome.
            }
          } catch (error) {
            console.error('Wise transfer cancellation request failed', { runId, transferId, error });
          }
        }
      } else if (batchStatus === 'MARKED_FOR_CANCELLATION' || batchStatus === 'PROCESSING_CANCEL') {
        // Wise has already accepted the cancellation request. Do not ask the
        // user to click Cancel again while Wise finishes it.
      } else if (batchStatus === 'CANCELLED') {
        // Already cancelled in Wise. The reconciliation below will return
        // the affected expenses to Pending immediately.
      }
    }

    // Re-read Wise immediately after requesting cancellation. If Wise has
    // already settled the batch/transfers, this finishes the cancellation in
    // the same click. Otherwise the run remains WISE_CANCELLING and the
    // webhook/cron will finish it automatically.
    try {
      await syncWisePaymentRunById(runId);
    } catch (error) {
      console.error('Wise cancellation reconciliation deferred', runId, error);
    }
  } finally {
    await releaseWiseBatchLease(batchLeaseToken);
  }

  await recordAuditEvent({
    actor: user,
    action: 'PAYMENT_RUN_CANCEL_REQUESTED',
    entityType: 'PAYMENT_RUN',
    entityId: runId,
    paymentRunId: runId,
    summary: 'Wise payment batch cancellation requested',
    metadata: { runId },
  });

  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard/expenses');
  revalidatePath('/dashboard/expense-history');
  revalidatePath('/dashboard');
}

