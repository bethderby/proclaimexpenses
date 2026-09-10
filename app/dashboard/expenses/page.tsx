import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExpenseForm from '@/components/ExpenseForm';
const fmt=(n:number)=>`£${n.toFixed(2)}`;
export default async function ExpensesPage(){
 const session=await getServerSession(authOptions); if(!session?.user)redirect('/login'); const user=session.user as any;
 const [teams,approvedRequests,expenses]=await Promise.all([
  prisma.team.findMany({orderBy:{name:'asc'}}),
  prisma.fundingRequest.findMany({where:{userId:user.id,status:'APPROVED'},orderBy:{date:'desc'}}),
  prisma.expense.findMany({where:{userId:user.id},include:{team:true},orderBy:{submittedAt:'desc'}})
 ]);
 const total=expenses.reduce((s,e)=>s+e.amount,0);
 return <div className="space-y-6">
  <div><p className="text-sm font-semibold text-emerald-600">Expense log</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Keep every purchase in one place.</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Upload receipts as you spend. {expenses.length} logged expense{expenses.length===1?'':'s'} · {fmt(total)} total.</p></div>
  {teams.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">No teams have been set up yet.</div>:<div className="grid gap-6 xl:grid-cols-[minmax(320px,430px)_1fr]">
   <div><ExpenseForm teams={teams.map(t=>({id:t.id,name:t.name}))} approvedRequests={approvedRequests.map(r=>({id:r.id,description:r.description,amount:r.amount}))}/></div>
   <section className="min-w-0"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-slate-950">Recent expenses</h2><p className="text-xs text-slate-500">Your latest submitted purchases</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{expenses.length}</span></div>
    {expenses.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">Your expense log will appear here.</div>:<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{expenses.map((e)=><div key={e.id} className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0 sm:gap-4 sm:p-5"><a href={`/api/receipts/${e.id}`} target="_blank" rel="noreferrer" className="shrink-0">
{e.receiptUrl.toLowerCase().endsWith('.pdf') ? <div className="grid h-14 w-14 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">PDF</div> : <img src={`/api/receipts/${e.id}`} alt="Receipt" className="h-14 w-14 rounded-xl border border-slate-200 object-cover bg-slate-50"/>}
</a><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-950">{e.description}</p><p className="mt-1 truncate text-xs text-slate-500">{e.team.name} · {e.date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div><p className="shrink-0 text-sm font-bold text-slate-950">{fmt(e.amount)}</p></div>)}</div>}
   </section>
  </div>}
 </div>
}
