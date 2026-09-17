import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
export async function GET(req:NextRequest){
 if (!isAuthorizedCronRequest(req)) return NextResponse.json({error:'Unauthorized'},{status:401});
 const now=new Date();
 const expenses=await prisma.expense.findMany({where:{receiptUrl:null,receiptDueAt:{lte:now},status:'ADVANCE_PAID_AWAITING_RECEIPT'},include:{user:true,team:true},orderBy:{receiptDueAt:'asc'},take:100});
 let sent=0;
 if(process.env.RESEND_API_KEY&&process.env.RESEND_FROM){const {Resend}=await import('resend');const resend=new Resend(process.env.RESEND_API_KEY);for(const e of expenses){if(!e.user.email)continue;const appUrl=process.env.NEXTAUTH_URL||(process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:'');const url=`${appUrl}/dashboard/expense-history`;const subject='Receipt required for your advance';const text=`You received an advance of £${e.amount.toFixed(2)} for ${e.description}. Please upload the receipt after the purchase.`;try{const r=await resend.emails.send({from:process.env.RESEND_FROM,to:e.user.email,subject,html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2>${subject}</h2><p>${escapeHtml(text)}</p><div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0"><strong>£${e.amount.toFixed(2)}</strong><p>${escapeHtml(e.description)}</p><p style="color:#64748b">${escapeHtml(e.team.name)}</p></div>${url?`<a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Upload receipt</a>`:''}</div>`,text});if(!r.error){sent++;await prisma.expense.update({where:{id:e.id},data:{lastReminderAt:now,reminderCount:{increment:1},receiptDueAt:new Date(now.getTime()+7*24*60*60*1000)}})}}catch(err){console.error('Receipt reminder failed',e.id,err)}}}
 return NextResponse.json({checked:expenses.length,sent});
}
