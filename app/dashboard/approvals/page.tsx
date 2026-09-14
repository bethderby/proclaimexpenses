import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ApprovalRow from '@/components/ApprovalRow';

export default async function ApprovalsPage(){
 const session=await getServerSession(authOptions);if(!session?.user)redirect('/login');const user=session.user as any;if(!user.isApprover&&!user.isAdmin)redirect('/dashboard');
 const items=await prisma.expense.findMany({where:user.isAdmin?{status:'PENDING'}:{status:'PENDING',team:{OR:[{approverEmail:{equals:user.email,mode:'insensitive'}},{members:{some:{userId:user.id,role:'APPROVER'}}}]}},include:{user:true,team:true},orderBy:{submittedAt:'asc'}});
 return <div><h2 className="text-2xl font-semibold text-stone-900 tracking-tight mb-1">Approvals</h2><p className="text-sm text-stone-500 mb-6">Review expenses before they can be paid. Advances are paid before the purchase; normal reimbursements are paid after the receipt is available.</p>{items.length===0?<div className="border border-dashed border-stone-300 rounded-2xl py-14 text-center text-sm text-stone-400">Nothing waiting on you right now.</div>:<div className="space-y-4">{items.map(e=><ApprovalRow key={e.id} expense={{id:e.id,description:e.description,amount:e.amount,date:e.date.toISOString().slice(0,10),userName:e.user.name??e.user.email??'Unknown',teamName:e.team.name,purchaseStatus:e.purchaseStatus,paymentTiming:e.paymentTiming,receiptUrl:e.receiptUrl,status:e.status}}/>)}</div>}</div>;
}
