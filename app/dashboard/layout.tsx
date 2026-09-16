import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user as any;
  const pendingCount = user.isAdmin
    ? await prisma.expense.count({ where: { status: 'PENDING' } })
    : user.isApprover
      ? await prisma.expense.count({ where: { status: 'PENDING', team: { approverEmails: { has: (user.email ?? '').toLowerCase() } } } })
      : 0;

  return (
    <div className="app-shell min-h-screen lg:flex">
      <Sidebar name={user.name} email={user.email} isApprover={!!user.isApprover || !!user.isAdmin} isAdmin={!!user.isAdmin} pendingCount={pendingCount} />
      <main className="app-main min-w-0 flex-1 px-4 pb-8 sm:px-6 lg:px-10 lg:pb-10">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
