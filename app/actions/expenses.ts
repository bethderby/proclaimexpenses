'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { encryptBankDetail } from '@/lib/bank';
import { parseMoney, roundMoney, errorMessage } from '@/lib/money';
import { recordAuditEvent } from '@/lib/audit';
import { notify, renderEmail } from '@/lib/notify';
import { isWiseConfigured } from '@/lib/wise';
import { autoCompleteWiseBatchIfApprovalsAreComplete } from '@/lib/wise-batch';
import { requireUser, getTeamApproverEmails } from './shared';
import { createWisePaymentRun } from './payments';

export async function submitExpense(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get('teamId') || '');
  const date = String(formData.get('date') || '');
  const description = (formData.get('description') as string)?.trim();
  const amount = parseMoney(formData.get('amount'));
  const receiptUrl = String(formData.get('receiptUrl') || '') || null;
  const purchaseStatus = String(formData.get('purchaseStatus') || '') as 'ALREADY_PURCHASED' | 'NOT_PURCHASED';
  const paymentTiming = String(formData.get('paymentTiming') || '') as 'AFTER_PURCHASE' | 'ADVANCE';

  const payoutUser = await prisma.user.findUnique({ where: { id: user.id }, select: { bankAccountName: true, bankSortCode: true, bankAccountNumber: true } });
  const hasBankDetails = !!(payoutUser?.bankAccountName && payoutUser.bankSortCode && payoutUser.bankAccountNumber);
  if (!hasBankDetails) throw new Error('Add your bank details before submitting an expense so you can be paid.');
  if (!teamId) throw new Error('Choose which team this expense is for.');
  if (!description) throw new Error('Add a description.');
  if (!date || Number.isNaN(new Date(date).getTime())) throw new Error('Choose a valid date.');
  if (!['ALREADY_PURCHASED', 'NOT_PURCHASED'].includes(purchaseStatus)) throw new Error('Choose whether the item has already been purchased.');
  if (!['AFTER_PURCHASE', 'ADVANCE'].includes(paymentTiming)) throw new Error('Choose when you need the money.');
  if (purchaseStatus === 'ALREADY_PURCHASED' && !receiptUrl) throw new Error('A receipt is required when the item has already been purchased.');
  if (purchaseStatus === 'ALREADY_PURCHASED' && paymentTiming !== 'AFTER_PURCHASE') throw new Error('An already-purchased expense cannot request an advance.');
  if (purchaseStatus === 'NOT_PURCHASED' && paymentTiming !== 'ADVANCE') throw new Error('An expense that has not yet been purchased must be submitted as an advance.');

  const { team, approverEmails } = await getTeamApproverEmails(teamId);
  const isAlreadyPurchased = purchaseStatus === 'ALREADY_PURCHASED';
  const receiptDueAt = null;

  const expense = await prisma.expense.create({
    data: {
      date: new Date(date), description, amount, receiptUrl, teamId, userId: user.id,
      purchaseStatus,
      paymentTiming,
      status: 'PENDING',
      receiptDueAt,
      purchasedAt: isAlreadyPurchased ? new Date(date) : null,
    },
  });

  await recordAuditEvent({ actor: user, action: 'EXPENSE_SUBMITTED', entityType: 'EXPENSE', entityId: expense.id, expenseId: expense.id, teamId, targetUserId: user.id, summary: `Expense submitted for £${amount.toFixed(2)}`, metadata: { description, amount, purchaseStatus, paymentTiming, date, receiptAttached: !!receiptUrl } });

  const requester = user.name || user.email || 'A person';
  const purchaseText = purchaseStatus === 'ALREADY_PURCHASED'
    ? 'The item has already been purchased and a receipt is attached.'
    : paymentTiming === 'ADVANCE'
      ? 'The requester has not bought the item and needs an advance before purchase.'
      : 'The requester has not bought the item and can pay personally after approval, then claim reimbursement with a receipt.';

  const { html, text } = renderEmail({
    heading: 'New expense needs approval',
    intro: `${requester} submitted an expense for ${team.name}.`,
    card: { amountLabel: `£${amount.toFixed(2)}`, description, note: purchaseText },
    ctaPath: '/dashboard/approvals',
    ctaLabel: 'Review expense',
  });
  await notify(approverEmails, `Expense needs approval - £${amount.toFixed(2)}`, html, text);

  revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/approvals'); revalidatePath('/dashboard');
  redirect('/dashboard/expenses');
}

