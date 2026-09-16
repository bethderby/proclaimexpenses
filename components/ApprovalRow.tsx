'use client';
import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle, ReceiptText, WalletCards } from 'lucide-react';
import { decideExpense } from '@/app/actions';
import StatusPill from './StatusPill';

const fmt=(n:number)=>`£${n.toFixed(2)}`;
export default function ApprovalRow({ expense }: { expense: { id:string; description:string; amount:number; date:string; userName:string; teamName:string; purchaseStatus:string; paymentTiming:string; receiptUrl:string|null; status:string } }) {
 const [note,setNote]=useState(''); const [pending,startTransition]=useTransition(); const [action,setAction]=useState<string|null>(null);
 function decide(status:'APPROVED'|'REJECTED'){setAction(status);startTransition(async()=>{try{await decideExpense(expense.id,status,note)}finally{setAction(null)}})}
 const mode=expense.purchaseStatus==='ALREADY_PURCHASED'?'Already purchased':expense.paymentTiming==='ADVANCE'?'Needs advance':'Will purchase later and claim reimbursement';
 return <div className="panel p-5">
   <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-semibold text-stone-900">{expense.description}</p><p className="mt-1 text-xs text-stone-500">{expense.userName} · {expense.teamName} · {expense.date}</p></div><div className="flex shrink-0 items-center gap-2"><StatusPill status={expense.status}/><span className="font-bold text-stone-900">{fmt(expense.amount)}</span></div></div>
   <div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"><WalletCards size={13}/>{mode}</span>{expense.receiptUrl && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8E1] px-2.5 py-1 text-xs font-medium text-[#C99600]"><ReceiptText size={13}/>Receipt attached</span>}</div>
   {expense.receiptUrl && <a href={`/api/receipts/${expense.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-[#C99600] hover:underline">View receipt</a>}
   <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note for the requester" className="mt-4 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C99600]" />
   <div className="mt-3 flex gap-2"><button disabled={pending} onClick={()=>decide('APPROVED')} className="flex items-center gap-1.5 rounded-xl bg-[#C99600] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><CheckCircle2 size={15}/>{action==='APPROVED'?'Approving…':'Approve'}</button><button disabled={pending} onClick={()=>decide('REJECTED')} className="flex items-center gap-1.5 rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"><XCircle size={15}/>{action==='REJECTED'?'Rejecting…':'Reject'}</button></div>
 </div>;
}
