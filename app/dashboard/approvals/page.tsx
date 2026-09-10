import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ApprovalRow from '@/components/ApprovalRow';

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user as any;
  if (!user.isApprover && !user.isAdmin) redirect('/dashboard/submit');

  const items = await prisma.fundingRequest.findMany({
    where: user.isAdmin
      ? { status: 'PENDING' }
      : { status: 'PENDING', team: { approverEmail: { equals: user.email, mode: 'insensitive' } } },
    include: { user: true, team: true },
    orderBy: { submittedAt: 'asc' },
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold text-stone-900 tracking-tight mb-1">Approvals</h2>
      <p className="text-sm text-stone-500 mb-6">Pending requests for teams you approve.</p>
      {items.length === 0 ? (
        <div className="border border-dashed border-stone-300 rounded-lg py-14 text-center text-sm text-stone-400">
          Nothing waiting on you right now.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <ApprovalRow
              key={r.id}
              id={r.id}
              description={r.description}
              amount={r.amount}
              date={r.date.toISOString().slice(0, 10)}
              userName={r.user.name ?? r.user.email ?? 'Unknown'}
              teamName={r.team.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
