import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExpenseForm from '@/components/ExpenseForm';
import ExpenseRow from '@/components/ExpenseRow';
import DateRangeFilter from '@/components/DateRangeFilter';

const fmt = (n: number) => `£${n.toFixed(2)}`;
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
  const teamList = teams.map(t => ({ id: t.id, name: t.name }));

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-emerald-600">Expense log</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Submit and manage your expenses.</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Upload receipts as you spend, then look them up below by date.</p></div>
    {teams.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">No teams have been set up yet.</div> : <div className="grid gap-6 xl:grid-cols-[minmax(320px,430px)_1fr]">
      <div><ExpenseForm teams={teamList} approvedRequests={approvedRequests.map(r => ({ id: r.id, description: r.description, amount: r.amount }))} /></div>
      <section className="min-w-0 space-y-4">
        <DateRangeFilter from={from} to={to} />
        <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">{expenses.length} expense{expenses.length === 1 ? '' : 's'}</h2><span className="text-sm font-semibold text-slate-600">{fmt(total)} total</span></div>

        {expenses.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">Nothing logged in this date range.</div> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Desktop lookup table */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-[100px_1fr_140px_100px_90px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Date</span><span>Description</span><span>Team</span><span className="text-right">Amount</span><span className="text-right">Actions</span>
            </div>
            {expenses.map(e => <ExpenseRow key={e.id} variant="desktop" teams={teamList} expense={{ id: e.id, date: e.date.toISOString().slice(0, 10), description: e.description, amount: e.amount, teamId: e.teamId, teamName: e.team.name, receiptUrl: e.receiptUrl }} />)}
          </div>

          {/* Mobile compact rows */}
          <div className="sm:hidden">
            {expenses.map(e => <ExpenseRow key={e.id} variant="mobile" teams={teamList} expense={{ id: e.id, date: e.date.toISOString().slice(0, 10), description: e.description, amount: e.amount, teamId: e.teamId, teamName: e.team.name, receiptUrl: e.receiptUrl }} />)}
          </div>
        </div>}
      </section>
    </div>}
  </div>;
}
