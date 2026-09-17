import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ReceiptText, Clock3, CircleAlert } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const money=(n:number)=>`£${n.toFixed(2)}`;
const daysSince=(value:Date)=>Math.max(0,Math.floor((Date.now()-value.getTime())/(1000*60*60*24)));
const dayLabel=(n:number)=>n===0?'Today':n===1?'1 day':`${n} days`;

export default async function OutstandingPage(){
 const session=await getServerSession(authOptions);if(!session?.user)redirect('/login');const user=session.user;if(!user.isAdmin)redirect('/dashboard');

 const [missingReceipts, readyToPay, paymentIssues] = await Promise.all([
  prisma.expense.findMany({where:{status:'ADVANCE_PAID_AWAITING_RECEIPT'},include:{user:true,team:true},orderBy:{receiptDueAt:'asc'}}),
  prisma.expense.findMany({where:{status:'READY_TO_PAY'},include:{user:true,team:true},orderBy:{decidedAt:'asc'}}),
  prisma.expense.findMany({where:{paymentStatus:'FAILED',status:{notIn:['REJECTED','CANCELLED']}},include:{user:true,team:true},orderBy:{submittedAt:'desc'}}),
 ]);

 const receiptsTotal=missingReceipts.reduce((s,e)=>s+e.amount,0);
 const readyTotal=readyToPay.reduce((s,e)=>s+e.amount,0);

 return <div className="page-stack">
  <header className="page-header"><div><p className="page-eyebrow">Overview</p><h1 className="page-title">Outstanding</h1><p className="page-description">Everything across the business that still needs to move: receipts owed, approved expenses waiting on payment, and anything that needs attention. Nothing here needs your action directly - it's a place to keep an eye on what's outstanding and nudge people if needed.</p></div></header>

  <section className="metric-grid" aria-label="Outstanding summary">
   <div className="metric-card"><div className="metric-card-top"><div className="metric-icon"><ReceiptText size={17} strokeWidth={2.2}/></div></div><p className="metric-label">Missing receipts</p><p className="metric-value">{missingReceipts.length}</p><div className="metric-card-footer"><p className="metric-note">{money(receiptsTotal)} in advances awaiting proof</p></div></div>
   <div className="metric-card metric-card-blue"><div className="metric-card-top"><div className="metric-icon"><Clock3 size={17} strokeWidth={2.2}/></div></div><p className="metric-label">Awaiting payment</p><p className="metric-value">{readyToPay.length}</p><div className="metric-card-footer"><p className="metric-note">{money(readyTotal)} approved, not yet paid</p></div></div>
   {paymentIssues.length>0&&<div className="metric-card metric-card-purple"><div className="metric-card-top"><div className="metric-icon"><CircleAlert size={17} strokeWidth={2.2}/></div></div><p className="metric-label">Payment issues</p><p className="metric-value">{paymentIssues.length}</p><div className="metric-card-footer"><p className="metric-note">Failed - needs a look in Payments</p></div></div>}
  </section>

  <section className="panel overflow-hidden">
   <div className="panel-header"><div><p className="panel-kicker">Receipts</p><h2 className="panel-title">Missing receipts</h2><p className="panel-subtitle">Advances that have been paid out but still don't have a receipt uploaded.</p></div></div>
   {missingReceipts.length===0?<div className="empty-state m-4">Nothing outstanding - every advance has a receipt.</div>:<div className="divide-y divide-slate-100">{missingReceipts.map(e=>{const overdue=e.receiptDueAt?daysSince(e.receiptDueAt):null;return <div key={e.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{e.description}</p><p className="mt-0.5 truncate text-xs text-slate-500">{e.user.name||e.user.email} &middot; {e.team.name}{e.reminderCount>0&&` · ${e.reminderCount} reminder${e.reminderCount===1?'':'s'} sent`}</p></div><div className="flex shrink-0 items-center gap-3"><span className="font-semibold text-slate-900">{money(e.amount)}</span>{overdue!==null&&<span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${overdue>0?'border-orange-200 bg-orange-50 text-orange-700':'border-slate-200 bg-slate-50 text-slate-600'}`}>{overdue>0?`${dayLabel(overdue)} overdue`:'Due soon'}</span>}</div></div>;})}</div>}
  </section>

  <section className="panel overflow-hidden">
   <div className="panel-header"><div><p className="panel-kicker">Payments</p><h2 className="panel-title">Awaiting payment</h2><p className="panel-subtitle">Approved and ready, but not yet picked up by a Wise batch.</p></div><Link href="/dashboard/payments" className="panel-link">Open Payments <Clock3 size={13}/></Link></div>
   {readyToPay.length===0?<div className="empty-state m-4">Nothing waiting on payment.</div>:<div className="divide-y divide-slate-100">{readyToPay.map(e=>{const since=e.decidedAt||e.purchasedAt||e.submittedAt;const waiting=daysSince(since);const missingBank=!e.user.bankAccountName||!e.user.bankSortCode||!e.user.bankAccountNumber;return <div key={e.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{e.description}</p><p className="mt-0.5 truncate text-xs text-slate-500">{e.user.name||e.user.email} &middot; {e.team.name}{missingBank&&' · Missing bank details'}</p></div><div className="flex shrink-0 items-center gap-3"><span className="font-semibold text-slate-900">{money(e.amount)}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${waiting>=7?'border-blue-200 bg-blue-50 text-blue-700':'border-slate-200 bg-slate-50 text-slate-600'}`}>{dayLabel(waiting)} waiting</span></div></div>;})}</div>}
  </section>

  {paymentIssues.length>0&&<section className="panel overflow-hidden">
   <div className="panel-header"><div><p className="panel-kicker">Attention</p><h2 className="panel-title">Payment issues</h2><p className="panel-subtitle">Transfers that failed and will need to be retried from Payments.</p></div><Link href="/dashboard/payments" className="panel-link">Open Payments <CircleAlert size={13}/></Link></div>
   <div className="divide-y divide-slate-100">{paymentIssues.map(e=><div key={e.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{e.description}</p><p className="mt-0.5 truncate text-xs text-slate-500">{e.user.name||e.user.email} &middot; {e.team.name}</p></div><span className="shrink-0 font-semibold text-slate-900">{money(e.amount)}</span></div>)}</div>
  </section>}

  <section>
   <div className="mb-4"><p className="panel-kicker">Export</p><h2 className="font-semibold text-slate-950">Activity log</h2><p className="mt-1 text-sm text-slate-500">Export the full activity log for a date range, including rejections, cancellations and failed payments.</p></div>
</section>
 </div>;
}
