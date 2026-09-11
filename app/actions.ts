'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)); }

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return session.user as any;
}

// Ask for permission to spend money. Goes to the chosen team's approver.
export async function submitRequest(formData: FormData) {
  const user = await requireUser();

  const teamId = String(formData.get('teamId') || '');
  const date = String(formData.get('date') || '');
  const description = (formData.get('description') as string)?.trim();
  const amount = parseFloat(String(formData.get('amount') || ''));

  if (!teamId) throw new Error('Choose which team this request is for.');
  if (!description || !amount || amount <= 0) {
    throw new Error('Add a description and an amount greater than zero.');
  }
  if (!date || Number.isNaN(new Date(date).getTime())) throw new Error('Choose a valid date.');

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error('That team no longer exists.');
  if (!team.approverEmail) throw new Error('That team does not have an approver configured yet. Ask an admin to set one.');

  const request = await prisma.fundingRequest.create({
    data: {
      date: new Date(date),
      description,
      amount,
      status: 'PENDING',
      teamId,
      userId: user.id,
    },
  });

  // Routing is determined solely by the selected team. One user can submit
  // requests to any number of teams; no team membership is required.
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const requester = escapeHtml(user.name || user.email || 'A team member');
      const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const approvalUrl = `${appUrl}/dashboard/approvals`;
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM,
        to: team.approverEmail,
        subject: `Expense request needs approval — £${amount.toFixed(2)}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2 style="margin-bottom:8px">New expense request</h2><p style="color:#64748b">${requester} submitted a request for <strong>${escapeHtml(team.name)}</strong>.</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${amount.toFixed(2)}</p><p style="margin:0;color:#475569">${escapeHtml(description)}</p></div>${approvalUrl ? `<a href="${approvalUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Review request</a>` : '<p>Open Proclaim Expenses to review the request.</p>'}<p style="margin-top:28px;font-size:12px;color:#94a3b8">Proclaim Expenses</p></div>`,
        text: `${requester} submitted a £${amount.toFixed(2)} request for ${escapeHtml(team.name)}.\n\n${escapeHtml(description)}\n\n${approvalUrl || 'Open Proclaim Expenses to approve or reject it.'}`,
      });
      if (result.error) console.error('Approver notification failed', result.error);
    } catch (error) {
      console.error('Approver notification failed', error);
    }
  }

  revalidatePath('/dashboard/my-requests');
  revalidatePath('/dashboard/approvals');
  redirect('/dashboard/my-requests');
}

// Record money that has actually been spent, backed by a receipt.
export async function submitExpense(formData: FormData) {
  const user = await requireUser();

  const teamId = String(formData.get('teamId') || '');
  const date = String(formData.get('date') || '');
  const description = (formData.get('description') as string)?.trim();
  const amount = parseFloat(String(formData.get('amount') || ''));
  const receiptUrl = String(formData.get('receiptUrl') || '');
  const requestId = String(formData.get('requestId') || '') || null;

  if (!teamId) throw new Error('Choose which team this expense is for.');
  if (!description || !amount || amount <= 0) {
    throw new Error('Add a description and an amount greater than zero.');
  }
  if (!date || Number.isNaN(new Date(date).getTime())) throw new Error('Choose a valid date.');
  if (!receiptUrl) throw new Error('Upload a receipt.');

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error('That team no longer exists.');

  if (requestId) {
    const request = await prisma.fundingRequest.findFirst({
      where: { id: requestId, userId: user.id, teamId, status: 'APPROVED' },
    });
    if (!request) throw new Error('The selected request is not a valid approved request for this team.');
  }

  await prisma.expense.create({
    data: {
      date: new Date(date),
      description,
      amount,
      receiptUrl,
      teamId,
      userId: user.id,
      requestId: requestId || undefined,
    },
  });

  revalidatePath('/dashboard/expenses');
  revalidatePath('/dashboard/budgets');
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
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error('That team no longer exists.');

  await prisma.expense.update({
    where: { id: expenseId },
    data: { date: new Date(date), description, amount, teamId },
  });
  revalidatePath('/dashboard/expenses');
  revalidatePath('/dashboard/budgets');
}

