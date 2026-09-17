import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildStatementPdf } from '@/lib/pdf';
import { formatReportDate } from '@/lib/date';
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions); if (!session?.user) return NextResponse.json({error:'Not signed in.'},{status:401});
  const user = session.user; if (!user.isAdmin) return NextResponse.json({error:'Forbidden.'},{status:403});
  const sp = new URL(req.url).searchParams; const teamId=sp.get('team'); const startValue=sp.get('start'); const endValue=sp.get('end');
  if (!startValue || !endValue) return NextResponse.json({error:'start and end are required.'},{status:400});
  const start=new Date(`${startValue}T00:00:00`), end=new Date(`${endValue}T23:59:59.999`); if (start>end) return NextResponse.json({error:'Invalid date range.'},{status:400});
  const where:any={date:{gte:start,lt:new Date(end.getTime()+1)},status:{notIn:['CANCELLED','REJECTED','PAYMENT_FAILED']},paymentStatus:{not:'FAILED'}};
  let title='All teams';
  if(teamId){ const team=await prisma.team.findUnique({where:{id:teamId}}); if(!team)return NextResponse.json({error:'Team not found.'},{status:404}); where.teamId=teamId; title=team.name; }
  const expenses=await prisma.expense.findMany({where,include:{user:true,team:true},orderBy:{date:'asc'}});
  const items=expenses.map(e=>({date:formatReportDate(e.date),teamName:e.team.name,userName:e.user.name??e.user.email??'',description:e.description,settlementNote:e.settlementNote,amount:e.amount}));
  const label=`${formatReportDate(start)} – ${formatReportDate(end)}`;
  const buffer=await buildStatementPdf(title,label,items);
  return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${title} - Expense Report - ${formatReportDate(start)} to ${formatReportDate(end)}.pdf"`}});
}
