import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getWiseBatchGroup, getWiseTransfer } from '@/lib/wise';
import { notify, escapeHtml } from '@/lib/notify';

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

  const refreshed = await prisma.expense.findMany({ where: { paymentRunId: runId }, orderBy: { submittedAt: 'asc' }, include: { user: true, team: true } });
  const transfers = await Promise.all(refreshed.filter(e => e.wiseTransferId).map(e => getWiseTransfer(e.wiseTransferId!)));
  const statuses = transfers.map(t => String(t.status || '').toLowerCase());
  const allComplete = statuses.length === refreshed.length && statuses.every(s => ['outgoing_payment_sent','bounced_back','funds_refunded','cancelled'].includes(s));
  const allSuccessful = statuses.length === refreshed.length && statuses.length > 0 && statuses.every(s => s === 'outgoing_payment_sent');
  const batchStatus = String(batch.status || 'UNKNOWN');
  const batchCancelled = ['CANCELLED'].includes(batchStatus);
  const prepared = ['COMPLETED'].includes(batchStatus);

  const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const expensesUrl = `${appUrl}/dashboard/expense-history`;
  const paidNotifications: { email: string; subject: string; html: string; text: string }[] = [];

  await prisma.$transaction(async tx => {
    let nextStatus: 'WISE_OPEN' | 'WISE_PREPARED' | 'WISE_RECOVERY_REQUIRED' | 'COMPLETED' | 'CANCELLED' = 'WISE_RECOVERY_REQUIRED';
    if (batchCancelled) nextStatus = 'CANCELLED';
    else if (batchStatus === 'NEW' && run.status === 'WISE_OPEN') nextStatus = 'WISE_OPEN';
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
          if (expense.user.email) {
            paidNotifications.push({
              email: expense.user.email,
              subject: `Advance paid - £${expense.amount.toFixed(2)}`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2>Your advance has been paid</h2><p style="color:#64748b">Your advance for <strong>${escapeHtml(expense.team.name)}</strong> has been sent to your bank account.</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${expense.amount.toFixed(2)}</p><p style="margin:0">${escapeHtml(expense.description)}</p></div><p style="color:#475569">Once you've made the purchase, upload the receipt in Expense History so it can be settled.</p>${expensesUrl ? `<a href="${expensesUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Upload receipt</a>` : ''}</div>`,
              text: `Your advance of £${expense.amount.toFixed(2)} for ${expense.description} (${expense.team.name}) has been paid.\n\nOnce you've made the purchase, upload the receipt in Expense History so it can be settled.\n\n${expensesUrl || ''}`,
            });
          }
        } else {
          await tx.expense.update({ where: { id: expense.id }, data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date(), wiseStatus: state } });
          if (expense.user.email) {
            paidNotifications.push({
              email: expense.user.email,
              subject: `Expense paid - £${expense.amount.toFixed(2)}`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2>Your expense has been paid</h2><p style="color:#64748b">Your reimbursement for <strong>${escapeHtml(expense.team.name)}</strong> has been sent to your bank account.</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${expense.amount.toFixed(2)}</p><p style="margin:0">${escapeHtml(expense.description)}</p></div>${expensesUrl ? `<a href="${expensesUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">View expense</a>` : ''}</div>`,
              text: `Your expense of £${expense.amount.toFixed(2)} for ${expense.description} (${expense.team.name}) has been paid.\n\n${expensesUrl || ''}`,
            });
          }
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

  for (const n of paidNotifications) {
    await notify(n.email, n.subject, n.html, n.text);
  }

  revalidatePath('/dashboard/payments'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard');

}
