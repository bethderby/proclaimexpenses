'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { parseMoney } from '@/lib/money';
import { auditEventData, recordAuditEvent } from '@/lib/audit';
import { requireUser } from './shared';

export async function updateBudget(teamId: string, target: number) {
  const user = await requireUser();
  const team = await prisma.team.findUnique({ where: { id: teamId } });
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
  await prisma.$transaction(async tx => {
    // Record the deletion before removing the team. The AuditEvent.teamId
    // relation is ON DELETE SET NULL, so the audit record survives while its
    // team link is cleared by PostgreSQL after the team is deleted.
    await tx.auditEvent.create({
      data: auditEventData({
        actor: user,
        action: 'TEAM_DELETED',
        entityType: 'TEAM',
        entityId: teamId,
        teamId,
        summary: 'Team deleted',
        metadata: { teamId },
      }),
    });
    await tx.expense.deleteMany({ where: { teamId } });
    await tx.team.delete({ where: { id: teamId } });
  });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history'); revalidatePath('/dashboard/reports'); revalidatePath('/dashboard/approvals');
}
