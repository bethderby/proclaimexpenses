import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock3, CreditCard, Plus, ReceiptText } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import StatusPill from '@/components/StatusPill';

const fmt=(n:number)=>`£${n.toFixed(2)}`;

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof ReceiptText;
  tone: 'gold' | 'blue' | 'green' | 'purple';
  href?: string;
}) {
  const content = (
    <div className={`metric-card metric-card-${tone}`}>
      <div className="metric-card-top">
        <div className="metric-icon"><Icon size={17} strokeWidth={2.2}/></div>
        {href && <ArrowUpRight className="metric-card-arrow" size={17}/>} 
      </div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <div className="metric-card-footer"><p className="metric-note">{note}</p>{href && <ArrowRight size={14} className="metric-footer-arrow"/>}</div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-2xl">{content}</Link> : content;
}

export default async function DashboardPage(){
 const session=await getServerSession(authOptions);if(!session?.user)redirect('/login');const user=session.user;
 const pendingWhere:any=user.isAdmin?{status:'PENDING'}:user.isApprover?{status:'PENDING',team:{approverEmails:{has:(user.email??'').toLowerCase()}}}:{status:'PENDING',userId:user.id};
 const [expenses,expenseCount,expenseTotal,pending,needsReceipt,ready]=await Promise.all([
  prisma.expense.findMany({where:{userId:user.id},include:{team:true},orderBy:{submittedAt:'desc'},take:5}),
  prisma.expense.count({where:{userId:user.id}}),
  prisma.expense.aggregate({where:{userId:user.id},_sum:{amount:true}}),
  prisma.expense.count({where:pendingWhere}),
  prisma.expense.count({where:{userId:user.id,status:'ADVANCE_PAID_AWAITING_RECEIPT'}}),
  user.isAdmin||user.isApprover?prisma.expense.count({where:user.isAdmin?{status:'READY_TO_PAY'}:{status:'READY_TO_PAY',team:{approverEmails:{has:(user.email??'').toLowerCase()}}}}):Promise.resolve(0),
 ]);
 const total=expenseTotal._sum.amount??0;
 return <div className="page-stack dashboard-page">
  <header className="page-header dashboard-header">
    <div>
      <p className="page-eyebrow">Overview</p>
      <h1 className="page-title">Good to see you, {user.name?.split(' ')[0]||'there'}</h1>
      <p className="page-description">A simple view of your expenses and anything that needs your attention.</p>
    </div>
    <Link href="/dashboard/expenses" className="primary-button dashboard-submit"><Plus size={17}/> Submit expense</Link>
  </header>

  <section className="metric-grid" aria-label="Expense summary">
    <MetricCard label="My expenses" value={expenseCount} note={`${fmt(total)} across all expenses`} icon={ReceiptText} tone="gold" href="/dashboard/expense-history" />
    <MetricCard label="Waiting for approval" value={pending} note="Expenses not yet approved" icon={Clock3} tone="blue" href={user.isAdmin||user.isApprover?"/dashboard/approvals":"/dashboard/expense-history?status=PENDING"} />
    <MetricCard label="Receipt needed" value={needsReceipt} note="Advances awaiting receipt" icon={CheckCircle2} tone="green" href="/dashboard/expense-history?status=ADVANCE_PAID_AWAITING_RECEIPT" />
    {(user.isAdmin||user.isApprover)&&<MetricCard label="Ready to pay" value={ready} note="Ready for payment runs" icon={CreditCard} tone="purple" href="/dashboard/payments" />}
  </section>

  <section className="panel dashboard-panel overflow-hidden">
    <div className="panel-header dashboard-panel-header">
      <div><p className="panel-kicker">Activity</p><h2 className="panel-title">Recent expenses</h2><p className="panel-subtitle">Your latest expense activity</p></div>
      <Link href="/dashboard/expense-history" className="panel-link">View all <ArrowUpRight size={14}/></Link>
    </div>
    {expenses.length===0?<div className="empty-state m-4">No expenses yet.</div>:<div className="divide-y divide-slate-100 md:grid md:grid-cols-[4.5rem_minmax(0,1fr)_88px_minmax(170px,max-content)] md:items-stretch md:divide-y-0">
      {expenses.map((e,i)=>{const isLast=i===expenses.length-1;return <Link key={e.id} href={`/dashboard/expense-history?expenseId=${e.id}`} className={`expense-summary-row group md:contents`}>
        <div className={`flex items-center md:border-b md:border-slate-100 md:py-3 md:pl-5 md:pr-2 md:group-hover:bg-slate-50 ${isLast?'md:border-b-0':''}`}><div className="expense-summary-icon"><ReceiptText size={17}/></div></div>
        <div className={`min-w-0 flex-1 md:flex md:items-center md:border-b md:border-slate-100 md:px-2 md:py-3 md:group-hover:bg-slate-50 ${isLast?'md:border-b-0':''}`}><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{e.description}</p><p className="mt-0.5 text-xs font-medium text-slate-500 md:hidden">{fmt(e.amount)}</p></div></div>
        <div className={`hidden shrink-0 text-sm font-bold text-slate-900 md:flex md:items-center md:justify-end md:border-b md:border-slate-100 md:px-2 md:py-3 md:group-hover:bg-slate-50 ${isLast?'md:border-b-0':''}`}>{fmt(e.amount)}</div>
        <div className={`flex items-center md:border-b md:border-slate-100 md:py-3 md:pl-2 md:pr-5 md:group-hover:bg-slate-50 ${isLast?'md:border-b-0':''}`}><StatusPill status={e.status}/></div>
      </Link>;})}
    </div>}
  </section>

  {(user.isAdmin||user.isApprover)&&<section className="dashboard-action-strip">
    <div className="dashboard-action-icon"><CreditCard size={18}/></div>
    <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">Payment runs</p><p className="text-xs text-slate-500">Review approved expenses ready for payment.</p></div>
    <Link href="/dashboard/payments" className="secondary-button dashboard-action-button">Open payment runs <ArrowUpRight size={15}/></Link>
  </section>}
 </div>;
}
