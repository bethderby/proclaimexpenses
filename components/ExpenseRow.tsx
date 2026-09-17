'use client';
import { useState } from 'react';
import { Paperclip, Pencil, XCircle } from 'lucide-react';
import EditExpenseForm from './EditExpenseForm';
import StatusPill from './StatusPill';
import MarkPurchasedForm from './MarkPurchasedForm';
import { cancelExpense } from '@/app/actions';

const fmt=(n:number)=>`£${n.toFixed(2)}`;
const fmtDate=(iso:string)=>new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'});
const modeLabel=(status:string,timing:string)=>status==='ALREADY_PURCHASED'?'Already purchased':timing==='ADVANCE'?'Advance requested':'Pay personally then reimburse';

export default function ExpenseRow({ expense, teams, variant }:{ expense:{id:string;date:string;description:string;amount:number;teamId:string;teamName:string;receiptUrl:string|null;status:string;purchaseStatus:string; paymentTiming:string; receiptDueAt:string|null;paymentStatus:string;settlementStatus:string;settlementNote:string|null;relatedExpenseId?:string|null}; teams:{id:string;name:string}[]; variant:'desktop'|'mobile' }){
 const [editing,setEditing]=useState(false);
 if(editing)return <div className="border-b border-slate-100 bg-slate-50/60 p-3"><EditExpenseForm expense={{id:expense.id,date:expense.date,description:expense.description,amount:expense.amount,teamId:expense.teamId}} teams={teams} onDone={()=>setEditing(false)}/></div>;

 const needsPurchaseAction = expense.status==='ADVANCE_PAID_AWAITING_RECEIPT';
 const canEdit = expense.status==='PENDING' && !expense.relatedExpenseId;
 const canCancel = expense.status==='PENDING' && !expense.relatedExpenseId;
 const hasActions = needsPurchaseAction || canEdit || canCancel;
 const settlementTone = expense.settlementStatus==='BALANCE_TO_RETURN' ? 'bg-amber-50 text-amber-800 border border-amber-200' : expense.settlementStatus==='ADDITIONAL_REIMBURSEMENT_REQUIRED' ? 'bg-[#FFF8E1] text-[#A97900] border border-[#F3D36A]' : '';

 const badges=<div className="inline-flex flex-wrap items-center gap-1.5">
   <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">{modeLabel(expense.purchaseStatus, expense.paymentTiming)}</span>
   {expense.receiptUrl && <span className="rounded-full bg-[#FFF8E1] px-2 py-0.5 text-[11px] font-medium text-[#C99600]">Receipt attached</span>}
   {needsPurchaseAction && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">Receipt after purchase</span>}
 </div>;

 const actions=hasActions && <div className="mt-2 flex flex-wrap items-center gap-1.5">
   {needsPurchaseAction && <MarkPurchasedForm expenseId={expense.id}/>} 
   {canEdit && <button onClick={()=>setEditing(true)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"><Pencil size={12}/> Edit</button>}
   {canCancel && <form action={cancelExpense}><input type="hidden" name="expenseId" value={expense.id}/><button className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700"><XCircle size={12}/> Cancel</button></form>}
 </div>;

 const extraDetails=<>
   {expense.receiptDueAt&&expense.status!=='PAID'&&<p className="mt-1.5 text-[11px] text-slate-500">Receipt reminder: {fmtDate(expense.receiptDueAt.slice(0,10))}</p>}
   {expense.settlementNote&&<p className={`mt-1.5 rounded-md px-2.5 py-1.5 text-[11px] ${settlementTone}`}>{expense.settlementNote}</p>}
   {actions}
 </>;

 if(variant==='desktop')return <div className="border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50/70">
   <div className="grid grid-cols-[150px_minmax(320px,1fr)_170px_105px_90px] items-center gap-4">
     <span className="text-sm text-slate-500">{fmtDate(expense.date)}</span>
     <div className="min-w-0">
       <div className="flex min-w-0 flex-wrap items-center gap-2">
         <p className="text-sm font-semibold text-slate-950">{expense.description}</p>
         <StatusPill status={expense.status}/>
         {badges}
       </div>
       {extraDetails}
     </div>
     <span className="truncate text-sm text-slate-500">{expense.teamName}</span>
     <span className="text-right text-sm font-semibold text-slate-950">{fmt(expense.amount)}</span>
     <div className="flex justify-end">
       {expense.receiptUrl ? <a href={`/api/receipts/${expense.id}`} target="_blank" rel="noreferrer" title="View receipt" aria-label="View receipt" className="inline-grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Paperclip size={15}/></a> : <span className="text-[11px] text-slate-400">No receipt</span>}
       {canEdit && <button onClick={()=>setEditing(true)} title="Edit" aria-label="Edit expense" className="ml-1 inline-grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Pencil size={14}/></button>}
     </div>
   </div>
 </div>;

 return <div className="border-b border-slate-100 p-3 last:border-0">
   <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
     <div className="flex items-start justify-between gap-3">
       <div className="min-w-0 flex-1">
         <p className="text-[11px] font-medium text-slate-500">{fmtDate(expense.date)}</p>
         <div className="mt-0.5 flex min-w-0 items-center gap-2">
           <p className="truncate text-sm font-semibold text-slate-950">{expense.description}</p>
           {expense.receiptUrl && <a href={`/api/receipts/${expense.id}`} target="_blank" rel="noreferrer" title="View receipt" aria-label="View receipt" className="shrink-0 text-slate-500"><Paperclip size={15}/></a>}
         </div>
       </div>
       <p className="shrink-0 text-sm font-bold text-slate-950">{fmt(expense.amount)}</p>
     </div>
     <div className="mt-1.5"><StatusPill status={expense.status}/></div>
     <div className="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs">
       <span className="font-medium uppercase tracking-wide text-slate-400">Team</span><span className="truncate text-slate-600">{expense.teamName}</span>
     </div>
     <div className="mt-2">{badges}</div>
     {extraDetails}
   </div>
 </div>;
}
