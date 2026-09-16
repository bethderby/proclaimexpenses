import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ApprovalRow from '@/components/ApprovalRow';

export default async function ApprovalsPage(){
 const session=await getServerSession(authOptions);if(!session?.user)redirect('/login');const user=session.user as any;if(!user.isApprover&&!user.isAdmin)redirect('/dashboard');
 const items=await prisma.expense.findMany({where:user.isAdmin?{status:'PENDING'}:{status:'PENDING',team:{approverEmails:{has:(user.email??'').toLowerCase()}}},include:{user:true,team:true},orderBy:{submittedAt:'asc'}});
 return <div className="page-stack"><header><p className="page-eyebrow">Approvals</p><h1 className="page-title">Review expenses</h1><p className="page-description">Check each request before it moves on to payment. Advances are paid before the purchase; reimbursements follow the receipt.</p></header>{items.length===0?<div className="empty-state">Nothing waiting on you right now.</div>:<div className="space-y-4">{items.map(e=><ApprovalRow key={e.id} expense={{id:e.id,description:e.description,amount:e.amount,date:e.date.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}),userName:e.user.name??e.user.email??'Unknown',teamName:e.team.name,purchaseStatus:e.purchaseStatus,paymentTiming:e.paymentTiming,receiptUrl:e.receiptUrl,status:e.status}}/>)}</div>}</div>;
}