export async function updateExpense(formData: FormData) {
  const user = await requireUser();
  const expenseId = String(formData.get('expenseId') || '');
  const teamId = String(formData.get('teamId') || '');
  const date = String(formData.get('date') || '');
  const description = (formData.get('description') as string)?.trim();
  const amount = parseMoney(formData.get('amount'));
  if (!expenseId || !teamId) throw new Error('Expense not found.');
  if (!description) throw new Error('Add a description.');
  if (!date || Number.isNaN(new Date(date).getTime())) throw new Error('Choose a valid date.');
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, userId: user.id } });
  if (!expense) throw new Error('You can only edit your own expenses.');
  if (expense.status !== 'PENDING') throw new Error('Only expenses still awaiting approval can be edited.');
  if (expense.relatedExpenseId) throw new Error('Additional reimbursements created from an advance cannot be edited by the requester.');
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error('That team no longer exists.');
  await prisma.expense.update({ where: { id: expenseId }, data: { date: new Date(date), description, amount, teamId } });
  await recordAuditEvent({ actor: user, action: 'EXPENSE_UPDATED', entityType: 'EXPENSE', entityId: expenseId, expenseId, teamId, targetUserId: expense.userId, summary: `Expense updated to £${amount.toFixed(2)}`, metadata: { date, description, amount, previousTeamId: expense.teamId } });
  revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard');
}

export async function cancelExpense(formData: FormData) {
  const user = await requireUser();
  const expenseId = String(formData.get('expenseId') || '');
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.userId !== user.id) throw new Error('Expense not found.');

  // A requester can cancel an expense while it is pending approval. A
  // returned-to-approval expense is normally PENDING, but accept the legacy
  // READY_TO_PAY shape only when it is explicitly marked as having come from
  // a cancelled payment run. Never allow an ordinary approved expense to be
  // cancelled by the requester.
  const returnedToApproval = expense.wasInCancelledPaymentRun &&
    expense.status === 'READY_TO_PAY' &&
    expense.decisionNote === 'Previous approval was returned for approval again.';
  if (expense.relatedExpenseId) {
    throw new Error('Additional reimbursements created from an advance cannot be cancelled by the requester. An admin must reject them if needed.');
  }
  // Cancellation is intentionally idempotent. A double form submission can
  // otherwise make the second request re-read the expense as CANCELLED and
  // surface a misleading "can no longer be cancelled" error to the requester.
  if (expense.status === 'CANCELLED') return;

  if (expense.status !== 'PENDING' && !returnedToApproval) {
    throw new Error('This expense can no longer be cancelled.');
  }

  // Claim the cancellation atomically so a concurrent approval/payment
  // transition cannot be overwritten by a stale cancellation request.
  const cancelled = await prisma.expense.updateMany({
    where: {
      id: expenseId,
      userId: user.id,
      OR: [
        { status: 'PENDING' },
        {
          status: 'READY_TO_PAY',
          wasInCancelledPaymentRun: true,
          decisionNote: 'Previous approval was returned for approval again.',
        },
      ],
    },
    data: {
      status: 'CANCELLED',
      paymentStatus: 'NOT_READY',
      paymentRunId: null,
      paymentReference: null,
      wiseBatchGroupId: null,
      wiseTransferId: null,
      wiseStatus: null,
      approvedAmount: null,
      decidedAt: null,
    },
  });

  if (cancelled.count === 0) {
    // Another request won the race. If it cancelled the expense, treat the
    // action as already completed; otherwise preserve the normal state guard.
    const current = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { status: true },
    });
    if (current?.status === 'CANCELLED') return;
    throw new Error('This expense can no longer be cancelled.');
  }

  await recordAuditEvent({ actor: user, action: 'EXPENSE_CANCELLED', entityType: 'EXPENSE', entityId: expenseId, expenseId, teamId: expense.teamId, targetUserId: expense.userId, summary: 'Expense cancelled by requester', metadata: { previousStatus: expense.status, returnedToApproval: returnedToApproval } });

  revalidatePath('/dashboard/expenses');
  revalidatePath('/dashboard/expense-history');
  revalidatePath('/dashboard/approvals');
  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard');
}

