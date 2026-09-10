import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExpenseForm from '@/components/ExpenseForm';
import EditExpenseForm from '@/components/EditExpenseForm';
import DateRangeFilter from '@/components/DateRangeFilter';
import { FileText, Paperclip } from 'lucide-react';

const fmt = (n: number) => `£${n.toFixed(2)}`;
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const isoFirstOfMonth = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); };
const isoToday = () => new Date().toISOString().slice(0, 10);

export default async function ExpensesPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await getServerSession(authOptions); if (!session?.user) redirect('/login'); const user = session.user as any;
  const from = searchParams.from || isoFirstOfMonth();
  const to = searchParams.to || isoToday();
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59.999`);

  const [teams, approvedRequests, expenses] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.fundingRequest.findMany({ where: { userId: user.id, status: 'APPROVED' }, orderBy: { date: 'desc' } }),
    prisma.expense.findMany({ where: { userId: user.id, date: { gte: fromDate, lte: toDate } }, include: { team: true }, orderBy: { date: 'desc' } }),
  ]);
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-emerald-600">Expense log</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Keep every purchase in one place.</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Upload receipts as you spend, then look them up below by date.</p></div>
    {teams.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">No teams have been set up yet.</div> : <div className="grid gap-6 xl:grid-cols-[minmax(320px,430px)_1fr]">
      <div><ExpenseForm teams={teams.map(t => ({ id: t.id, name: t.name }))} approvedRequests={approvedRequests.map(r => ({ id: r.id, description: r.description, amount: r.amount }))} /></div>
      <section className="min-w-0 space-y-4">
        <DateRangeFilter from={from} to={to} />
        <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">{expenses.length} expense{expenses.length === 1 ? '' : 's'}</h2><span className="text-sm font-semibold text-slate-600">{fmt(total)} total</span></div>

        {expenses.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">Nothing logged in this date range.</div> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Desktop lookup table */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-[100px_1fr_140px_100px_90px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Date</span><span>Description</span><span>Team</span><span className="text-right">Amount</span><span className="text-right">Actions</span>
            </div>
            {expenses.map(e => <div key={e.id} className="grid grid-cols-[100px_1fr_140px_100px_90px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-0 hover:bg-slate-50">
              <span className="text-slate-500">{fmtDate(e.date)}</span>
              <span className="truncate font-medium text-slate-950">{e.description}</span>
              <span className="truncate text-slate-500">{e.team.name}</span>
              <span className="text-right font-semibold text-slate-950">{fmt(e.amount)}</span>
              <span className="flex items-center justify-end gap-1">
                <a href={`/api/receipts/${e.id}`} target="_blank" rel="noreferrer" title="View receipt" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 active:scale-[.94]"><Paperclip size={15} /></a>
                <EditExpenseForm expense={{ id: e.id, date: e.date.toISOString().slice(0, 10), description: e.description, amount: e.amount, teamId: e.teamId }} teams={teams.map(t => ({ id: t.id, name: t.name }))} />
              </span>
            </div>)}
          </div>

          {/* Mobile compact rows */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {expenses.map(e => <div key={e.id} className="p-4">
              <div className="flex items-start gap-3">
                <a href={`/api/receipts/${e.id}`} target="_blank" rel="noreferrer" className="shrink-0">
                  {e.receiptUrl.toLowerCase().endsWith('.pdf') ? <div className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600"><FileText size={16} /></div> : <img src={`/api/receipts/${e.id}`} alt="Receipt" className="h-11 w-11 rounded-lg border border-slate-200 object-cover bg-slate-50" />}
                </a>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-950">{e.description}</p><p className="shrink-0 text-sm font-bold text-slate-950">{fmt(e.amount)}</p></div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{e.team.name} · {fmtDate(e.date)}</p>
                </div>
              </div>
              <div className="mt-2"><EditExpenseForm expense={{ id: e.id, date: e.date.toISOString().slice(0, 10), description: e.description, amount: e.amount, teamId: e.teamId }} teams={teams.map(t => ({ id: t.id, name: t.name }))} /></div>
            </div>)}
          </div>
        </div>}
      </section>
    </div>}
  </div>;
}
