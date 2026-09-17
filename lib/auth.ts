import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import { notify, renderEmail } from './notify';

async function notifyAdmins(heading: string, intro: string, plainTextExtra?: string) {
  // Callers are NextAuth's createUser/signIn hooks, which must never fail a
  // sign-in over a notification problem - so failures here are logged, not thrown.
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return;
  try {
    const admins = await prisma.user.findMany({ where: { isAdmin: true, removedAt: null, email: { not: null } }, select: { email: true } });
    const recipients = admins.map((a) => a.email!).filter(Boolean);
    if (!recipients.length) return;
    const { html, text } = renderEmail({ heading, intro, plainTextExtra });
    await notify(recipients, heading, html, text);
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
      const displayName = user.name || user.email || 'there';
      await notifyAdmins(
        'New person joined Proclaim Expenses',
        `${displayName} (${user.email || 'no email'}) just signed in to Proclaim Expenses for the first time.`,
      );
      if (user.email) {
        const { html, text } = renderEmail({
          heading: 'Welcome to Proclaim Expenses',
          intro: `Hi ${displayName}, your account has been created. Before submitting an expense, please add your bank details so approved expenses can be paid to you.`,
          ctaPath: '/dashboard/expenses',
          ctaLabel: 'Open Proclaim Expenses',
        });
        await notify(user.email, 'Welcome to Proclaim Expenses', html, text);
      }
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
            const rejoinedName = existing.name || existing.email || 'Someone';
            await notifyAdmins(
              'A removed person has rejoined Proclaim Expenses',
              `${rejoinedName} (${existing.email || ''}) signed back in and has been automatically restored. They'll need to re-add their bank details before they can be paid; their historical expenses were never deleted.`,
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
        session.user.id = user.id;
        const email = (user.email ?? '').toLowerCase();
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isAdmin: true } });
        const approverTeam = email
          ? await prisma.team.findFirst({ where: { approverEmails: { has: email } }, select: { id: true } })
          : null;
        session.user.isApprover = !!approverTeam;
        const envAdmins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
        session.user.isAdmin = !!dbUser?.isAdmin || envAdmins.includes(email);
      }
      return session;
    },
  },
};
