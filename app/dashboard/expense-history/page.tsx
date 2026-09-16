import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DateRangeFilter from '@/components/DateRangeFilter';
import ExpenseHistoryTable from '@/components/ExpenseHistoryTable';

const isoFirstOfMonth=()=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10)};
const isoToday=()=>new Date().toISOString().slice(0,10);
const fmt=(n:number)=>`£${n.toFixed(2)}`;

export default async function ExpenseHistoryPage({searchParams}:{searchParams:{from?:string;to?:string}}){
 const session=await getServerSession(authOptions);if(!session?.user)redirect('/login');const user=session.user as any;
 const from=searchParams.from||isoFirstOfMonth(),to=searchParams.to||isoToday();const fromDate=new Date(`${from}T00:00:00`),toDate=new Date(`${to}T23:59:59.999`);
 const [teams,expenses]=await Promise.all([
  prisma.team.findMany({orderBy:{name:'asc'}}),
  prisma.expense.findMany({where:{userId:user.id,date:{gte:fromDate,lte:toDate}},include:{team:true},orderBy:{date:'desc'}}),
 ]);
 const total=expenses.reduce((s,e)=>s+e.amount,0);
 const rows=expenses.map(e=>({id:e.id,date:e.date.toISOString(),description:e.description,amount:e.amount,teamId:e.teamId,teamName:e.team.name,receiptUrl:e.receiptUrl,status:e.status,purchaseStatus:e.purchaseStatus,paymentTiming:e.paymentTiming,receiptDueAt:e.receiptDueAt?.toISOString()||null,paymentStatus:e.paymentStatus,settlementStatus:e.settlementStatus,settlementNote:e.settlementNote,submittedAt:e.submittedAt.toISOString(),approvedAmount:e.approvedAmount,actualAmount:e.actualAmount,decidedAt:e.decidedAt?.toISOString()||null,decisionNote:e.decisionNote,relatedExpenseId:e.relatedExpenseId}));
 return <div className="page-stack"><header className="page-header"><div><p className="page-eyebrow">History</p><h1 className="page-title">Expense History</h1><p className="page-description">A simple record of your submitted expenses. Select an expense to see more details or view its receipt.</p></div></header><DateRangeFilter from={from} to={to}/><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">{expenses.length} expense{expenses.length===1?'':'s'}</h2><span className="text-sm font-semibold text-slate-600">{fmt(total)} total</span></div>{expenses.length===0?<div className="empty-state">Nothing logged in this date range.</div>:<ExpenseHistoryTable expenses={rows} teams={teams.map(t=>({id:t.id,name:t.name}))}/>}</div>;
}
