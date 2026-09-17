import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import * as XLSX from 'xlsx';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatReportDate, formatUKDateTime } from '@/lib/date';

// Unlike /api/export/xlsx (the financial Expense Report, which only includes
// successful spend), this is a full audit trail: every expense that existed
// in the date range, whatever happened to it - rejected, cancelled, a failed
// payment, all of it.
export async function GET(req:NextRequest){
 const session=await getServerSession(authOptions);if(!session?.user)return NextResponse.json({error:'Not signed in.'},{status:401});
 const user=session.user as any;if(!user.isAdmin)return NextResponse.json({error:'Forbidden.'},{status:403});
 const sp=new URL(req.url).searchParams;const startValue=sp.get('start');const endValue=sp.get('end');const teamId=sp.get('team');
 if(!startValue||!endValue)return NextResponse.json({error:'start and end are required.'},{status:400});
 const start=new Date(`${startValue}T00:00:00`),end=new Date(`${endValue}T23:59:59.999`);
 if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end)return NextResponse.json({error:'Invalid date range.'},{status:400});
 const where:any={date:{gte:start,lt:new Date(end.getTime()+1)},...(teamId?{teamId}:{})};
 const expenses=await prisma.expense.findMany({where,include:{team:true,user:true},orderBy:[{date:'desc'},{submittedAt:'desc'}]});
 const rows=expenses.map(e=>({Date:formatReportDate(e.date),Team:e.team.name,Employee:e.user.name??'',Email:e.user.email??'',Description:e.description,Amount:e.amount,Status:e.status,'Purchase status':e.purchaseStatus,'Payment timing':e.paymentTiming,'Has receipt':e.receiptUrl?'Yes':'No','Payment status':e.paymentStatus,'Wise status':e.wiseStatus??'','Payment run':e.paymentReference??'','Settlement status':e.settlementStatus==='NOT_APPLICABLE'?'':e.settlementStatus,'Settlement note':e.settlementNote??'','Decision note':e.decisionNote??'','Submitted':formatUKDateTime(e.submittedAt),'Decided':e.decidedAt?formatUKDateTime(e.decidedAt):'','Paid':e.paidAt?formatUKDateTime(e.paidAt):''}));
 const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(rows);
 ws['!cols']=[{wch:12},{wch:18},{wch:20},{wch:28},{wch:35},{wch:12},{wch:26},{wch:16},{wch:16},{wch:12},{wch:14},{wch:14},{wch:22},{wch:26},{wch:35},{wch:35},{wch:16},{wch:16},{wch:16}];
 XLSX.utils.book_append_sheet(wb,ws,'Activity log');
 const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
 const filename=`Activity Log - ${formatReportDate(start)} to ${formatReportDate(end)}.xlsx`;
 return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${filename}"`}});
}
