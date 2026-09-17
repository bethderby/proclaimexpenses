'use server';

import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptBankDetail } from '@/lib/bank';
import { createWiseBatchGroup, addWiseBatchTransfer, completeWiseBatchGroup, cancelWiseBatchGroup, createWiseQuote, createWiseRecipient, getWiseBatchGroup, getWiseTransfer, getWiseTransferRequirements, getWiseTransferDetails, cancelWiseTransfer, isWiseConfigured, validateWiseReference } from '@/lib/wise';
import { decryptBankDetail } from '@/lib/bank';
import { deterministicWiseTransactionId, syncWisePaymentRunById } from '@/lib/wise-sync';

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)); }

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return session.user as any;
}

async function getTeamApproverEmails(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error('That team no longer exists.');
  const approverEmails = [...new Set(team.approverEmails.map(e => e.trim().toLowerCase()).filter(Boolean))];
  if (!approverEmails.length) throw new Error('That team does not have an approver configured yet. Ask an admin to set one.');
  return { team, approverEmails };
}

async function notify(to: string | string[], subject: string, html: string, text: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return;
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, html, text });
    if (result.error) console.error('Email notification failed', result.error);
  } catch (error) { console.error('Email notification failed', error); }
}

export async function submitExpense(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get('teamId') || '');
  const date = String(formData.get('date') || '');
  const description = (formData.get('description') as string)?.trim();
  const amount = parseFloat(String(formData.get('amount') || ''));
  const receiptUrl = String(formData.get('receiptUrl') || '') || null;
  const purchaseStatus = String(formData.get('purchaseStatus') || '') as 'ALREADY_PURCHASED' | 'NOT_PURCHASED';
  const paymentTiming = String(formData.get('paymentTiming') || '') as 'AFTER_PURCHASE' | 'ADVANCE';

  const payoutUser = await prisma.user.findUnique({ where: { id: user.id }, select: { bankAccountName: true, bankSortCode: true, bankAccountNumber: true } });
  const hasBankDetails = !!(payoutUser?.bankAccountName && payoutUser.bankSortCode && payoutUser.bankAccountNumber);
  if (!hasBankDetails) throw new Error('Add your bank details before submitting an expense so you can be paid.');
  if (!teamId) throw new Error('Choose which team this expense is for.');
  if (!description || !amount || amount <= 0) throw new Error('Add a description and an amount greater than zero.');
  if (!date || Number.isNaN(new Date(date).getTime())) throw new Error('Choose a valid date.');
  if (!['ALREADY_PURCHASED', 'NOT_PURCHASED'].includes(purchaseStatus)) throw new Error('Choose whether the item has already been purchased.');
  if (!['AFTER_PURCHASE', 'ADVANCE'].includes(paymentTiming)) throw new Error('Choose when you need the money.');
  if (purchaseStatus === 'ALREADY_PURCHASED' && !receiptUrl) throw new Error('A receipt is required when the item has already been purchased.');
  if (purchaseStatus === 'ALREADY_PURCHASED' && paymentTiming !== 'AFTER_PURCHASE') throw new Error('An already-purchased expense cannot request an advance.');

  const { team, approverEmails } = await getTeamApproverEmails(teamId);
  const isAlreadyPurchased = purchaseStatus === 'ALREADY_PURCHASED';
  const receiptDueAt = isAlreadyPurchased ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

  const requester = escapeHtml(user.name || user.email || 'A person');
  const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const approvalUrl = `${appUrl}/dashboard/approvals`;
  const purchaseText = purchaseStatus === 'ALREADY_PURCHASED'
    ? 'The item has already been purchased and a receipt is attached.'
    : paymentTiming === 'ADVANCE'
      ? 'The requester has not bought the item and needs an advance before purchase.'
      : 'The requester has not bought the item and can pay personally after approval, then claim reimbursement with a receipt.';

  await notify(
    approverEmails,
    `Expense needs approval - £${amount.toFixed(2)}`,
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2>New expense needs approval</h2><p style="color:#64748b">${requester} submitted an expense for <strong>${escapeHtml(team.name)}</strong>.</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${amount.toFixed(2)}</p><p style="margin:0;color:#475569">${escapeHtml(description)}</p><p style="margin:8px 0 0;color:#64748b">${escapeHtml(purchaseText)}</p></div>${approvalUrl ? `<a href="${approvalUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Review expense</a>` : ''}<p style="margin-top:28px;font-size:12px;color:#94a3b8">Proclaim Expenses</p></div>`,
    `${requester} submitted a £${amount.toFixed(2)} expense for ${team.name}.\n\n${description}\n\n${purchaseText}\n\n${approvalUrl || 'Open Proclaim Expenses to review it.'}`
  );

  revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/approvals'); revalidatePath('/dashboard');
  redirect('/dashboard/expenses');
}

export async function updateExpense(formData: FormData) {
  const user = await requireUser();
  const expenseId = String(formData.get('expenseId') || '');
  const teamId = String(formData.get('teamId') || '');
  const date = String(formData.get('date') || '');
  const description = (formData.get('description') as string)?.trim();
  const amount = parseFloat(String(formData.get('amount') || ''));
  if (!expenseId || !teamId) throw new Error('Expense not found.');
  if (!description || !amount || amount <= 0) throw new Error('Add a description and an amount greater than zero.');
  if (!date || Number.isNaN(new Date(date).getTime())) throw new Error('Choose a valid date.');
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, userId: user.id } });
  if (!expense) throw new Error('You can only edit your own expenses.');
  if (expense.status !== 'PENDING') throw new Error('Only expenses still awaiting approval can be edited.');
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error('That team no longer exists.');
  await prisma.expense.update({ where: { id: expenseId }, data: { date: new Date(date), description, amount, teamId } });
  revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard');
}

export async function cancelExpense(formData: FormData) {
  const user = await requireUser();
  const expenseId = String(formData.get('expenseId') || '');
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.userId !== user.id) throw new Error('Expense not found.');
  if (expense.status !== 'PENDING' && expense.status !== 'AWAITING_PURCHASE') throw new Error('This expense can no longer be cancelled.');
  await prisma.expense.update({ where: { id: expenseId }, data: { status: 'CANCELLED' } });
  revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/approvals'); revalidatePath('/dashboard');
}

export async function decideExpense(expenseId: string, decision: 'APPROVED' | 'REJECTED', note: string) {
  const user = await requireUser();
  const expense = await prisma.expense.findUnique({ where: { id: expenseId }, include: { team: true, user: true } });
  if (!expense) throw new Error('Expense not found.');
  const email = (user.email ?? '').toLowerCase();
  const isTeamApprover = !!email && expense.team.approverEmails.some(e => e.toLowerCase() === email);
  if (!user.isAdmin && !isTeamApprover) throw new Error("Only this team's configured approver can decide this expense.");
  if (expense.status !== 'PENDING') throw new Error('This expense has already been decided.');
  if (decision === 'APPROVED' && expense.purchaseStatus === 'ALREADY_PURCHASED' && !expense.receiptUrl) throw new Error('A receipt is required before an already-purchased expense can be approved.');

  let nextStatus: 'APPROVED' | 'AWAITING_PURCHASE' | 'READY_TO_PAY' = 'APPROVED';
  let paymentStatus: 'NOT_READY' | 'READY' = 'NOT_READY';
  if (decision === 'APPROVED') {
    if (expense.purchaseStatus === 'NOT_PURCHASED') nextStatus = 'AWAITING_PURCHASE';
    else nextStatus = 'READY_TO_PAY';
    if (expense.purchaseStatus === 'ALREADY_PURCHASED') paymentStatus = 'READY';
    else if (expense.paymentTiming === 'ADVANCE') paymentStatus = 'READY';
  }

  await prisma.expense.update({ where: { id: expenseId }, data: { status: decision === 'REJECTED' ? 'REJECTED' : nextStatus, paymentStatus, approvedAmount: decision === 'APPROVED' ? expense.amount : null, decisionNote: note || null, decidedAt: new Date() } });

  // Once an approval makes the expense payable, immediately prepare the
  // current ready-to-pay set in Wise. This means the Wise batch is already
  // waiting in Wise for funding/confirmation instead of requiring a separate
  // manual "Prepare Wise payment run" step.
  let wisePreparedAutomatically = false;
  let wisePreparationError: string | null = null;
  if (decision === 'APPROVED' && paymentStatus === 'READY' && isWiseConfigured()) {
    try {
      await createWisePaymentRun();
      wisePreparedAutomatically = true;
    } catch (error: any) {
      // Approval must not be rolled back because Wise preparation failed.
      // The expense remains READY and can be prepared manually from Payments.
      wisePreparationError = error?.message || 'Wise payment preparation failed.';
      console.error('Automatic Wise payment run preparation failed', { expenseId, error });
    }
  }

  if (expense.relatedExpenseId) {
    const extraAmount = expense.amount;
    const original = await prisma.expense.findUnique({ where: { id: expense.relatedExpenseId }, select: { id: true, advanceAmount: true, actualAmount: true } });
    if (original) {
      const originalAdvance = original.advanceAmount ?? 0;
      const originalActual = original.actualAmount ?? (originalAdvance + extraAmount);
      const originalNote = decision === 'APPROVED'
        ? (wisePreparedAutomatically
          ? `You were advanced £${originalAdvance.toFixed(2)} but the receipt shows £${originalActual.toFixed(2)}. The extra £${extraAmount.toFixed(2)} was approved and has been added to a Wise payment run.`
          : `You were advanced £${originalAdvance.toFixed(2)} but the receipt shows £${originalActual.toFixed(2)}. The extra £${extraAmount.toFixed(2)} was approved and is ready for payment. It will be prepared in Wise automatically when possible.`)
        : `You were advanced £${originalAdvance.toFixed(2)} but the receipt shows £${originalActual.toFixed(2)}. The extra £${extraAmount.toFixed(2)} reimbursement was not approved.`;
      await prisma.expense.update({ where: { id: original.id }, data: { settlementNote: originalNote } });
    }
  }

  if (expense.user.email) {
    const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    const expensesUrl = `${appUrl}/dashboard/expense-history`;
    const approved = decision === 'APPROVED';
    const extra = expense.relatedExpenseId
      ? (approved
        ? (wisePreparedAutomatically
          ? 'Your extra reimbursement has been approved and the payment batch has been prepared in Wise and is waiting there for funding/confirmation.'
          : 'Your extra reimbursement has been approved and is ready for payment. If Wise preparation could not be completed automatically, it can be prepared from the Payments page.')
        : 'Your extra reimbursement was not approved. Please speak to your approver if you need more information.')
      : expense.purchaseStatus === 'NOT_PURCHASED' && expense.paymentTiming === 'ADVANCE' && approved
        ? (wisePreparedAutomatically
          ? 'Your advance has been approved and the payment batch has been prepared in Wise and is waiting there for funding/confirmation.'
          : 'Your advance has been approved and is ready for a Wise payment run. If Wise preparation could not be completed automatically, it can be prepared from the Payments page.')
        : expense.purchaseStatus === 'NOT_PURCHASED' && approved
          ? 'Once you buy the item, open Expense History, mark it as purchased, upload the receipt and it will become ready for reimbursement.'
          : approved
            ? (wisePreparedAutomatically
              ? 'Your reimbursement has been approved and the payment batch has been prepared in Wise and is waiting there for funding/confirmation.'
              : wisePreparationError
                ? 'Your reimbursement was approved, but the Wise batch could not be prepared automatically. It remains ready to pay and can be prepared from the Payments page.'
                : 'It can now move to payment.')
            : 'The approver did not approve this expense.';
    await notify(
      expense.user.email,
      `${approved ? 'Approved' : 'Declined'} expense - £${expense.amount.toFixed(2)}`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2>${approved ? 'Your expense was approved' : 'Your expense was declined'}</h2><p style="color:#64748b">${escapeHtml(extra)}</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${expense.amount.toFixed(2)}</p><p style="margin:0">${escapeHtml(expense.description)}</p>${note ? `<p style="margin:14px 0 0;color:#475569"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}</div>${expensesUrl ? `<a href="${expensesUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">View expense</a>` : ''}</div>`,
      `${approved ? 'Approved' : 'Declined'} expense: £${expense.amount.toFixed(2)} - ${expense.description}.\n\n${extra}${note ? `\n\nNote: ${note}` : ''}`
    );
  }

  revalidatePath('/dashboard/approvals'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard');
}

export async function markExpensePurchased(formData: FormData) {
  const user = await requireUser();
  const expenseId = String(formData.get('expenseId') || '');
  const date = String(formData.get('purchaseDate') || '');
  const receiptUrl = String(formData.get('receiptUrl') || '') || null;
  const actualAmount = parseFloat(String(formData.get('actualAmount') || ''));
  if (!expenseId || !date || Number.isNaN(new Date(date).getTime())) throw new Error('Choose a valid purchase date.');
  if (!receiptUrl) throw new Error('Upload the receipt before confirming the purchase.');
  if (!actualAmount || actualAmount <= 0) throw new Error('Enter the actual amount shown on the receipt.');
  const expense = await prisma.expense.findUnique({ where: { id: expenseId }, include: { team: true } });
  if (!expense || expense.userId !== user.id) throw new Error('Expense not found.');
  if (expense.status !== 'AWAITING_PURCHASE' && expense.status !== 'ADVANCE_PAID_AWAITING_RECEIPT') throw new Error('This expense is not waiting for a purchase or receipt.');

  if (expense.status === 'ADVANCE_PAID_AWAITING_RECEIPT') {
    const advance = expense.advanceAmount ?? expense.amount;
    const difference = Number((advance - actualAmount).toFixed(2));
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
      const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const expensesUrl = `${appUrl}/dashboard/expense-history`;
      await notify(
        user.email,
        `Expense paid - £${actualAmount.toFixed(2)}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2>Your expense has been paid</h2><p style="color:#64748b">Your advance for <strong>${escapeHtml(expense.team.name)}</strong> exactly matched the receipt, so nothing further is owed either way.</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${actualAmount.toFixed(2)}</p><p style="margin:0">${escapeHtml(expense.description)}</p></div>${expensesUrl ? `<a href="${expensesUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">View expense</a>` : ''}</div>`,
        `Your expense "${expense.description}" (£${actualAmount.toFixed(2)}) has been paid - your advance exactly matched the receipt, so there's nothing further owed.\n\n${expensesUrl || ''}`
      );
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
      const approverEmails = [...new Set(expense.team.approverEmails.map(e => e.trim().toLowerCase()).filter(Boolean))];
      const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const approvalUrl = `${appUrl}/dashboard/approvals`;
      await notify(
        approverEmails,
        `Extra reimbursement needs approval - £${extraAmount.toFixed(2)}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2>Extra reimbursement needs approval</h2><p style="color:#64748b">An advance reconciliation has created an additional reimbursement for <strong>${escapeHtml(expense.userId === user.id ? (user.name || user.email || 'the requester') : 'the requester')}</strong>.</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${extraAmount.toFixed(2)}</p><p style="margin:0;color:#475569">${escapeHtml(expense.description)}</p><p style="margin:8px 0 0;color:#64748b">The requester was advanced £${advance.toFixed(2)} and the receipt shows £${actualAmount.toFixed(2)}.</p></div>${approvalUrl ? `<a href="${approvalUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Review reimbursement</a>` : ''}<p style="margin-top:28px;font-size:12px;color:#94a3b8">Proclaim Expenses</p></div>`,
        `An extra reimbursement of £${extraAmount.toFixed(2)} needs approval for ${expense.description}.

${approvalUrl || 'Open Proclaim Expenses to review it.'}`
      );
      settlementNote = `You were advanced £${advance.toFixed(2)} but the receipt shows £${actualAmount.toFixed(2)}. The extra £${extraAmount.toFixed(2)} has been submitted as a separate reimbursement and is waiting for approver approval.`;
      await prisma.expense.update({ where: { id: expense.id }, data: { settlementNote } });
    }


    if (user.email && settlementNote) {
      await notify(
        user.email,
        settlementStatus === 'BALANCE_TO_RETURN' ? 'Balance owed back to Proclaim' : 'Extra reimbursement due to you',
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2 style="margin-bottom:8px">${escapeHtml(expense.description)}</h2><p style="color:#475569">${escapeHtml(settlementNote)}</p></div>`,
        settlementNote,
      );
    }
  } else {
    await prisma.expense.update({ where: { id: expenseId }, data: { purchasedAt: new Date(date), receiptUrl, actualAmount, receiptDueAt: null, lastReminderAt: null, status: 'READY_TO_PAY', paymentStatus: 'READY', settlementStatus: 'NOT_APPLICABLE' } });
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
  revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/payments');
}

async function acquireWiseBatchLease() {
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

async function releaseWiseBatchLease(token: string) {
  await prisma.$executeRaw`
    UPDATE "WiseBatchLock"
    SET "lockToken" = NULL, "lockedUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = 'default' AND "lockToken" = ${token}
  `;
}

async function markClosedWiseRun(runId: string, status: string) {
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

async function findOrCreateOpenWiseRun(userId: string) {
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

async function findExistingWiseTransferInBatch(batchId: string, customerTransactionId: string) {
  const batch = await getWiseBatchGroup(batchId);
  const transferIds = Array.isArray(batch.transferIds) ? batch.transferIds.map((id: unknown) => String(id)) : [];
  for (const transferId of transferIds) {
    const transfer = await getWiseTransfer(transferId);
    if (String(transfer.customerTransactionId || '') === customerTransactionId) return transfer;
  }
  return null;
}

async function addExpensesToOpenWiseBatch(expenseIds: string[], userId: string) {
  const leaseToken = await acquireWiseBatchLease();
  try {
    const uniqueExpenseIds = [...new Set(expenseIds.filter(Boolean))];
    if (!uniqueExpenseIds.length) return null;

    let run = await findOrCreateOpenWiseRun(userId);
    if (!run.wiseBatchGroupId) throw new Error('The open Wise batch does not have a Wise batch ID.');

    const batchBefore = await getWiseBatchGroup(run.wiseBatchGroupId);
    const existingTransferCount = Array.isArray(batchBefore.transferIds) ? batchBefore.transferIds.length : 0;
    if (existingTransferCount + uniqueExpenseIds.length > 1000) {
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

        const recipientIdNumber = Number(recipientId);
        if (!Number.isSafeInteger(recipientIdNumber)) throw new Error(`Invalid Wise recipient ID for expense ${expense.id}.`);
        const quote = await createWiseQuote(recipientIdNumber, expense.amount);
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
            data: { paymentRunId: null, paymentStatus: 'READY', status: expense.purchaseStatus === 'NOT_PURCHASED' ? 'AWAITING_PURCHASE' : 'READY_TO_PAY', paymentReference: null, wiseBatchGroupId: null, wiseTransferId: null, wiseStatus: null },
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

export async function createWisePaymentRun() {
  const user = await requireUser();
  if (!user.isAdmin && !user.isApprover) throw new Error('Only approvers or admins can create payment runs.');
  if (!isWiseConfigured()) throw new Error('Wise is not configured. Add WISE_API_TOKEN and WISE_PROFILE_ID first.');

  const approverEmail = (user.email ?? '').toLowerCase();
  const where: any = user.isAdmin
    ? { paymentStatus: 'READY', paymentRunId: null }
    : { paymentStatus: 'READY', paymentRunId: null, team: { approverEmails: { has: approverEmail } } };

  const expenses = await prisma.expense.findMany({
    where,
    include: { user: true },
    orderBy: { submittedAt: 'asc' },
  });
  const eligible = expenses.filter(e => e.user.bankAccountName && e.user.bankSortCode && e.user.bankAccountNumber);
  if (!eligible.length) throw new Error('No ready expenses with complete bank details are available.');

  await addExpensesToOpenWiseBatch(eligible.map(e => e.id), user.id);
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
    const run = await prisma.paymentRun.findUnique({ where: { id: runId }, include: { expenses: { include: { team: true } } } });
    if (!run) throw new Error('Payment run not found.');
    if (run.status !== 'WISE_OPEN' || !run.wiseBatchGroupId) throw new Error('This payment batch is not open for completion.');
    if (!user.isAdmin) {
      const email = (user.email ?? '').toLowerCase();
      const allowed = run.expenses.some(e => e.team.approverEmails.some(a => a.toLowerCase() === email));
      if (!allowed) throw new Error('You are not authorised to close this payment batch.');
    }

    const batch = await getWiseBatchGroup(run.wiseBatchGroupId);
    const batchStatus = String(batch.status || '').toUpperCase();
    if (batchStatus === 'COMPLETED') {
      await prisma.paymentRun.update({ where: { id: run.id }, data: { status: 'WISE_PREPARED', wiseStatus: 'COMPLETED', exportedAt: new Date() } });
    } else if (batchStatus === 'NEW') {
      const completed = await completeWiseBatchGroup(run.wiseBatchGroupId, Number(batch.version));
      await prisma.$transaction(async tx => {
        await tx.paymentRun.update({ where: { id: run.id }, data: { status: 'WISE_PREPARED', wiseStatus: String(completed.status || 'COMPLETED'), exportedAt: new Date() } });
        await tx.expense.updateMany({ where: { paymentRunId: run.id }, data: { wiseStatus: 'prepared' } });
      });
    } else {
      throw new Error(`Wise reports this batch as ${batchStatus.toLowerCase()}, so it cannot be completed here.`);
    }
  } finally {
    await releaseWiseBatchLease(leaseToken);
  }

  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard/expenses');
  revalidatePath('/dashboard/expense-history');
}


export async function syncWisePaymentRun(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin && !user.isApprover) throw new Error('Only approvers or admins can sync payment runs.');
  const runId = String(formData.get('runId') || '');
  if (!runId) throw new Error('Payment run not found.');
  await syncWisePaymentRunById(runId);
  revalidatePath('/dashboard/payments'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard');
}

export async function cancelPaymentRun(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin && !user.isApprover) throw new Error('Only approvers or admins can cancel payment runs.');
  const runId = String(formData.get('runId') || '');
  const run = await prisma.paymentRun.findUnique({ where: { id: runId }, include: { expenses: true } });
  if (!run) throw new Error('Payment run not found.');
  if (run.status === 'COMPLETED') throw new Error('A completed payment run cannot be cancelled.');

  const batchLeaseToken = run.status === 'WISE_OPEN' ? await acquireWiseBatchLease() : null;
  try {
  if (run.wiseBatchGroupId) {
    const batch = await getWiseBatchGroup(run.wiseBatchGroupId);
    const batchStatus = String(batch.status || '').toUpperCase();

    if (batchStatus === 'COMPLETED' || batchStatus === 'NEW' || ['MARKED_FOR_CANCELLATION','PROCESSING_CANCEL'].includes(batchStatus)) {
      const transferIds = Array.isArray(batch.transferIds) ? batch.transferIds.map((id: unknown) => String(id)) : [];
      const localTransferIds = run.expenses.map(e => e.wiseTransferId).filter(Boolean).map(String);
      const allTransferIds = [...new Set([...transferIds, ...localTransferIds])];
      for (const transferId of allTransferIds) {
        const transfer = await getWiseTransfer(transferId);
        const state = String(transfer.status || '').toLowerCase();
        if (state === 'incoming_payment_waiting') {
          await cancelWiseTransfer(transferId);
        } else if (!['cancelled','bounced_back','funds_refunded'].includes(state)) {
          throw new Error(`Wise transfer ${transferId} cannot be cancelled because it is already ${transfer.status}.`);
        }
      }
    }

    // If the batch itself is still editable, cancel it too. A completed batch
    // is closed; its individual unfunded transfers were handled above.
    if (batchStatus === 'NEW') {
      await cancelWiseBatchGroup(run.wiseBatchGroupId, Number(batch.version));
    } else if (batchStatus === 'MARKED_FOR_CANCELLATION' || batchStatus === 'PROCESSING_CANCEL') {
      // Wise is already cancelling it; keep the local run locked until the
      // next sync observes CANCELLED.
      throw new Error('Wise is still cancelling this batch. Sync Wise status again in a moment.');
    }
  }

  await prisma.$transaction(async tx => {
    await tx.paymentRun.update({ where: { id: runId }, data: { status: 'CANCELLED', wiseStatus: 'cancelled', preparationKey: null } });
    await tx.expense.updateMany({ where: { paymentRunId: runId, status: 'PAYMENT_PENDING', purchaseStatus: 'NOT_PURCHASED' }, data: { paymentRunId: null, paymentStatus: 'READY', status: 'AWAITING_PURCHASE', paymentReference: null, wiseBatchGroupId: null, wiseTransferId: null, wiseStatus: null } });
    await tx.expense.updateMany({ where: { paymentRunId: runId, status: 'PAYMENT_PENDING', purchaseStatus: 'ALREADY_PURCHASED' }, data: { paymentRunId: null, paymentStatus: 'READY', status: 'READY_TO_PAY', paymentReference: null, wiseBatchGroupId: null, wiseTransferId: null, wiseStatus: null } });
  });
  } finally {
    if (batchLeaseToken) await releaseWiseBatchLease(batchLeaseToken);
  }
  revalidatePath('/dashboard/payments'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history');
}

export async function updateBudget(teamId: string, target: number) {
  const user = await requireUser();
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error('Team not found.');
  const allowed = user.isAdmin || team.approverEmails.some(e => e.toLowerCase() === (user.email ?? '').toLowerCase());
  if (!allowed) throw new Error("Only this team's configured approver or an admin can change its budget.");
  await prisma.team.update({ where: { id: teamId }, data: { budgetTarget: target } });
  revalidatePath('/dashboard/reports');
}

export async function createTeam(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can add teams.');
  const name = (formData.get('name') as string)?.trim();
  const approverEmails = [...new Set(formData.getAll('approverEmail').map(v => String(v).trim().toLowerCase()).filter(Boolean))];
  const budgetTarget = parseFloat((formData.get('budgetTarget') as string) || '0') || 0;
  if (!name) throw new Error('A team name is required.');
  if (!approverEmails.length || approverEmails.some(e => !e.includes('@'))) throw new Error('Add at least one valid approver email.');
  await prisma.team.create({ data: { name, approverEmails, budgetTarget } });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/approvals');
}

export async function updateTeam(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can edit teams.');
  const teamId = String(formData.get('teamId') || '');
  const name = (formData.get('name') as string)?.trim();
  const approverEmails = [...new Set(formData.getAll('approverEmail').map(v => String(v).trim().toLowerCase()).filter(Boolean))];
  const budgetTarget = parseFloat((formData.get('budgetTarget') as string) || '0') || 0;
  if (!teamId || !name) throw new Error('A team name is required.');
  if (!approverEmails.length || approverEmails.some(e => !e.includes('@'))) throw new Error('Add at least one valid approver email.');
  await prisma.team.update({ where: { id: teamId }, data: { name, approverEmails, budgetTarget } });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/approvals'); revalidatePath('/dashboard/reports'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history');
}

export async function deleteTeam(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get('teamId') || '');
  if (!user.isAdmin) throw new Error('Only admins can delete teams.');
  if (!teamId) throw new Error('Team not found.');
  await prisma.$transaction(async tx => {
    await tx.expense.deleteMany({ where: { teamId } });
    await tx.team.delete({ where: { id: teamId } });
  });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/reports'); revalidatePath('/dashboard/approvals');
}

export async function setAdminStatus(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can manage administrators.');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const isAdmin = String(formData.get('isAdmin')) === 'true';
  if (!email) throw new Error('Email is required.');
  if (!isAdmin && email === (user.email ?? '').toLowerCase()) throw new Error('You cannot remove your own admin access.');
  await prisma.user.upsert({ where: { email }, update: { isAdmin, ...(isAdmin ? { removedAt: null } : {}) }, create: { email, isAdmin } });
  revalidatePath('/dashboard/teams');
}

export async function removeUser(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can remove users.');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required.');
  if (email === (user.email ?? '').toLowerCase()) throw new Error('You cannot remove your own account.');
  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) throw new Error('User not found.');
  if (target.removedAt) return;
  await prisma.$transaction(async tx => {
    await tx.session.deleteMany({ where: { userId: target.id } });
    // Reset their account, not their history: clear stored payout bank
    // details (no reason to keep live bank credentials for someone no
    // longer active) but leave every Expense/PaymentRun row untouched -
    // those stay linked to this User row for accounting.
    await tx.user.update({ where: { id: target.id }, data: { isAdmin: false, removedAt: new Date(), bankAccountName: null, bankSortCode: null, bankAccountNumber: null } });
  });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/approvals'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history');
}

function parseReportRecipients(value: string) {
  return [...new Set(value.split(/[\n,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export async function sendReportNow(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can send reports.');
  const startValue = String(formData.get('start') || ''); const endValue = String(formData.get('end') || '');
  if (!startValue || !endValue) throw new Error('Choose a start and end date.');
  const start = new Date(`${startValue}T00:00:00`); const end = new Date(`${endValue}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new Error('Choose a valid date range.');
  const schedule = await prisma.reportSchedule.findUnique({ where: { id: 'default' }, select: { recipients: true } });
  const { sendCombinedReport } = await import('@/lib/report');
  await sendCombinedReport(start, new Date(end.getTime() + 1), { manual: true, recipients: schedule?.recipients ?? [] });
  revalidatePath('/dashboard/reports');
}

export async function saveReportSchedule(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can change report settings.');
  const enabled = String(formData.get('enabled') || '') === 'true';
  const dayOfMonth = Number(formData.get('dayOfMonth'));
  const hour = 6;
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) throw new Error('Choose a day from 1 to 28.');
  const recipients = parseReportRecipients(String(formData.get('recipients') || ''));
  for (const email of recipients) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Invalid recipient email: ${email}`);
  }
  await prisma.reportSchedule.upsert({
    where: { id: 'default' },
    update: { enabled, dayOfMonth, hour, timezone: 'Europe/London', recipients },
    create: { id: 'default', enabled, dayOfMonth, hour, timezone: 'Europe/London', recipients },
  });
  revalidatePath('/dashboard/reports');
}
