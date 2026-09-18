import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/audit';
import { getWiseBatchGroup, getWiseTransfer } from '@/lib/wise';
import { notify, escapeHtml, renderEmail } from '@/lib/notify';

function renderCancellationEmail(details: string, ctaPath: string, ctaLabel: string, intro: string) {
  return renderEmail({
    heading: 'Payment batch cancelled',
    intro,
    plainTextExtra: `Expenses returned to approval:\n${details}`,
    ctaPath,
    ctaLabel,
  });
}

export function deterministicWiseTransactionId(paymentRunId: string, expenseId: string) {
  const hash = crypto.createHash('sha256').update(`proclaim-payment-run:${paymentRunId}:expense:${expenseId}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-${((parseInt(hash.slice(16,18), 16) & 0x3f) | 0x80).toString(16).padStart(2,'0')}${hash.slice(18,20)}-${hash.slice(20,32)}`;
}

export async function syncWisePaymentRunById(runId: string) {

  const run = await prisma.paymentRun.findUnique({ where: { id: runId }, include: { expenses: { include: { user: true, team: true } } } });
  if (!run?.wiseBatchGroupId) throw new Error('Wise batch not found for this payment run.');

  const batch = await getWiseBatchGroup(run.wiseBatchGroupId);
  const batchTransferIds = Array.isArray(batch.transferIds) ? batch.transferIds.map((id: unknown) => String(id)) : [];
  const knownTransferIds = new Set(run.expenses.map(e => e.wiseTransferId).filter(Boolean).map(String));
  const missingTransferIds = batchTransferIds.filter((id: string) => !knownTransferIds.has(id));
  const batchTransfers = await Promise.all(missingTransferIds.map((id: string) => getWiseTransfer(id)));

  // Recover any transfer that Wise created successfully but Proclaim did not
  // get a chance to persist before the request failed. The deterministic
  // customerTransactionId lets us map it back to the exact expense.
  type WiseTransferSummary = {
    id: string | number;
    status?: string;
    customerTransactionId?: string;
  };
  const recovered = new Map<string, WiseTransferSummary>();
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
  const cancellationSettled = batchCancelled || (run.status === 'WISE_CANCELLING' && allComplete);

  const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const expensesUrl = `${appUrl}/dashboard/expense-history`;
  const paidNotifications: { email: string; subject: string; html: string; text: string }[] = [];
  const failedNotifications: { email: string; subject: string; html: string; text: string }[] = [];
  const cancellationNotifications: { email: string; subject: string; html: string; text: string }[] = [];

  await prisma.$transaction(async tx => {
    let nextStatus: 'WISE_OPEN' | 'WISE_PREPARED' | 'WISE_RECOVERY_REQUIRED' | 'WISE_CANCELLING' | 'COMPLETED' | 'CANCELLED' = 'WISE_RECOVERY_REQUIRED';
    // Never turn a cancellation that is still being reconciled into Prepared.
    // The webhook/cron can call this repeatedly while Wise settles the
    // individual transfers.
    if (allSuccessful) nextStatus = 'COMPLETED';
    else if (run.status === 'CANCELLED' || cancellationSettled) nextStatus = 'CANCELLED';
    else if (run.status === 'WISE_CANCELLING') nextStatus = 'WISE_CANCELLING';
    else if (batchStatus === 'NEW' && run.status === 'WISE_OPEN') nextStatus = 'WISE_OPEN';
    else if (prepared && (allComplete || (refreshed.length > 0 && transfers.length === refreshed.length))) nextStatus = 'WISE_PREPARED';

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
          const claimed = await tx.expense.updateMany({
            where: { id: expense.id, paymentStatus: { not: 'PAID' } },
            data: { status: 'ADVANCE_PAID_AWAITING_RECEIPT', paymentStatus: 'PAID', paidAt: new Date(), advanceAmount: expense.amount, settlementStatus: 'AWAITING_RECEIPT', receiptDueAt: new Date(Date.now()+7*24*60*60*1000), wiseStatus: state },
          });
          if (claimed.count === 1 && expense.user.email) {
            paidNotifications.push({
              email: expense.user.email,
              subject: `Advance paid - £${expense.amount.toFixed(2)}`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2>Your advance has been paid</h2><p style="color:#64748b">Your advance for <strong>${escapeHtml(expense.team.name)}</strong> has been sent to your bank account.</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${expense.amount.toFixed(2)}</p><p style="margin:0">${escapeHtml(expense.description)}</p></div><p style="color:#475569">Once you've made the purchase, upload the receipt in Expense History so it can be settled.</p>${expensesUrl ? `<a href="${expensesUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Upload receipt</a>` : ''}</div>`,
              text: `Your advance of £${expense.amount.toFixed(2)} for ${expense.description} (${expense.team.name}) has been paid.\n\nOnce you've made the purchase, upload the receipt in Expense History so it can be settled.\n\n${expensesUrl || ''}`,
            });
          }
        } else {
          const claimed = await tx.expense.updateMany({
            where: { id: expense.id, paymentStatus: { not: 'PAID' } },
            data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date(), wiseStatus: state },
          });
          if (claimed.count === 1 && expense.user.email) {
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
        const cancellationFlow = run.status === 'WISE_CANCELLING' || batchCancelled;
        await tx.expense.update({ where: { id: expense.id }, data: { wiseStatus: state, ...((transferFailed && !cancellationFlow) ? { status: 'PAYMENT_FAILED', paymentStatus: 'FAILED' } : {}) } });
        if (transferFailed && !cancellationFlow) {
          const subject = `Payment failed - £${expense.amount.toFixed(2)}`;
          const recipientName = expense.user.name || expense.user.email || 'The requester';
          const approverEmails = expense.team.approverEmails
            .map(email => email.trim().toLowerCase())
            .filter(Boolean);
          const recipients = [...new Set([expense.user.email, ...approverEmails].filter(Boolean))] as string[];
          for (const email of recipients) {
            const isRequester = expense.user.email?.toLowerCase() === email;
            failedNotifications.push({
              email,
              subject,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2>Payment failed</h2><p style="color:#64748b">The payment for <strong>${escapeHtml(expense.team.name)}</strong> could not be completed in Wise.</p><div style="padding:18px;border:1px solid #fecaca;border-radius:14px;margin:20px 0;background:#fff7f7"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${expense.amount.toFixed(2)}</p><p style="margin:0">${escapeHtml(expense.description)}</p><p style="margin:8px 0 0;color:#64748b">Wise status: ${escapeHtml(state)}</p></div><p>${isRequester ? `Please check your bank details and contact your approver if anything needs correcting.` : `The requester (${escapeHtml(recipientName)}) has been notified. Please review the expense and arrange the next step.`}</p>${expensesUrl ? `<a href="${expensesUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">View expense</a>` : ''}</div>`,
              text: `Payment failed for £${expense.amount.toFixed(2)} - ${expense.description} (${expense.team.name}).

Wise status: ${state}.

${isRequester ? 'Please check your bank details and contact your approver if anything needs correcting.' : `The requester (${recipientName}) has been notified. Please review the expense and arrange the next step.`}

${expensesUrl || ''}`,
            });
          }
        }
      }
    }

    if (cancellationSettled) {
      await tx.expense.updateMany({
        where: { paymentRunId: runId, paymentStatus: { not: 'PAID' } },
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
        },
      });
    }
  });

  if (cancellationSettled) {
    const cancelledExpenses = transfers.flatMap((transfer) => {
      const expense = refreshed.find(e => e.wiseTransferId === String(transfer.id));
      const state = String(transfer.status || '').toLowerCase();
      return expense && ['cancelled', 'bounced_back', 'funds_refunded'].includes(state) && expense.paymentStatus !== 'PAID'
        ? [expense]
        : [];
    });

    const details = cancelledExpenses.map(e => `£${e.amount.toFixed(2)} - ${e.description}`).join('\n');
    if (details) {
      const requesterEmails = new Map<string, typeof cancelledExpenses>();
      const approverEmails = new Set<string>();

      for (const expense of cancelledExpenses) {
        if (expense.user.email) {
          const email = expense.user.email.trim().toLowerCase();
          if (email) {
            const existing = requesterEmails.get(email) ?? [];
            existing.push(expense);
            requesterEmails.set(email, existing);
          }
        }
        for (const email of expense.team.approverEmails) {
          const normalized = email.trim().toLowerCase();
          if (normalized) approverEmails.add(normalized);
        }
      }

      for (const [email, expenses] of requesterEmails) {
        const requesterDetails = expenses.map(e => `£${e.amount.toFixed(2)} - ${e.description}`).join('\n');
        const { html, text } = renderCancellationEmail(requesterDetails, '/dashboard/expense-history', 'View expenses',
          'Your payment batch was cancelled, so the affected expense(s) have been returned to Pending and must be approved again before they can be paid.');
        cancellationNotifications.push({ email, subject: 'Payment batch cancelled - approval required again', html, text });
      }

      if (approverEmails.size > 0) {
        const { html, text } = renderCancellationEmail(details, '/dashboard/approvals', 'Review approvals',
          'A payment batch has been cancelled. The affected expense(s) have been returned to Pending and the previous approval has been cleared. Please review and approve them again before they can be paid.');
        for (const email of approverEmails) {
          cancellationNotifications.push({ email, subject: 'Payment batch cancelled - approval required again', html, text });
        }
      }
    }
  }

  for (const transfer of transfers) {
    const expense = refreshed.find(e => e.wiseTransferId === String(transfer.id));
    if (!expense) continue;
    const state = String(transfer.status || 'unknown');
    await recordAuditEvent({
      action: 'WISE_TRANSFER_STATUS',
      entityType: 'EXPENSE',
      entityId: expense.id,
      expenseId: expense.id,
      paymentRunId: runId,
      teamId: expense.teamId,
      targetUserId: expense.userId,
      summary: `Wise transfer ${String(transfer.id)} reported ${state}`,
      metadata: { wiseTransferId: String(transfer.id), wiseStatus: state, paymentStatus: expense.paymentStatus, expenseStatus: expense.status },
    });
  }

  await recordAuditEvent({ action: 'WISE_SYNC_COMPLETED', entityType: 'PAYMENT_RUN', entityId: runId, paymentRunId: runId, summary: `Wise sync completed with batch status ${batchStatus}`, metadata: { batchStatus, transferCount: transfers.length, successfulTransfers: transfers.filter(t => String(t.status || '').toLowerCase() === 'outgoing_payment_sent').length, failedTransfers: transfers.filter(t => ['bounced_back','funds_refunded','cancelled'].includes(String(t.status || '').toLowerCase())).length } });

  for (const n of paidNotifications) {
    await notify(n.email, n.subject, n.html, n.text);
  }

  for (const n of failedNotifications) {
    await notify(n.email, n.subject, n.html, n.text);
  }

  for (const n of cancellationNotifications) {
    await notify(n.email, n.subject, n.html, n.text);
  }

  revalidatePath('/dashboard/payments'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard');

}
