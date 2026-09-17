'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/audit';
import { requireUser } from './shared';

export async function setAdminStatus(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can manage administrators.');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const isAdmin = String(formData.get('isAdmin')) === 'true';
  if (!email) throw new Error('Email is required.');
  if (!isAdmin && email === (user.email ?? '').toLowerCase()) throw new Error('You cannot remove your own admin access.');
  const target = await prisma.user.upsert({ where: { email }, update: { isAdmin, ...(isAdmin ? { removedAt: null } : {}) }, create: { email, isAdmin } });
  await recordAuditEvent({ actor: user, action: isAdmin ? 'ADMIN_ACCESS_GRANTED' : 'ADMIN_ACCESS_REVOKED', entityType: 'USER', entityId: target.id, targetUserId: target.id, summary: isAdmin ? `Administrator access granted to ${email}` : `Administrator access revoked from ${email}`, metadata: { email, isAdmin } });
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
  await recordAuditEvent({ actor: user, action: 'USER_REMOVED', entityType: 'USER', entityId: target.id, targetUserId: target.id, summary: `User removed: ${email}`, metadata: { email } });
  revalidatePath('/dashboard/teams'); revalidatePath('/dashboard/approvals'); revalidatePath('/dashboard/expenses'); revalidatePath('/dashboard/expense-history');
}
