import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExpenseForm from '@/components/ExpenseForm';
import ExpenseRow from '@/components/ExpenseRow';
import DateRangeFilter from '@/components/DateRangeFilter';
import BankDetailsForm from '@/components/BankDetailsForm';
import { decryptBankDetail } from '@/lib/bank';

const fmt=(n:number)=>`£${n.toFixed(2)}`;
const isoFirstOfMonth=()=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10)};
const isoToday=()=>new Date().toISOString().slice(0,10);

export default async function ExpensesPage({searchParams}:{searchParams:{from?:string;to?:string}}){
 const session=await getServerSession(authOptions);if(!session?.user)redirect('/login');const user=session.user as any;
 const from=searchParams.from||isoFirstOfMonth(),to=searchParams.to||isoToday();const fromDate=new Date(`${from}T00:00:00`),toDate=new Date(`${to}T23:59:59.999`);
 const [teams,expenses,dbUser]=await Promise.all([
  prisma.team.findMany({orderBy:{name:'asc'}}),
  prisma.expense.findMany({where:{userId:user.id,date:{gte:fromDate,lte:toDate}},include:{team:true},orderBy:{date:'desc'}}),
  prisma.user.findUnique({where:{id:user.id},select:{bankAccountName:true,bankSortCode:true,bankAccountNumber:true}}),
 ]);
 const total=expenses.reduce((s,e)=>s+e.amount,0);const teamList=teams.map(t=>({id:t.id,name:t.name}));
 return <div className="page-stack">
  <header className="page-header"><div><p className="page-eyebrow">Expenses</p><h1 className="page-title">Submit and manage expenses</h1><p className="page-description">Add a reimbursement or advance request, then keep track of its status and receipt.</p></div></header>
  {teams.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">No teams have been set up yet.</div>:<div className="grid gap-6 xl:grid-cols-[minmax(320px,430px)_1fr]">
   <div className="space-y-5"><ExpenseForm teams={teamList} hasBankDetails={!!(dbUser?.bankAccountName && dbUser?.bankSortCode && dbUser?.bankAccountNumber)}/><section id="payment-details" className="scroll-mt-24 panel p-5 shadow-none"><h2 className="font-semibold text-slate-950">Your payment details</h2><p className="mt-1 mb-4 text-xs text-slate-500">These are used when an approved reimbursement or advance is prepared for payment</p><BankDetailsForm initial={{accountName:decryptBankDetail(dbUser?.bankAccountName),sortCode:decryptBankDetail(dbUser?.bankSortCode),accountNumber:decryptBankDetail(dbUser?.bankAccountNumber)}}/></section></div>
   <section className="min-w-0 space-y-4"><DateRangeFilter from={from} to={to}/><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">{expenses.length} expense{expenses.length===1?'':'s'}</h2><span className="text-sm font-semibold text-slate-600">{fmt(total)} total</span></div>
   {expenses.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">Nothing logged in this date range.</div>:<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="hidden sm:block"><div className="grid grid-cols-[150px_minmax(320px,1fr)_170px_105px_90px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Date</span><span>Expense</span><span>Team</span><span className="text-right">Amount</span><span className="text-right">Receipt</span></div>{expenses.map(e=><ExpenseRow key={e.id} variant="desktop" teams={teamList} expense={{id:e.id,date:e.date.toISOString().slice(0,10),description:e.description,amount:e.amount,teamId:e.teamId,teamName:e.team.name,receiptUrl:e.receiptUrl,status:e.status,purchaseStatus:e.purchaseStatus,paymentTiming:e.paymentTiming,receiptDueAt:e.receiptDueAt?.toISOString()||null,paymentStatus:e.paymentStatus,settlementStatus:e.settlementStatus,settlementNote:e.settlementNote}}/>)}</div><div className="sm:hidden">{expenses.map(e=><ExpenseRow key={e.id} variant="mobile" teams={teamList} expense={{id:e.id,date:e.date.toISOString().slice(0,10),description:e.description,amount:e.amount,teamId:e.teamId,teamName:e.team.name,receiptUrl:e.receiptUrl,status:e.status,purchaseStatus:e.purchaseStatus,paymentTiming:e.paymentTiming,receiptDueAt:e.receiptDueAt?.toISOString()||null,paymentStatus:e.paymentStatus,settlementStatus:e.settlementStatus,settlementNote:e.settlementNote}}/>)}</div></div>}
   </section>
  </div>}
 </div>;
}
