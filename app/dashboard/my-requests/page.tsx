import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import StatusPill from '@/components/StatusPill';
import DateRangeFilter from '@/components/DateRangeFilter';
import CancelRequestButton from '@/components/CancelRequestButton';

const fmt = (n: number) => `£${n.toFixed(2)}`;
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const isoFirstOfMonth = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); };
const isoToday = () => new Date().toISOString().slice(0, 10);

export default async function MyRequestsPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user as any;
  const from = searchParams.from || isoFirstOfMonth();
  const to = searchParams.to || isoToday();
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59.999`);

  const requests = await prisma.fundingRequest.findMany({ where: { userId: user.id, date: { gte: fromDate, lte: toDate } }, include: { team: { include: { members: { where: { role: 'APPROVER' }, include: { user: { select: { name: true, email: true } } } } } } }, orderBy: { date: 'desc' } });
  const approverEmails = [...new Set(requests.flatMap(r => [r.team.approverEmail, ...r.team.members.map(m => m.user.email)]).filter(Boolean) as string[])];
  const approvers = await prisma.user.findMany({ where: { email: { in: approverEmails, mode: 'insensitive' } }, select: { name: true, email: true } });
  const approverByEmail = new Map(approvers.map(a => [a.email?.toLowerCase(), a.name || a.email || 'Configured approver']));
  const total = requests.reduce((s, r) => s + (r.status === 'APPROVED' || r.status === 'PENDING' ? r.amount : 0), 0);

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-emerald-600">Requests</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Track your funding requests.</h1><p className="mt-2 text-sm text-slate-500">Look up any period below, it opens on this month by default.</p></div>
    <DateRangeFilter from={from} to={to} />
    <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">{requests.length} request{requests.length === 1 ? '' : 's'}</h2><span className="text-sm font-semibold text-slate-600">{fmt(total)} approved or pending</span></div>

    {requests.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">Nothing submitted in this date range.</div> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Desktop lookup table */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-[100px_1fr_140px_100px_110px_100px_90px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Needed</span><span>Description</span><span>Team</span><span className="text-right">Amount</span><span>Status</span><span>Approver</span><span className="text-right">Actions</span>
        </div>
        {requests.map(r => { const approver = [...new Set([r.team.approverEmail, ...r.team.members.map(m => m.user.email)].filter(Boolean) as string[])].map(e => approverByEmail.get(e.toLowerCase()) || e).join(', ') || 'Not configured'; return (
          <div key={r.id} className="border-b border-slate-100 px-4 py-3 text-sm last:border-0 hover:bg-slate-50">
            <div className="grid grid-cols-[100px_1fr_140px_100px_110px_100px_90px] items-center gap-3">
              <span className="text-slate-500">{fmtDate(r.date)}</span>
              <span className="truncate font-medium text-slate-950">{r.description}</span>
              <span className="truncate text-slate-500">{r.team.name}</span>
              <span className="text-right font-semibold text-slate-950">{fmt(r.amount)}</span>
              <span><StatusPill status={r.status} /></span>
              <span className="truncate text-xs text-slate-500">{approver}</span>
              <span className="flex justify-end">{r.status === 'PENDING' && <CancelRequestButton requestId={r.id} />}</span>
            </div>
            {r.decisionNote && <p className="mt-2 truncate text-xs italic text-slate-500">“{r.decisionNote}”</p>}
          </div>
        ); })}
      </div>

      {/* Mobile compact rows */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {requests.map(r => { const approver = [...new Set([r.team.approverEmail, ...r.team.members.map(m => m.user.email)].filter(Boolean) as string[])].map(e => approverByEmail.get(e.toLowerCase()) || e).join(', ') || 'Not configured'; return (
          <div key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-semibold text-slate-950">{r.description}</p><StatusPill status={r.status} /></div><p className="shrink-0 text-sm font-bold text-slate-950">{fmt(r.amount)}</p></div>
            <p className="mt-1 truncate text-xs text-slate-500">{r.team.name} · Needed {fmtDate(r.date)}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">Approver: {approver}</p>
            {r.decisionNote && <p className="mt-1.5 text-xs italic text-slate-500">“{r.decisionNote}”</p>}
            {r.status === 'PENDING' && <div className="mt-2"><CancelRequestButton requestId={r.id} /></div>}
          </div>
        ); })}
      </div>
    </div>}
  </div>;
}
