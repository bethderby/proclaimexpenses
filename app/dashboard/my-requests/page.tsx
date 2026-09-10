import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import StatusPill from '@/components/StatusPill';

const fmt = (n: number) => `£${n.toFixed(2)}`;

export default async function MyRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user as any;

  const requests = await prisma.fundingRequest.findMany({
    where: { userId: user.id },
    orderBy: { submittedAt: 'desc' },
  });
  const total = requests.reduce((s, r) => s + (r.status !== 'REJECTED' ? r.amount : 0), 0);

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-stone-900 tracking-tight mb-1">My requests</h2>
      <p className="text-sm text-stone-500 mb-6">
        {requests.length} submitted · {fmt(total)} approved or pending
      </p>
      {requests.length === 0 ? (
        <div className="border border-dashed border-stone-300 rounded-lg py-14 text-center text-sm text-stone-400">
          Nothing submitted yet.
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-lg divide-y divide-stone-100">
          {requests.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{r.description}</p>
                <p className="text-xs text-stone-500">
                  {r.date.toISOString().slice(0, 10)}
                </p>
                {r.decisionNote && <p className="text-xs text-stone-400 mt-1 italic">"{r.decisionNote}"</p>}
              </div>
              <span className="text-sm font-medium text-stone-800 w-20 text-right">{fmt(r.amount)}</span>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
