import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import * as XLSX from 'xlsx';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatReportDate } from '@/lib/date';

export async function GET(req:NextRequest){
 const session=await getServerSession(authOptions);if(!session?.user)return NextResponse.json({error:'Not signed in.'},{status:401});
 const user=session.user as any;if(!user.isAdmin)return NextResponse.json({error:'Forbidden.'},{status:403});
 const sp=new URL(req.url).searchParams;const startValue=sp.get('start');const endValue=sp.get('end');const teamId=sp.get('team');let dateFilter:any=undefined;
 if(startValue&&endValue){const start=new Date(`${startValue}T00:00:00`),end=new Date(`${endValue}T23:59:59.999`);if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end)return NextResponse.json({error:'Invalid date range.'},{status:400});dateFilter={gte:start,lt:new Date(end.getTime()+1)}}
 const where:any={...(dateFilter?{date:dateFilter}:{}),...(teamId?{teamId}: {})};
 const expenses=await prisma.expense.findMany({where,include:{team:true,user:true},orderBy:{date:'desc'}});
 const rows=expenses.map(e=>({Date:formatReportDate(e.date),Team:e.team.name,Employee:e.user.name??'',Email:e.user.email??'',Description:e.description,Amount:e.amount,'Purchase status':e.purchaseStatus,'Payment timing':e.paymentTiming,Status:e.status,'Has receipt':e.receiptUrl?'Yes':'No','Payment status':e.paymentStatus,'Payment run':e.paymentReference??'','Settlement status':e.settlementStatus==='NOT_APPLICABLE'?'':e.settlementStatus,'Settlement note':e.settlementNote??''}));
 const paymentRows=expenses.filter(e=>e.status==='READY_TO_PAY'&&e.user.bankSortCode&&e.user.bankAccountNumber).map(e=>({'Account name':e.user.bankAccountName??'','Sort code':e.user.bankSortCode??'','Account number':e.user.bankAccountNumber??'',Amount:e.amount,Reference:e.paymentReference??`EXP-${e.id.slice(-8).toUpperCase()}`,Employee:e.user.name??e.user.email??'',Team:e.team.name}));
 const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(rows);const pws=XLSX.utils.json_to_sheet(paymentRows);ws['!cols']=[{wch:12},{wch:18},{wch:20},{wch:28},{wch:35},{wch:12},{wch:24},{wch:28},{wch:12},{wch:18},{wch:22},{wch:26},{wch:45}];pws['!cols']=[{wch:24},{wch:12},{wch:16},{wch:12},{wch:22},{wch:24},{wch:20}];XLSX.utils.book_append_sheet(wb,ws,'Expenses');XLSX.utils.book_append_sheet(wb,pws,'Payment instructions');
 const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${startValue&&endValue?`Expense Report - ${formatReportDate(new Date(`${startValue}T00:00:00`))} to ${formatReportDate(new Date(`${endValue}T00:00:00`))}`:'Expense Report'}.xlsx"`} });
}