export async function decideRequest(requestId: string, status: 'APPROVED' | 'REJECTED', note: string) {
  const user = await requireUser();
  const request = await prisma.fundingRequest.findUnique({ where: { id: requestId }, include: { team: true, user: true } });
  if (!request) throw new Error('Request not found.');
  const isAdmin = !!user.isAdmin;
  const isTeamApprover = !!request.team.approverEmail && request.team.approverEmail.toLowerCase() === (user.email ?? '').toLowerCase();
  if (!isAdmin && !isTeamApprover) throw new Error("Only this team's configured approver can decide this request.");
  if (request.status !== 'PENDING') throw new Error('This request has already been decided.');

  await prisma.fundingRequest.update({
    where: { id: requestId },
    data: { status, decisionNote: note || null, decidedAt: new Date() },
  });

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM && request.user.email) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const requestsUrl = `${appUrl}/dashboard/my-requests`;
      const approved = status === 'APPROVED';
      const heading = approved ? 'Your expense request was approved' : 'Your expense request was declined';
      const intro = approved ? 'Good news — your request has been approved.' : 'Your request was not approved.';
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM,
        to: request.user.email,
        subject: `${approved ? 'Approved' : 'Declined'} expense request — £${request.amount.toFixed(2)}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2 style="margin-bottom:8px">${heading}</h2><p style="color:#64748b">${intro}</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><p style="margin:0 0 8px;font-size:20px;font-weight:700">£${request.amount.toFixed(2)}</p><p style="margin:0;color:#475569">${request.description}</p><p style="margin:8px 0 0;color:#64748b">${request.team.name}</p>${note ? `<p style="margin:14px 0 0;color:#475569"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}</div>${requestsUrl ? `<a href="${requestsUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">View my requests</a>` : ''}<p style="margin-top:28px;font-size:12px;color:#94a3b8">Proclaim Expenses</p></div>`,
        text: `${heading}.\n\n£${request.amount.toFixed(2)} — ${request.description} — ${request.team.name}.\n\n${note ? `Note: ${note}\n\n` : ''}${requestsUrl || 'Open Proclaim Expenses to view your requests.'}`,
      });
      if (result.error) console.error('Requester notification failed', result.error);
    } catch (error) {
      console.error('Requester notification failed', error);
    }
  }

  revalidatePath('/dashboard/approvals');
  revalidatePath('/dashboard/my-requests');
}

export async function cancelRequest(formData: FormData) {
  const user = await requireUser();
  const requestId = String(formData.get('requestId') || '');
  if (!requestId) throw new Error('Request not found.');
  const request = await prisma.fundingRequest.findUnique({ where: { id: requestId } });
  if (!request || request.userId !== user.id) throw new Error('Request not found.');
  if (request.status !== 'PENDING') throw new Error('Only requests still awaiting a decision can be cancelled.');

  await prisma.fundingRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED', decidedAt: new Date() } });

  revalidatePath('/dashboard/my-requests');
  revalidatePath('/dashboard/approvals');
}

export async function updateBudget(teamId: string, target: number) {
  const user = await requireUser();
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error('Team not found.');
  const allowed = user.isAdmin || team.approverEmail?.toLowerCase() === (user.email ?? '').toLowerCase();
  if (!allowed) throw new Error("Only this team's approver or an admin can change its budget.");
  await prisma.team.update({ where: { id: teamId }, data: { budgetTarget: target } });
  revalidatePath('/dashboard/budgets');
}

// Admins can add new teams from the portal.
export async function createTeam(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can add teams.');

  const name = (formData.get('name') as string)?.trim();
  const approverEmail = (formData.get('approverEmail') as string)?.trim().toLowerCase() || null;
  const budgetTarget = parseFloat((formData.get('budgetTarget') as string) || '0') || 0;

  if (!name) { throw new Error('A team name is required.'); }
  if (!approverEmail || !approverEmail.includes('@')) throw new Error('A valid approver email is required.');

  await prisma.team.create({
    data: { name, approverEmail, budgetTarget },
  });

  revalidatePath('/dashboard/teams');
  revalidatePath('/dashboard/submit');
  revalidatePath('/dashboard/expenses');
}

// Admins can edit an existing team's approver and budget from the portal.
export async function updateTeam(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can edit teams.');

  const teamId = formData.get('teamId') as string;
  const name = (formData.get('name') as string)?.trim();
  const submittedApprover = (formData.get('approverEmail') as string | null)?.trim().toLowerCase();
  const existingTeam = await prisma.team.findUnique({ where: { id: teamId } });
  if (!existingTeam) throw new Error('Team not found.');
  const approverEmail = submittedApprover === undefined ? existingTeam.approverEmail : (submittedApprover || null);
  const budgetTarget = parseFloat((formData.get('budgetTarget') as string) || '0') || 0;

  if (!teamId || !name) { throw new Error('A team name is required.'); }
  if (!approverEmail || !approverEmail.includes('@')) throw new Error('A valid approver email is required.');

  await prisma.team.update({
    where: { id: teamId },
    data: { name, approverEmail, budgetTarget },
  });

  revalidatePath('/dashboard/teams');
  revalidatePath('/dashboard/approvals');
  revalidatePath('/dashboard/budgets');
}

export async function deleteTeam(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get('teamId') || '');
  if (!user.isAdmin) throw new Error('Only admins can delete teams.');
  if (!teamId) throw new Error('Team not found.');
  await prisma.$transaction(async (tx) => {
    await tx.expense.deleteMany({ where: { teamId } });
    await tx.fundingRequest.deleteMany({ where: { teamId } });
    await tx.teamMember.deleteMany({ where: { teamId } });
    await tx.team.delete({ where: { id: teamId } });
  });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/submit'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/budgets');
}

export async function upsertTeamMember(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can manage team members.');
  const teamId = String(formData.get('teamId') || '');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const role = String(formData.get('role') || 'USER') as 'USER' | 'APPROVER';
  if (!teamId || !email || !email.includes('@')) throw new Error('Enter a valid email address.');
  if (!['USER','APPROVER'].includes(role)) throw new Error('Invalid team role.');
  const member = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });
  await prisma.teamMember.upsert({ where: { userId_teamId: { userId: member.id, teamId } }, update: { role }, create: { userId: member.id, teamId, role } });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/approvals');
}

export async function removeTeamMember(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can manage team members.');
  const teamId = String(formData.get('teamId') || '');
  const userId = String(formData.get('userId') || '');
  await prisma.teamMember.deleteMany({ where: { teamId, userId } });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/approvals');
}

export async function setAdminStatus(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can manage administrators.');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const isAdmin = String(formData.get('isAdmin')) === 'true';
  if (!email) throw new Error('Email is required.');
  if (!isAdmin && email === (user.email ?? '').toLowerCase()) throw new Error('You cannot remove your own admin access.');
  await prisma.user.upsert({ where: { email }, update: { isAdmin }, create: { email, isAdmin } });
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
  if (target.removedAt) return; // already removed

  await prisma.$transaction(async (tx) => {
    // Requests that were never approved carry no ongoing obligation, so they're
    // deleted outright. Approved requests and every expense stay untouched —
    // that's the history that must remain.
    await tx.fundingRequest.deleteMany({ where: { userId: target.id, status: { not: 'APPROVED' } } });
    // Free up their team roles/approver assignments and sign them out of any
    // active sessions. We deliberately leave their Account (OAuth link)
    // alone — with allowDangerousEmailAccountLinking on, NextAuth would
    // relink it anyway on their next sign-in, and keeping it avoids that
    // relink step altogether.
    await tx.teamMember.deleteMany({ where: { userId: target.id } });
    await tx.session.deleteMany({ where: { userId: target.id } });
    if (target.email) {
      await tx.team.updateMany({ where: { approverEmail: { equals: target.email, mode: 'insensitive' } }, data: { approverEmail: null } });
    }
    // Keep the User row itself (with its name/email intact) so historical
    // Expenses and approved FundingRequests still display correctly, and
    // mark it removed for now. This is not a ban — if they sign in again
    // later, lib/auth.ts clears removedAt and welcomes them back as an
    // active (non-admin) user.
    await tx.user.update({ where: { id: target.id }, data: { isAdmin: false, removedAt: new Date() } });
  });

  revalidatePath('/dashboard/teams');
  revalidatePath('/dashboard/approvals');
  revalidatePath('/dashboard/expenses');
  revalidatePath('/dashboard/my-requests');
}

export async function sendReportNow(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can send reports.');
  const startValue = String(formData.get('start') || '');
  const endValue = String(formData.get('end') || '');
  if (!startValue || !endValue) throw new Error('Choose a start and end date.');
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new Error('Choose a valid date range.');
  const { sendCombinedReport } = await import('@/lib/report');
  await sendCombinedReport(start, new Date(end.getTime() + 1), { manual: true });
  revalidatePath('/dashboard/export');
}
