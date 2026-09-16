import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)); }

async function notifyAdmins(subject: string, html: string, text: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return;
  try {
    const admins = await prisma.user.findMany({ where: { isAdmin: true, removedAt: null, email: { not: null } }, select: { email: true } });
    const recipients = admins.map((a) => a.email!).filter(Boolean);
    if (!recipients.length) return;
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from: process.env.RESEND_FROM, to: recipients, subject, html, text });
    if (result.error) console.error('Admin notification failed', result.error);
  } catch (error) {
    console.error('Admin notification failed', error);
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    // Removing a user keeps their User row (so history stays attached) but
    // used to also delete their linked Account row. On the next Google
    // sign-in, NextAuth then sees a Google identity with no Account link
    // pointing at an existing User with the same email, and - as a security
    // guard against silently merging unrelated accounts - refuses with
    // OAuthAccountNotLinked instead of relinking. Google is our only
    // provider and its emails are verified, so it's safe to let NextAuth
    // relink automatically here.
    allowDangerousEmailAccountLinking: true,
  })],
  session: { strategy: 'database' },
  pages: { signIn: '/login', error: '/login' },
  events: {
    // Fires exactly once, the very first time the adapter creates a brand
    // new User row - i.e. someone genuinely joining for the first time.
    async createUser({ user }) {
      await notifyAdmins(
        'New person joined Proclaim Expenses',
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2 style="margin-bottom:8px">New sign-in</h2><p style="color:#475569">${escapeHtml(user.name || user.email || 'Someone')} (${escapeHtml(user.email || 'no email')}) just signed in to Proclaim Expenses for the first time.</p></div>`,
        `${user.name || user.email} just signed in to Proclaim Expenses for the first time.`,
      );
    },
  },
  callbacks: {
    async signIn({ user }) {
      // Removal is not a login ban. If a previously removed user signs in
      // again, treat that successful sign-in as them rejoining Proclaim: clear
      // the removed marker so they immediately reappear in Admin > People.
      //
      // This must never be allowed to crash the sign-in itself - if this
      // bookkeeping update fails for any reason, the person should still be
      // able to log in; we just log the real error so it's visible in
      // Vercel's function logs instead of only showing as a generic 500 on
      // /api/auth/error with no detail.
      if (user?.id) {
        try {
          const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { removedAt: true, name: true, email: true } });
          if (existing?.removedAt) {
            await prisma.user.update({ where: { id: user.id }, data: { removedAt: null } });
            await notifyAdmins(
              'A removed member has rejoined Proclaim Expenses',
              `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2 style="margin-bottom:8px">Welcome back</h2><p style="color:#475569">${escapeHtml(existing.name || existing.email || 'Someone')} (${escapeHtml(existing.email || '')}) signed back in and has been automatically restored. They'll need to re-add their bank details and be re-added to a team; their historical expenses were never deleted.</p></div>`,
              `${existing.name || existing.email} signed back in and has been restored.`,
            );
          }
        } catch (error) {
          console.error('signIn callback: failed to clear removedAt for', user.id, error);
        }
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
        const email = (user.email ?? '').toLowerCase();
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isAdmin: true } });
        const approverMembership = email
          ? await prisma.teamMember.findFirst({ where: { role: 'APPROVER', userId: user.id }, select: { id: true } })
          : null;
        const legacyApprover = email
          ? await prisma.team.findFirst({ where: { approverEmail: { equals: email, mode: 'insensitive' } }, select: { id: true } })
          : null;
        (session.user as any).isApprover = !!approverMembership || !!legacyApprover;
        const envAdmins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
        (session.user as any).isAdmin = !!dbUser?.isAdmin || envAdmins.includes(email);
      }
      return session;
    },
  },
};
