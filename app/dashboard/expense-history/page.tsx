import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DateRangeFilter from '@/components/DateRangeFilter';
import ExpenseHistoryTable from '@/components/ExpenseHistoryTable';
import { STATUS_META } from '@/components/StatusPill';

const isoFirstOfMonth=()=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10)};
const isoToday=()=>new Date().toISOString().slice(0,10);
const fmt=(n:number)=>`£${n.toFixed(2)}`;
const toRow=(e:any)=>({id:e.id,date:e.date.toISOString(),description:e.description,amount:e.amount,teamId:e.teamId,teamName:e.team.name,receiptUrl:e.receiptUrl,status:e.status,purchaseStatus:e.purchaseStatus,paymentTiming:e.paymentTiming,receiptDueAt:e.receiptDueAt?.toISOString()||null,paymentStatus:e.paymentStatus,settlementStatus:e.settlementStatus,settlementNote:e.settlementNote,submittedAt:e.submittedAt.toISOString(),approvedAmount:e.approvedAmount,actualAmount:e.actualAmount,decidedAt:e.decidedAt?.toISOString()||null,decisionNote:e.decisionNote,relatedExpenseId:e.relatedExpenseId});

export default async function ExpenseHistoryPage({searchParams}:{searchParams:{from?:string;to?:string;status?:string;expenseId?:string}}){
 const session=await getServerSession(authOptions);if(!session?.user)redirect('/login');const user=session.user;
 const status=typeof searchParams.status==='string'&&searchParams.status.trim()?searchParams.status:undefined;
 const expenseId=typeof searchParams.expenseId==='string'&&searchParams.expenseId.trim()?searchParams.expenseId:undefined;
 // A status filter (e.g. from the "Waiting for approval" card) can point at expenses
 // logged outside the current month. Rather than defaulting to an arbitrary/fake
 // earliest date, only apply the date range the person can actually see/edit: their
 // own oldest expense if there's no explicit from/to yet.
 const needsUnboundedDefault=Boolean(status)&&!searchParams.from;
 const earliest=needsUnboundedDefault?await prisma.expense.aggregate({where:{userId:user.id},_min:{date:true}}):null;
 const from=searchParams.from||(needsUnboundedDefault?(earliest?._min.date?.toISOString().slice(0,10)||isoFirstOfMonth()):isoFirstOfMonth()),to=searchParams.to||isoToday();const fromDate=new Date(`${from}T00:00:00`),toDate=new Date(`${to}T23:59:59.999`);
 const [teams,expenses,openExpense]=await Promise.all([
  prisma.team.findMany({orderBy:{name:'asc'}}),
  prisma.expense.findMany({where:{userId:user.id,date:{gte:fromDate,lte:toDate},...(status?{status:status as any}:{})},include:{team:true},orderBy:[{date:'desc'},{submittedAt:'desc'},{id:'desc'}]}),
  expenseId?prisma.expense.findFirst({where:{id:expenseId,userId:user.id},include:{team:true}}):Promise.resolve(null),
 ]);
 const total=expenses.reduce((s,e)=>s+e.amount,0);
 const rows=expenses.map(toRow);
 const statusLabel=status?(STATUS_META[status]?.label||status):null;
 return <div className="page-stack">
  <header className="page-header"><div><p className="page-eyebrow">History</p><h1 className="page-title">Expense History</h1><p className="page-description">A simple record of your submitted expenses. Select an expense to see more details or view its receipt.</p></div></header>
  {statusLabel&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F3D36A] bg-[#FFF8E1] px-4 py-3 text-sm">
    <span className="font-semibold text-[#7A5A00]">Showing only: {statusLabel}</span>
    <Link href="/dashboard/expense-history" className="inline-flex items-center gap-1.5 rounded-lg border border-[#e3c65a] bg-white px-3 py-1.5 text-xs font-bold text-[#7A5A00] hover:bg-[#FFF3CD]"><XCircle size={14}/> Clear filter · Back to full view</Link>
  </div>}
  <DateRangeFilter from={from} to={to}/>
  <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">{expenses.length} expense{expenses.length===1?'':'s'}</h2><span className="text-sm font-semibold text-slate-600">{fmt(total)} total</span></div>
  {expenses.length===0?<div className="empty-state">Nothing logged in this date range.</div>:<ExpenseHistoryTable expenses={rows} teams={teams.map(t=>({id:t.id,name:t.name}))} openExpense={openExpense?toRow(openExpense):null}/>}
 </div>;
}
