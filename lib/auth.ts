import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  })],
  session: { strategy: 'database' },
  pages: { signIn: '/login' },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
        const email = (user.email ?? '').toLowerCase();
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isAdmin: true } });
        const legacyApprover = email
          ? await prisma.team.findFirst({ where: { approverEmail: { equals: email, mode: 'insensitive' } }, select: { id: true } })
          : null;
        // Approver access comes from Team.approverEmail. Team membership is not required.
        (session.user as any).isApprover = !!legacyApprover;
        const envAdmins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
        (session.user as any).isAdmin = !!dbUser?.isAdmin || envAdmins.includes(email);
      }
      return session;
    },
  },
};
