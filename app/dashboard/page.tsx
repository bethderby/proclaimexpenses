import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ArrowUpRight, Plus, ReceiptText } from 'lucide-react';
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
 return <div className="page-stack">
  <header className="page-header"><div><p className="page-eyebrow">Overview</p><h1 className="page-title">Good to see you, {user.name?.split(' ')[0]||'there'}</h1><p className="page-description">A simple view of your expenses and anything that needs your attention.</p></div><Link href="/dashboard/expenses" className="primary-button"><Plus size={16}/> Submit expense</Link></header>
  <div className="metric-grid">
   <div className="metric-card metric-card-dark"><p className="metric-label">My expenses</p><p className="metric-value">{expenses.length}</p><p className="metric-note">{fmt(total)} across recent expenses</p></div>
   <div className="metric-card"><p className="metric-label">Waiting for approval</p><p className="metric-value">{pending}</p><p className="metric-note">Expenses not yet approved</p></div>
   <div className="metric-card"><p className="metric-label">Receipt needed</p><p className="metric-value">{needsReceipt}</p><p className="metric-note">Advances awaiting receipt</p></div>
   {(user.isAdmin||user.isApprover)&&<div className="metric-card"><p className="metric-label">Ready to pay</p><p className="metric-value">{ready}</p><p className="metric-note">Ready for payment runs</p></div>}
  </div>
  <section className="panel overflow-hidden"><div className="panel-header"><div><h2 className="panel-title">Recent expenses</h2><p className="panel-subtitle">Your latest expense activity</p></div><Link href="/dashboard/expenses" className="inline-flex items-center gap-1 text-xs font-bold text-[#C99600] hover:underline">View all <ArrowUpRight size={13}/></Link></div>
   <div className="divide-y divide-slate-100">{expenses.length===0?<div className="empty-state m-4">No expenses yet.</div>:expenses.map(e=><div key={e.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50/70"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><ReceiptText size={17}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{e.description}</p><p className="mt-0.5 text-xs text-slate-500">{e.team.name}</p></div><span className="hidden text-sm font-bold text-slate-900 sm:block">{fmt(e.amount)}</span><StatusPill status={e.status}/></div>)}</div>
  </section>
  {(user.isAdmin||user.isApprover)&&<div className="flex flex-wrap gap-2"><Link href="/dashboard/payments" className="secondary-button">Open payment runs <ArrowUpRight size={15}/></Link></div>}
 </div>;
}