export async function decideExpense(expenseId: string, decision: 'APPROVED' | 'REJECTED', note: string) {
  const user = await requireUser();
  const expense = await prisma.expense.findUnique({ where: { id: expenseId }, include: { team: true, user: true } });
  if (!expense) throw new Error('Expense not found.');
  const email = (user.email ?? '').toLowerCase();
  const isTeamApprover = !!email && expense.team.approverEmails.some(e => e.toLowerCase() === email);
  if (!user.isAdmin && !isTeamApprover) throw new Error("Only this team's configured approver can decide this expense.");
  if (expense.relatedExpenseId && decision === 'REJECTED' && !user.isAdmin) throw new Error('Only an admin can reject an additional reimbursement created from an advance.');
  if (expense.status !== 'PENDING') throw new Error('This expense has already been decided.');
  if (decision === 'APPROVED' && expense.purchaseStatus === 'ALREADY_PURCHASED' && !expense.receiptUrl) throw new Error('A receipt is required before an already-purchased expense can be approved.');

  let nextStatus: 'APPROVED' | 'READY_TO_PAY' = 'APPROVED';
  let paymentStatus: 'NOT_READY' | 'READY' = 'NOT_READY';
  if (decision === 'APPROVED') {
    nextStatus = 'READY_TO_PAY';
    paymentStatus = 'READY';
  }

  await prisma.expense.update({ where: { id: expenseId }, data: { status: decision === 'REJECTED' ? 'REJECTED' : nextStatus, paymentStatus, approvedAmount: decision === 'APPROVED' ? expense.amount : null, decisionNote: note || null, decidedAt: new Date() } });

  await recordAuditEvent({ actor: user, action: `EXPENSE_${decision}`, entityType: 'EXPENSE', entityId: expenseId, expenseId, teamId: expense.teamId, targetUserId: expense.userId, summary: `Expense ${decision === 'APPROVED' ? 'approved and made ready to pay' : 'rejected'}`, metadata: { decision, note: note || null, amount: expense.amount, relatedExpenseId: expense.relatedExpenseId } });

  // Once an approval makes the expense payable, immediately prepare the
  // current ready-to-pay set in Wise. This means the Wise batch is already
  // waiting in Wise for funding/confirmation instead of requiring a separate
  // manual "Prepare Wise payment run" step.
  let wisePreparedAutomatically = false;
  let wisePreparationError: string | null = null;
  if (isWiseConfigured()) {
    try {
      if (decision === 'APPROVED' && paymentStatus === 'READY') {
        await createWisePaymentRun();
        wisePreparedAutomatically = true;
      }

      // Once this approver has no remaining pending approvals in their scope,
      // automatically add any final eligible ready expenses and close the open
      // Wise batch. The approver should only have to fund the completed batch
      // in Wise; there is no web-app Review/Close step.
      await autoCompleteWiseBatchIfApprovalsAreComplete(user.id);
    } catch (error: unknown) {
      // Approval must not be rolled back because Wise preparation/finalisation failed.
      // The expense remains in its approved/ready state and the failure is logged.
      wisePreparationError = errorMessage(error, 'Wise payment preparation failed.');
      console.error('Automatic Wise payment preparation/finalisation failed', { expenseId, error });
    }
  }

  if (expense.relatedExpenseId) {
    const extraAmount = Number(expense.amount);
    const original = await prisma.expense.findUnique({ where: { id: expense.relatedExpenseId }, select: { id: true, advanceAmount: true, actualAmount: true } });
    if (original) {
      const originalAdvance = Number(original.advanceAmount ?? 0);
      const originalActual = Number(original.actualAmount ?? (originalAdvance + extraAmount));
      const originalNote = decision === 'APPROVED'
        ? (wisePreparedAutomatically
          ? `You were advanced £${originalAdvance.toFixed(2)} but the receipt shows £${originalActual.toFixed(2)}. The extra £${extraAmount.toFixed(2)} was approved and has been added to a Wise payment run.`
          : `You were advanced £${originalAdvance.toFixed(2)} but the receipt shows £${originalActual.toFixed(2)}. The extra £${extraAmount.toFixed(2)} was approved and is ready for payment. It will be prepared in Wise automatically when possible.`)
        : `You were advanced £${originalAdvance.toFixed(2)} but the receipt shows £${originalActual.toFixed(2)}. The extra £${extraAmount.toFixed(2)} reimbursement was not approved.`;
      await prisma.expense.update({ where: { id: original.id }, data: { settlementNote: originalNote } });
    }
  }

  if (expense.user.email) {
    const approved = decision === 'APPROVED';
    const extra = expense.relatedExpenseId
      ? (approved
        ? (wisePreparedAutomatically
          ? 'Your extra reimbursement has been approved and the payment batch has been prepared in Wise and is waiting there for funding/confirmation.'
          : 'Your extra reimbursement has been approved and is ready for payment. If Wise preparation could not be completed automatically, it can be prepared from the Payments page.')
        : 'Your extra reimbursement was not approved. Please speak to your approver if you need more information.')
      : expense.purchaseStatus === 'NOT_PURCHASED' && expense.paymentTiming === 'ADVANCE' && approved
        ? (wisePreparedAutomatically
          ? 'Your advance has been approved and the payment batch has been prepared in Wise and is waiting there for funding/confirmation. You must upload the receipt after the purchase.'
          : 'Your advance has been approved and is ready for payment. You must upload the receipt after the purchase.')
        : approved
            ? (wisePreparedAutomatically
              ? 'Your reimbursement has been approved and the payment batch has been prepared in Wise and is waiting there for funding/confirmation.'
              : wisePreparationError
                ? 'Your reimbursement was approved, but the Wise batch could not be prepared automatically. It remains ready to pay and can be prepared from the Payments page.'
                : 'It can now move to payment.')
            : 'The approver did not approve this expense.';
    const { html, text } = renderEmail({
      heading: approved ? 'Your expense was approved' : 'Your expense was declined',
      intro: extra,
      card: { amountLabel: `£${expense.amount.toFixed(2)}`, description: expense.description, note: note ? `Note: ${note}` : undefined },
      ctaPath: '/dashboard/expense-history',
      ctaLabel: 'View expense',
    });
    await notify(expense.user.email, `${approved ? 'Approved' : 'Declined'} expense - £${expense.amount.toFixed(2)}`, html, text);
  }

  revalidatePath('/dashboard/approvals'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard');
}

export async function markExpensePurchased(formData: FormData) {
  const user = await requireUser();
  const expenseId = String(formData.get('expenseId') || '');
  const date = String(formData.get('purchaseDate') || '');
  const receiptUrl = String(formData.get('receiptUrl') || '') || null;
  const actualAmount = parseMoney(formData.get('actualAmount'));
  if (!expenseId || !date || Number.isNaN(new Date(date).getTime())) throw new Error('Choose a valid purchase date.');
  if (!receiptUrl) throw new Error('Upload the receipt before confirming the purchase.');

  const expense = await prisma.expense.findUnique({ where: { id: expenseId }, include: { team: true } });
  if (!expense || expense.userId !== user.id) throw new Error('Expense not found.');
  if (expense.status !== 'ADVANCE_PAID_AWAITING_RECEIPT') throw new Error('This expense is not waiting for its receipt.');

  if (expense.status === 'ADVANCE_PAID_AWAITING_RECEIPT') {
    const advance = Number(expense.advanceAmount ?? expense.amount);
    const difference = roundMoney(advance - actualAmount);
    let settlementStatus: 'SETTLED' | 'BALANCE_TO_RETURN' | 'ADDITIONAL_REIMBURSEMENT_REQUIRED';
    let settlementNote: string | null = null;
    if (difference === 0) {
      settlementStatus = 'SETTLED';
    } else if (difference > 0) {
      settlementStatus = 'BALANCE_TO_RETURN';
      settlementNote = `You were advanced £${advance.toFixed(2)} but the receipt shows £${actualAmount.toFixed(2)}. Please arrange to return the £${difference.toFixed(2)} balance to Proclaim - speak to your approver about how to do this.`;
    } else {
      settlementStatus = 'ADDITIONAL_REIMBURSEMENT_REQUIRED';
      settlementNote = `You were advanced £${advance.toFixed(2)} but the receipt shows £${actualAmount.toFixed(2)}. The extra £${Math.abs(difference).toFixed(2)} has been queued as a separate reimbursement and will be paid out via Wise once an approver runs the next payment batch.`;
    }

    await prisma.expense.update({
      where: { id: expenseId },
      data: { purchasedAt: new Date(date), receiptUrl, actualAmount, receiptDueAt: null, lastReminderAt: null, status: 'PAID', settlementStatus, settlementNote },
    });

    if (settlementStatus === 'SETTLED' && user.email) {
      const { html, text } = renderEmail({
        heading: 'Your expense has been paid',
        intro: `Your advance for ${expense.team.name} exactly matched the receipt, so nothing further is owed either way.`,
        card: { amountLabel: `£${actualAmount.toFixed(2)}`, description: expense.description },
        ctaPath: '/dashboard/expense-history',
        ctaLabel: 'View expense',
      });
      await notify(user.email, `Expense paid - £${actualAmount.toFixed(2)}`, html, text);
    }

    // An extra reimbursement must be approved again. It is created as a
    // normal pending expense and linked to the original advance. Once an
    // approver approves it, decideExpense() automatically prepares the next
    // Wise payment run just like any other approved reimbursement.
    if (settlementStatus === 'ADDITIONAL_REIMBURSEMENT_REQUIRED') {
      const extraAmount = Math.abs(difference);
      const extra = await prisma.expense.create({
        data: {
          teamId: expense.teamId,
          userId: expense.userId,
          description: `Additional reimbursement - ${expense.description}`,
          amount: extraAmount,
          purchaseStatus: 'ALREADY_PURCHASED',
          paymentTiming: 'AFTER_PURCHASE',
          date: new Date(date),
          receiptUrl,
          purchasedAt: new Date(date),
          actualAmount: extraAmount,
          status: 'PENDING',
          paymentStatus: 'NOT_READY',
          settlementStatus: 'NOT_APPLICABLE',
          decisionNote: `Additional reimbursement requires approval after reconciling the advance on "${expense.description}".`,
          relatedExpenseId: expense.id,
        },
      });
      await recordAuditEvent({ actor: user, action: 'ADDITIONAL_REIMBURSEMENT_CREATED', entityType: 'EXPENSE', entityId: extra.id, expenseId: extra.id, teamId: expense.teamId, targetUserId: expense.userId, summary: `Additional reimbursement created for £${extraAmount.toFixed(2)}`, metadata: { relatedExpenseId: expense.id, advanceAmount: advance, actualAmount, extraAmount } });
      const approverEmails = [...new Set(expense.team.approverEmails.map(e => e.trim().toLowerCase()).filter(Boolean))];
      const { html, text } = renderEmail({
        heading: 'Extra reimbursement needs approval',
        intro: `An advance reconciliation has created an additional reimbursement for ${expense.userId === user.id ? (user.name || user.email || 'the requester') : 'the requester'}.`,
        card: { amountLabel: `£${extraAmount.toFixed(2)}`, description: expense.description, note: `The requester was advanced £${advance.toFixed(2)} and the receipt shows £${actualAmount.toFixed(2)}.` },
        ctaPath: '/dashboard/approvals',
        ctaLabel: 'Review reimbursement',
      });
      await notify(approverEmails, `Extra reimbursement needs approval - £${extraAmount.toFixed(2)}`, html, text);
      settlementNote = `You were advanced £${advance.toFixed(2)} but the receipt shows £${actualAmount.toFixed(2)}. The extra £${extraAmount.toFixed(2)} has been submitted as a separate reimbursement and is waiting for approver approval.`;
      await prisma.expense.update({ where: { id: expense.id }, data: { settlementNote } });
    }

    await recordAuditEvent({ actor: user, action: 'EXPENSE_PURCHASE_CONFIRMED', entityType: 'EXPENSE', entityId: expenseId, expenseId, teamId: expense.teamId, targetUserId: expense.userId, summary: `Purchase confirmed and receipt recorded`, metadata: { actualAmount, advanceAmount: advance, difference, settlementStatus, receiptAttached: true } });

    if (user.email && settlementNote) {
      const { html, text } = renderEmail({
        heading: expense.description,
        intro: settlementNote,
      });
      await notify(user.email, settlementStatus === 'BALANCE_TO_RETURN' ? 'Balance owed back to Proclaim' : 'Extra reimbursement due to you', html, text);
    }
  } else {
    await prisma.expense.update({ where: { id: expenseId }, data: { purchasedAt: new Date(date), receiptUrl, actualAmount, receiptDueAt: null, lastReminderAt: null, status: 'READY_TO_PAY', paymentStatus: 'READY', settlementStatus: 'NOT_APPLICABLE' } });
    await recordAuditEvent({ actor: user, action: 'EXPENSE_PURCHASE_CONFIRMED', entityType: 'EXPENSE', entityId: expenseId, expenseId, teamId: expense.teamId, targetUserId: expense.userId, summary: 'Purchase confirmed and receipt recorded', metadata: { actualAmount, receiptAttached: true } });
  }
  revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard'); revalidatePath('/dashboard/payments');
}

export async function updateBankDetails(formData: FormData) {
  const user = await requireUser();
  const accountName = String(formData.get('bankAccountName') || '').trim();
  const sortCode = String(formData.get('bankSortCode') || '').replace(/\D/g, '');
  const accountNumber = String(formData.get('bankAccountNumber') || '').replace(/\D/g, '');
  if (!accountName) throw new Error('Enter the account name.');
  if (!/^\d{6}$/.test(sortCode)) throw new Error('Sort code must contain 6 digits.');
  if (!/^\d{8}$/.test(accountNumber)) throw new Error('Account number must contain 8 digits.');
  await prisma.user.update({ where: { id: user.id }, data: { bankAccountName: encryptBankDetail(accountName), bankSortCode: encryptBankDetail(sortCode), bankAccountNumber: encryptBankDetail(accountNumber) } });
  await recordAuditEvent({ actor: user, action: 'BANK_DETAILS_UPDATED', entityType: 'USER', entityId: user.id, targetUserId: user.id, summary: 'Bank payout details updated', metadata: { sortCodeLast4: sortCode.slice(-4), accountNumberLast4: accountNumber.slice(-4) } });
  revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/payments');
}
