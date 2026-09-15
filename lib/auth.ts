import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    // Removing a user keeps their User row (so history stays attached) but
    // used to also delete their linked Account row. On the next Google
    // sign-in, NextAuth then sees a Google identity with no Account link
    // pointing at an existing User with the same email, and — as a security
    // guard against silently merging unrelated accounts — refuses with
    // OAuthAccountNotLinked instead of relinking. Google is our only
    // provider and its emails are verified, so it's safe to let NextAuth
    // relink automatically here.
    allowDangerousEmailAccountLinking: true,
  })],
  session: { strategy: 'database' },
  pages: { signIn: '/login', error: '/login' },
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
          await prisma.user.update({ where: { id: user.id }, data: { removedAt: null } });
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
