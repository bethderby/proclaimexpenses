import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { submitRequest } from '@/app/actions';



export default async function SubmitPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-stone-900 tracking-tight mb-1">Submit a request</h2>
      <p className="text-sm text-stone-500 mb-6">
        Ask for funding before you spend. It'll go to that team's approver automatically.
      </p>

      {teams.length === 0 ? (
        <div className="border border-dashed border-stone-300 rounded-lg py-14 text-center text-sm text-stone-400 max-w-lg">
          No teams have been set up yet. Ask an admin to add one from the Teams page.
        </div>
      ) : (
        <form action={submitRequest} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5 sm:p-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Team</label>
            <select
              name="teamId"
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date needed</label>
            <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">What's it for?</label>
            <input
              name="description"
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Client dinner with Acme Ltd"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Amount requested</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">£</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="amount"
                required
                className="w-full rounded-md border border-stone-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                placeholder="0.00"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-950 text-white px-4 py-3 text-sm font-semibold hover:bg-slate-800"
          >
            Send for approval
          </button>
        </form>
      )}
    </div>
  );
}
