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
  const requests = await prisma.fundingRequest.findMany({ where: { userId: user.id }, include: { team: true }, orderBy: { submittedAt: 'desc' } });
  const approverEmails = [...new Set(requests.map(r => r.team.approverEmail).filter(Boolean) as string[])];
  const approvers = await prisma.user.findMany({ where: { email: { in: approverEmails, mode: 'insensitive' } }, select: { name: true, email: true } });
  const approverByEmail = new Map(approvers.map(a => [a.email?.toLowerCase(), a.name || a.email || 'Configured approver']));
  const total = requests.reduce((s, r) => s + (r.status !== 'REJECTED' ? r.amount : 0), 0);

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-emerald-600">Requests</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Track your requests.</h1><p className="mt-2 text-sm text-slate-500">{requests.length} submitted · {fmt(total)} approved or pending.</p></div>
    {requests.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">Nothing submitted yet.</div> : <div className="grid gap-4">{requests.map(r => { const approver = r.team.approverEmail ? (approverByEmail.get(r.team.approverEmail.toLowerCase()) || r.team.approverEmail) : 'Not configured'; return <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold text-slate-950">{r.description}</h2><StatusPill status={r.status}/></div><p className="mt-2 text-xs text-slate-500">{r.team.name} · Needed {r.date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div><p className="text-xl font-bold text-slate-950">{fmt(r.amount)}</p></div><div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Potential approver</p><p className="mt-1 text-sm font-semibold text-slate-800">{approver}</p></div><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Submitted</p><p className="mt-1 text-sm text-slate-700">{r.submittedAt.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div></div>{r.decisionNote && <p className="mt-4 rounded-xl border border-slate-100 px-4 py-3 text-xs italic text-slate-500">“{r.decisionNote}”</p>}</article>})}</div>}
  </div>;
}
