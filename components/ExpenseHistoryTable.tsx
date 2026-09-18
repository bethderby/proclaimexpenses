'use client';
import { useEffect, useState, useTransition } from 'react';
import { Eye, ReceiptText, Pencil, XCircle } from 'lucide-react';
import StatusPill from './StatusPill';
import EditExpenseForm from './EditExpenseForm';
import MarkPurchasedForm from './MarkPurchasedForm';
import { cancelExpense } from '@/app/actions/expenses';

const fmt=(n:number)=>`£${n.toFixed(2)}`;
const fmtDate=(value:string)=>new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'});
const modeLabel=(status:string,timing:string)=>status==='ALREADY_PURCHASED'?'Already purchased':timing==='ADVANCE'?'Advance requested':'Pay personally then reimburse';

type Expense={id:string;date:string;description:string;amount:number;teamId:string;teamName:string;receiptUrl:string|null;status:string;purchaseStatus:string;paymentTiming:string;receiptDueAt:string|null;paymentStatus:string;settlementStatus:string;settlementNote:string|null;submittedAt:string;approvedAmount:number|null;actualAmount:number|null;decidedAt:string|null;decisionNote:string|null;relatedExpenseId:string|null;};

const ROW_GRID='md:grid-cols-[112px_minmax(0,1fr)_minmax(96px,max-content)_minmax(190px,max-content)_minmax(64px,max-content)]';

