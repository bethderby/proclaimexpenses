import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExpenseForm from '@/components/ExpenseForm';
import BankDetailsForm from '@/components/BankDetailsForm';
import { decryptBankDetail } from '@/lib/bank';

export default async function ExpensesPage(){
 const session=await getServerSession(authOptions);if(!session?.user)redirect('/login');const user=session.user;
 const [teams,dbUser]=await Promise.all([
  prisma.team.findMany({orderBy:{name:'asc'}}),
  prisma.user.findUnique({where:{id:user.id},select:{bankAccountName:true,bankSortCode:true,bankAccountNumber:true}}),
 ]);
 const teamList=teams.map(t=>({id:t.id,name:t.name}));
 return <div className="page-stack">
  <header className="page-header"><div><p className="page-eyebrow">Submit expense</p><h1 className="page-title">Submit an expense</h1><p className="page-description">Request a reimbursement or advance, then track the outcome in Expense History.</p></div></header>
  {teams.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">No teams have been set up yet.</div>:<div className="grid max-w-5xl gap-6 xl:grid-cols-[minmax(320px,560px)_minmax(280px,1fr)]">
   <ExpenseForm teams={teamList} hasBankDetails={!!(dbUser?.bankAccountName && dbUser?.bankSortCode && dbUser?.bankAccountNumber)}/>
   <section id="payment-details" className="scroll-mt-24 panel h-fit p-5"><h2 className="font-semibold text-slate-950">Your payment details</h2><p className="mt-1 mb-4 text-xs text-slate-500">These are used when an approved reimbursement or advance is prepared for payment</p><BankDetailsForm initial={{accountName:decryptBankDetail(dbUser?.bankAccountName),sortCode:decryptBankDetail(dbUser?.bankSortCode),accountNumber:decryptBankDetail(dbUser?.bankAccountNumber)}}/></section>
  </div>}
 </div>;
}
