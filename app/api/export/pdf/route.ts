import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildStatementPdf } from '@/lib/pdf';
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions); if (!session?.user) return NextResponse.json({error:'Not signed in.'},{status:401});
  const sp = new URL(req.url).searchParams; const teamId=sp.get('team'); const startValue=sp.get('start'); const endValue=sp.get('end');
  if (!startValue || !endValue) return NextResponse.json({error:'start and end are required.'},{status:400});
  const start=new Date(`${startValue}T00:00:00`), end=new Date(`${endValue}T23:59:59.999`); if (start>end) return NextResponse.json({error:'Invalid date range.'},{status:400});
  const where:any={date:{gte:start,lt:new Date(end.getTime()+1)}};
  let title='All teams';
  if(teamId){ const team=await prisma.team.findUnique({where:{id:teamId}}); if(!team)return NextResponse.json({error:'Team not found.'},{status:404}); where.teamId=teamId; title=team.name; }
  const expenses=await prisma.expense.findMany({where,include:{user:true,team:true},orderBy:{date:'asc'}});
  const items=expenses.map(e=>({date:e.date.toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'}),teamName:e.team.name,userName:e.user.name??e.user.email??'',description:e.description,amount:e.amount}));
  const label=`${start.toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'})} – ${end.toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'})}`;
  const buffer=await buildStatementPdf(title,label,items);
  return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="proclaim-${startValue}-to-${endValue}.pdf"`}});
}
