'use client';
import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle, ReceiptText, WalletCards } from 'lucide-react';
import { decideExpense } from '@/app/actions/expenses';
import StatusPill from './StatusPill';

const fmt=(n:number)=>`£${n.toFixed(2)}`;
export default function ApprovalRow({ expense, isAdmin }: { expense: { id:string; description:string; amount:number; date:string; userName:string; teamName:string; purchaseStatus:string; paymentTiming:string; receiptUrl:string|null; status:string; relatedExpenseId?:string|null }; isAdmin:boolean }) {
 const [note,setNote]=useState(''); const [pending,startTransition]=useTransition(); const [action,setAction]=useState<string|null>(null); const [feedback,setFeedback]=useState(''); const [error,setError]=useState('');
 function decide(status:'APPROVED'|'REJECTED'){
  if (status==='REJECTED' && !window.confirm('Reject this expense? The requester will be notified and the expense will remain rejected.')) return;
  setAction(status); setFeedback(''); setError('');
  startTransition(async()=>{
   try{
    await decideExpense(expense.id,status,note);
    setFeedback(status==='APPROVED' ? 'Expense approved successfully. It has been added to the payment process.' : 'Expense rejected successfully. The requester has been notified.');
   } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
   } finally { setAction(null); }
  })
 }
 const mode=expense.purchaseStatus==='ALREADY_PURCHASED'?'Already purchased':expense.paymentTiming==='ADVANCE'?'Needs advance':'Will purchase later and claim reimbursement';
 return <div className="panel p-5">
   <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-semibold text-stone-900">{expense.description}</p><p className="mt-1 text-xs text-stone-500">{expense.userName} · {expense.teamName} · {expense.date}</p></div><div className="flex shrink-0 items-center gap-2"><StatusPill status={expense.status}/><span className="font-bold text-stone-900">{fmt(expense.amount)}</span></div></div>
   <div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"><WalletCards size={13}/>{mode}</span>{expense.receiptUrl && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8E1] px-2.5 py-1 text-xs font-medium text-[#C99600]"><ReceiptText size={13}/>Receipt attached</span>}</div>
   {expense.receiptUrl && <a href={`/api/receipts/${expense.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-[#C99600] hover:underline">View receipt</a>}
   <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note for the requester" className="mt-4 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C99600]" />
   <div className="mt-3 flex gap-2"><button disabled={pending} onClick={()=>decide('APPROVED')} className="flex items-center gap-1.5 rounded-xl bg-[#C99600] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><CheckCircle2 size={15}/>{action==='APPROVED'?'Approving…':'Approve'}</button>{(!expense.relatedExpenseId || isAdmin) && <button disabled={pending} onClick={()=>decide('REJECTED')} className="flex items-center gap-1.5 rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"><XCircle size={15}/>{action==='REJECTED'?'Rejecting…':'Reject'}</button>}{expense.relatedExpenseId&&!isAdmin&&<p className="self-center text-xs font-medium text-slate-500">Only an admin can reject an additional reimbursement.</p>}</div>
   {feedback && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">{feedback}</p>}
   {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}
 </div>;
}
