import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptBankDetail } from '@/lib/bank';

export async function GET(req:NextRequest){
 const session=await getServerSession(authOptions);if(!session?.user)return NextResponse.json({error:'Not signed in.'},{status:401});const user=session.user as any;if(!user.isAdmin&&!user.isApprover)return NextResponse.json({error:'Forbidden.'},{status:403});
 const runId=new URL(req.url).searchParams.get('runId');if(!runId)return NextResponse.json({error:'runId is required.'},{status:400});
 const run=await prisma.paymentRun.findUnique({where:{id:runId},include:{expenses:{include:{user:true,team:{include:{members:true}}}}}});if(!run)return NextResponse.json({error:'Payment run not found.'},{status:404});
 if(!user.isAdmin){const approverEmail=(user.email??'').toLowerCase();const allowed=run.expenses.some(e=>e.team.approverEmail?.toLowerCase()===approverEmail||e.team.members.some(m=>m.userId===user.id&&m.role==='APPROVER'));if(!allowed)return NextResponse.json({error:'Forbidden.'},{status:403});}
 const escape=(v:string)=>`"${String(v??'').replace(/"/g,'""')}"`;
 const rows=[['Account name','Sort code','Account number','Amount','Reference','Employee','Team'],...run.expenses.map(e=>[decryptBankDetail(e.user.bankAccountName),decryptBankDetail(e.user.bankSortCode),decryptBankDetail(e.user.bankAccountNumber),e.amount.toFixed(2),e.paymentReference||run.reference,e.user.name||e.user.email||'',e.team.name])];
 const csv=rows.map(r=>r.map(escape).join(',')).join('\r\n');
 await prisma.paymentRun.update({where:{id:runId},data:{status:run.status==='COMPLETED'?'COMPLETED':'WISE_PREPARED',exportedAt:run.exportedAt||new Date()}});
 return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${run.reference}.csv"`}});
}
