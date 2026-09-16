import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getWiseBatchGroup, getWiseTransfer } from '@/lib/wise';

export function deterministicWiseTransactionId(paymentRunId: string, expenseId: string) {
  const hash = crypto.createHash('sha256').update(`proclaim-payment-run:${paymentRunId}:expense:${expenseId}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-${((parseInt(hash.slice(16,18), 16) & 0x3f) | 0x80).toString(16).padStart(2,'0')}${hash.slice(18,20)}-${hash.slice(20,32)}`;
}

export async function syncWisePaymentRunById(runId: string) {

  const run = await prisma.paymentRun.findUnique({ where: { id: runId }, include: { expenses: true } });
  if (!run?.wiseBatchGroupId) throw new Error('Wise batch not found for this payment run.');

  const batch = await getWiseBatchGroup(run.wiseBatchGroupId);
  const batchTransferIds = Array.isArray(batch.transferIds) ? batch.transferIds.map((id: unknown) => String(id)) : [];
  const knownTransferIds = new Set(run.expenses.map(e => e.wiseTransferId).filter(Boolean).map(String));
  const missingTransferIds = batchTransferIds.filter((id: string) => !knownTransferIds.has(id));
  const batchTransfers = await Promise.all(missingTransferIds.map((id: string) => getWiseTransfer(id)));

  // Recover any transfer that Wise created successfully but Proclaim did not
  // get a chance to persist before the request failed. The deterministic
  // customerTransactionId lets us map it back to the exact expense.
  const recovered = new Map<string, any>();
  for (const transfer of batchTransfers) {
    const customerTransactionId = String(transfer.customerTransactionId || '');
    const expense = run.expenses.find(e => deterministicWiseTransactionId(run.id, e.id) === customerTransactionId);
    if (expense) recovered.set(expense.id, transfer);
  }

  if (recovered.size) {
    await prisma.$transaction(async tx => {
      for (const [expenseId, transfer] of recovered) {
        await tx.expense.update({
          where: { id: expenseId },
          data: { wiseTransferId: String(transfer.id), wiseBatchGroupId: run.wiseBatchGroupId, wiseStatus: String(transfer.status || 'unknown') },
        });
      }
    });
  }

  const refreshed = await prisma.expense.findMany({ where: { paymentRunId: runId }, orderBy: { submittedAt: 'asc' } });
  const transfers = await Promise.all(refreshed.filter(e => e.wiseTransferId).map(e => getWiseTransfer(e.wiseTransferId!)));
  const statuses = transfers.map(t => String(t.status || '').toLowerCase());
  const allComplete = statuses.length === refreshed.length && statuses.every(s => ['outgoing_payment_sent','bounced_back','funds_refunded','cancelled'].includes(s));
  const allSuccessful = statuses.length === refreshed.length && statuses.length > 0 && statuses.every(s => s === 'outgoing_payment_sent');
  const batchStatus = String(batch.status || 'UNKNOWN');
  const batchCancelled = ['CANCELLED'].includes(batchStatus);
  const prepared = ['COMPLETED'].includes(batchStatus);

  await prisma.$transaction(async tx => {
    let nextStatus: 'WISE_PREPARED' | 'WISE_RECOVERY_REQUIRED' | 'COMPLETED' | 'CANCELLED' = 'WISE_RECOVERY_REQUIRED';
    if (batchCancelled) nextStatus = 'CANCELLED';
    else if (allSuccessful) nextStatus = 'COMPLETED';
    else if (prepared && (allComplete || transfers.length === refreshed.length)) nextStatus = 'WISE_PREPARED';

    await tx.paymentRun.update({
      where: { id: runId },
      data: {
        wiseStatus: batchStatus,
        status: nextStatus,
        ...(allSuccessful ? { completedAt: new Date() } : {}),
        ...(batchCancelled ? { preparationKey: null } : {}),
      },
    });

    for (const t of transfers) {
      const expense = refreshed.find(e => e.wiseTransferId === String(t.id));
      if (!expense) continue;
      const state = String(t.status || 'unknown');
      if (state === 'outgoing_payment_sent') {
        if (expense.paymentTiming === 'ADVANCE') {
          await tx.expense.update({ where: { id: expense.id }, data: { status: 'ADVANCE_PAID_AWAITING_RECEIPT', paymentStatus: 'PAID', paidAt: new Date(), advanceAmount: expense.amount, settlementStatus: 'AWAITING_RECEIPT', receiptDueAt: new Date(Date.now()+7*24*60*60*1000), wiseStatus: state } });
        } else {
          await tx.expense.update({ where: { id: expense.id }, data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date(), wiseStatus: state } });
        }
      } else {
        const transferFailed = ['bounced_back','funds_refunded','cancelled'].includes(state);
        await tx.expense.update({ where: { id: expense.id }, data: { wiseStatus: state, ...(transferFailed ? { status: 'PAYMENT_FAILED', paymentStatus: 'FAILED' } : {}) } });
      }
    }

    if (batchCancelled) {
      await tx.expense.updateMany({
        where: { paymentRunId: runId, paymentStatus: { not: 'PAID' } },
        data: { paymentRunId: null, paymentStatus: 'READY', status: 'READY_TO_PAY', paymentReference: null, wiseBatchGroupId: null, wiseTransferId: null, wiseStatus: null },
      });
    }
  });

  revalidatePath('/dashboard/payments'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard');

}
