import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import StatusPill from '@/components/StatusPill';

const fmt=(n:number)=>`£${n.toFixed(2)}`;
export default async function DashboardPage(){
 const session=await getServerSession(authOptions);if(!session?.user)redirect('/login');const user=session.user as any;
 const pendingWhere:any=user.isAdmin?{status:'PENDING'}:user.isApprover?{status:'PENDING',team:{approverEmails:{has:(user.email??'').toLowerCase()}}}:{status:'PENDING',userId:user.id};
 const [expenses,pending,needsReceipt,ready]=await Promise.all([
  prisma.expense.findMany({where:{userId:user.id},include:{team:true},orderBy:{submittedAt:'desc'},take:5}),
  prisma.expense.count({where:pendingWhere}),
  prisma.expense.count({where:{userId:user.id,status:'ADVANCE_PAID_AWAITING_RECEIPT'}}),
  user.isAdmin||user.isApprover?prisma.expense.count({where:user.isAdmin?{status:'READY_TO_PAY'}:{status:'READY_TO_PAY',team:{approverEmails:{has:(user.email??'').toLowerCase()}}}}):Promise.resolve(0),
 ]);
 const total=expenses.reduce((s,e)=>s+e.amount,0);
 return <div className="space-y-6 sm:space-y-8"><div><p className="text-sm font-semibold text-[#C99600]">Overview</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Good to see you, {user.name?.split(' ')[0]||'there'}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Keep your expenses, approvals and receipts in one place.</p></div>
  <div className={`grid gap-4 ${user.isAdmin || user.isApprover ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}><div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs text-slate-300">My expenses</p><p className="mt-2 text-3xl font-bold">{expenses.length}</p><p className="mt-1 text-xs text-slate-400">{fmt(total)} in recent expenses</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Waiting for approval</p><p className="mt-2 text-3xl font-bold text-slate-950">{pending}</p><p className="mt-1 text-xs text-slate-500">expenses not yet approved</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Receipt needed</p><p className="mt-2 text-3xl font-bold text-slate-950">{needsReceipt}</p><p className="mt-1 text-xs text-slate-500">advance payments awaiting receipt</p></div>{(user.isAdmin || user.isApprover) && <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Ready to pay</p><p className="mt-2 text-3xl font-bold text-slate-950">{ready}</p><p className="mt-1 text-xs text-slate-500">for your payment runs</p></div>}</div>
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-950">Recent expenses</h2><p className="text-xs text-slate-500">Your latest expense activity</p></div><a href="/dashboard/expenses" className="text-xs font-semibold text-[#C99600]">View all</a></div><div className="mt-4 divide-y divide-slate-100">{expenses.length===0?<p className="py-8 text-sm text-slate-500">No expenses yet.</p>:expenses.map(e=><div key={e.id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{e.description}</p><p className="text-xs text-slate-500">{e.team.name}</p></div><span className="text-sm font-bold text-slate-900">{fmt(e.amount)}</span><StatusPill status={e.status}/></div>)}</div></section>
  <div className="flex flex-wrap gap-3"><a href="/dashboard/expenses" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Submit an expense</a>{(user.isAdmin||user.isApprover)&&<a href="/dashboard/payments" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Open payment runs</a>}</div>
 </div>;
}