export default function ExpenseHistoryTable({expenses,teams,openExpense}:{expenses:Expense[];teams:{id:string;name:string}[];openExpense?:Expense|null}){
 const [selected,setSelected]=useState<Expense|null>(openExpense??null);
 const [editing,setEditing]=useState(false);
 const [cancelling,setCancelling]=useState(false);
 const [cancelError,setCancelError]=useState<string|null>(null);
 const [feedback,setFeedback]=useState<string|null>(null);
 const [isPending,startTransition]=useTransition();
 const close=()=>{setSelected(null);setEditing(false)};
 useEffect(()=>{
  if(!selected) return;
  const previousOverflow=document.body.style.overflow;
  const previousTouchAction=document.body.style.touchAction;
  document.body.style.overflow='hidden';
  document.body.style.touchAction='none';
  return ()=>{
   document.body.style.overflow=previousOverflow;
   document.body.style.touchAction=previousTouchAction;
  };
 },[selected]);
 const showFeedback=(message:string)=>{setFeedback(message);window.setTimeout(()=>setFeedback(null),5000)};
 return <>
  {feedback&&<div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100">✓</span>{feedback}</div>}
  <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid md:items-stretch md:gap-y-0 ${ROW_GRID}`}>
   <div className="hidden md:contents">
    {['Date','Expense','Amount','Status','Details'].map((label,i)=><span key={label} className={`border-b border-slate-100 bg-slate-50 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${i===0?'pl-5 pr-2':i===4?'pl-2 pr-5 text-right':i===2?'px-2 text-right':'px-2'}`}>{label}</span>)}
   </div>
   {expenses.map((e,i)=>{const isLast=i===expenses.length-1;return <button key={e.id} type="button" onClick={()=>{setSelected(e);setEditing(false)}} className={`group grid w-full grid-cols-[78px_minmax(0,1fr)_70px_24px] items-start gap-2 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50 md:contents`}>
    <span className={`border-slate-100 text-xs text-slate-500 md:border-b md:text-sm md:pl-5 md:pr-2 md:py-3 md:group-hover:bg-slate-50 ${isLast?'md:border-b-0':''}`}><span className="flex h-5 items-center md:block md:h-auto">{fmtDate(e.date)}</span></span>
    <span className={`min-w-0 border-slate-100 md:border-b md:px-2 md:py-3 md:group-hover:bg-slate-50 ${isLast?'md:border-b-0':''}`}>
      <span className="block truncate text-sm font-semibold leading-5 text-slate-950">{e.description}</span>
      <span className="mt-0.5 hidden truncate text-xs text-slate-500 md:block">{modeLabel(e.purchaseStatus,e.paymentTiming)}</span>
      <span className="mt-1 flex items-center gap-2 md:hidden"><StatusPill status={e.status}/></span>
    </span>
    <span className={`grid grid-cols-[1fr] items-center gap-1.5 border-slate-100 text-right text-sm font-bold leading-5 text-slate-950 md:grid-cols-[1fr_16px] md:border-b md:px-2 md:py-3 md:text-base md:group-hover:bg-slate-50 ${isLast?'md:border-b-0':''}`}>
      <span className="flex flex-col items-end gap-0.5 md:contents">
        <span className="text-right">{fmt(e.amount)}</span>
        {e.receiptUrl&&<span className="inline-flex items-center gap-1 text-[10px] font-medium leading-4 text-[#C99600] md:hidden"><ReceiptText size={11}/> Receipt</span>}
      </span>
      <span className="hidden md:flex md:justify-center">{e.receiptUrl&&<ReceiptText size={13} className="text-[#C99600]" aria-label="Receipt attached"/>}</span>
    </span>
    <span className={`hidden items-center whitespace-nowrap border-slate-100 md:flex md:border-b md:px-2 md:py-3 md:group-hover:bg-slate-50 ${isLast?'md:border-b-0':''}`}><StatusPill status={e.status}/></span>
    <span className="flex justify-end pt-0.5 text-slate-400 group-hover:text-[#C99600] md:hidden"><Eye size={17}/></span>
    <span className={`hidden items-center justify-end border-slate-100 text-slate-400 group-hover:text-[#C99600] md:flex md:border-b md:pl-2 md:pr-5 md:py-3 md:group-hover:bg-slate-50 ${isLast?'md:border-b-0':''}`}><Eye size={17}/></span>
   </button>;})}
  </div>
  {selected&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-none bg-slate-950/40 p-2 sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <div className="max-h-[78vh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-white px-3 pb-3 pt-5 shadow-2xl sm:max-h-[82vh] sm:w-full sm:rounded-3xl sm:p-5">
    {editing?<><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Edit expense</h2><button onClick={()=>setEditing(false)} className="text-sm font-semibold text-slate-500">Cancel</button></div><EditExpenseForm expense={{id:selected.id,date:selected.date.slice(0,10),description:selected.description,amount:selected.amount,teamId:selected.teamId}} teams={teams} onDone={(message)=>{setEditing(false);showFeedback(message||'Expense updated successfully.')}}/></>:<>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#C99600]">Expense details</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{selected.description}</h2><p className="mt-1 text-sm text-slate-500">{fmtDate(selected.date)}</p></div><button onClick={close} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Close</button></div>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span className="text-sm font-medium text-slate-500">Amount</span><span className="text-xl font-bold text-slate-950">{fmt(selected.amount)}</span></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2"><Info label="Status"><StatusPill status={selected.status}/></Info><Info label="Team">{selected.teamName}</Info><Info label="Payment">{modeLabel(selected.purchaseStatus,selected.paymentTiming)}</Info><Info label="Submitted">{fmtDate(selected.submittedAt)}</Info>{selected.approvedAmount!=null&&<Info label="Approved amount">{fmt(selected.approvedAmount)}</Info>}{selected.actualAmount!=null&&<Info label="Receipt amount">{fmt(selected.actualAmount)}</Info>}</div>
      {selected.settlementNote&&<div className="mt-4 rounded-2xl border border-[#F3D36A] bg-[#FFF8E1] p-3 text-sm leading-6 text-[#7A5A00]">{selected.settlementNote}</div>}
      {selected.decisionNote&&<Info label="Approver note"><span className="text-slate-600">{selected.decisionNote}</span></Info>}
      <div className="mt-4 flex flex-wrap items-center gap-2">{selected.receiptUrl&&<a href={`/api/receipts/${selected.id}`} target="_blank" rel="noreferrer" className="secondary-button"><ReceiptText size={15}/> View receipt</a>}{selected.status==='PENDING'&&!selected.relatedExpenseId&&<button onClick={()=>setEditing(true)} className="secondary-button"><Pencil size={15}/> Edit</button>}{selected.status==='PENDING'&&!selected.relatedExpenseId&&<form onSubmit={e=>{e.preventDefault();if(!window.confirm('Cancel this expense? It will no longer be sent for approval.'))return;setCancelError(null);setCancelling(true);const formData=new FormData(e.currentTarget);startTransition(async()=>{try{await cancelExpense(formData);close();showFeedback('Expense cancelled successfully.')}catch(error){setCancelError(error instanceof Error?error.message:'Unable to cancel this expense. Please try again.')}finally{setCancelling(false)}})}}><input type="hidden" name="expenseId" value={selected.id}/><button type="submit" disabled={cancelling||isPending} className="secondary-button text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"><XCircle size={15}/>{cancelling?'Cancelling...':'Cancel'}</button></form>}{selected.status==='ADVANCE_PAID_AWAITING_RECEIPT'&&<MarkPurchasedForm expenseId={selected.id} onDone={()=>{close();showFeedback('Purchase details and receipt saved successfully.')}}/>}
      </div>
      {cancelError&&<div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{cancelError}</div>}
    </>}
   </div>
  </div>}
 </>;
}
function Info({label,children}:{label:string;children:React.ReactNode}){return <div className="rounded-xl border border-slate-100 bg-white p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><div className="mt-1 text-sm font-medium text-slate-900">{children}</div></div>}
