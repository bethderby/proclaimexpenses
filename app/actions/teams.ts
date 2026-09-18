'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { parseMoney } from '@/lib/money';
import { auditEventData, recordAuditEvent } from '@/lib/audit';
import { requireUser } from './shared';

export async function updateBudget(teamId: string, target: number) {
  const user = await requireUser();
  const team = await prisma.team.findUnique({ where: { id: teamId, archivedAt: null } });
  if (!team) throw new Error('Team not found.');
  const allowed = user.isAdmin || team.approverEmails.some(e => e.toLowerCase() === (user.email ?? '').toLowerCase());
  if (!allowed) throw new Error("Only this team's configured approver or an admin can change its budget.");
  await prisma.team.update({ where: { id: teamId }, data: { budgetTarget: target } });
  await recordAuditEvent({ actor: user, action: 'TEAM_BUDGET_UPDATED', entityType: 'TEAM', entityId: teamId, teamId, summary: `Team budget updated to £${target.toFixed(2)}`, metadata: { target } });
  revalidatePath('/dashboard/reports');
}

export async function createTeam(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can add teams.');
  const name = (formData.get('name') as string)?.trim();
  const approverEmails = [...new Set(formData.getAll('approverEmail').map(v => String(v).trim().toLowerCase()).filter(Boolean))];
  const budgetTarget = parseMoney(formData.get('budgetTarget'), { min: 0, allowZero: true });
  if (!name) throw new Error('A team name is required.');
  if (!approverEmails.length || approverEmails.some(e => !e.includes('@'))) throw new Error('Add at least one valid approver email.');
  const team = await prisma.team.create({ data: { name, approverEmails, budgetTarget } });
  await recordAuditEvent({ actor: user, action: 'TEAM_CREATED', entityType: 'TEAM', entityId: team.id, teamId: team.id, summary: `Team created: ${name}`, metadata: { name, approverEmails, budgetTarget } });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/approvals');
}

export async function updateTeam(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can edit teams.');
  const teamId = String(formData.get('teamId') || '');
  const name = (formData.get('name') as string)?.trim();
  const approverEmails = [...new Set(formData.getAll('approverEmail').map(v => String(v).trim().toLowerCase()).filter(Boolean))];
  const budgetTarget = parseMoney(formData.get('budgetTarget'), { min: 0, allowZero: true });
  if (!teamId || !name) throw new Error('A team name is required.');
  if (!approverEmails.length || approverEmails.some(e => !e.includes('@'))) throw new Error('Add at least one valid approver email.');
  await prisma.team.update({ where: { id: teamId }, data: { name, approverEmails, budgetTarget } });
  await recordAuditEvent({ actor: user, action: 'TEAM_UPDATED', entityType: 'TEAM', entityId: teamId, teamId, summary: `Team updated: ${name}`, metadata: { name, approverEmails, budgetTarget } });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/approvals'); revalidatePath('/dashboard/reports'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history');
}

export async function deleteTeam(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get('teamId') || '');
  if (!user.isAdmin) throw new Error('Only admins can delete teams.');
  if (!teamId) throw new Error('Team not found.');
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, archivedAt: true } });
  if (!team) throw new Error('Team not found.');
  if (team.archivedAt) return;

  // Teams are archived rather than physically deleted. Expenses are financial
  // records and must never disappear just because their team is retired. The
  // Team relation remains intact so historical expenses, payment runs and
  // audit history continue to display the original team name.
  await prisma.$transaction(async tx => {
    await tx.team.update({ where: { id: teamId }, data: { archivedAt: new Date() } });
    await tx.auditEvent.create({
      data: auditEventData({
        actor: user,
        action: 'TEAM_DELETED',
        entityType: 'TEAM',
        entityId: teamId,
        teamId,
        summary: 'Team archived',
        metadata: { teamId, teamName: team.name },
      }),
    });
  });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/reports'); revalidatePath('/dashboard/approvals');
}
