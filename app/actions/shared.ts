import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return session.user;
}

export async function getTeamApproverEmails(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId, archivedAt: null } });
  if (!team) throw new Error('That team no longer exists.');
  const approverEmails = [...new Set(team.approverEmails.map(e => e.trim().toLowerCase()).filter(Boolean))];
  if (!approverEmails.length) throw new Error('That team does not have an approver configured yet. Ask an admin to set one.');
  return { team, approverEmails };
}
