'use client';
import { useEffect, useState } from 'react';
import { Eye, Paperclip, Pencil, XCircle } from 'lucide-react';
import StatusPill from './StatusPill';
import EditExpenseForm from './EditExpenseForm';
import MarkPurchasedForm from './MarkPurchasedForm';
import { cancelExpense } from '@/app/actions';

const fmt=(n:number)=>`£${n.toFixed(2)}`;
const fmtDate=(value:string)=>new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'});
const modeLabel=(status:string,timing:string)=>status==='ALREADY_PURCHASED'?'Already purchased':timing==='ADVANCE'?'Advance requested':'Pay personally then reimburse';

type Expense={id:string;date:string;description:string;amount:number;teamId:string;teamName:string;receiptUrl:string|null;status:string;purchaseStatus:string;paymentTiming:string;receiptDueAt:string|null;paymentStatus:string;settlementStatus:string;settlementNote:string|null;submittedAt:string;approvedAmount:number|null;actualAmount:number|null;decidedAt:string|null;decisionNote:string|null;relatedExpenseId:string|null;};

export default function ExpenseHistoryTable({expenses,teams}:{expenses:Expense[];teams:{id:string;name:string}[]}){
 const [selected,setSelected]=useState<Expense|null>(null);
 const [editing,setEditing]=useState(false);
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
 return <>
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="hidden md:grid grid-cols-[130px_minmax(0,1fr)_130px_120px_100px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Date</span><span>Expense</span><span className="text-right">Amount</span><span>Status</span><span className="text-right">Details</span></div>
   {expenses.map(e=><button key={e.id} type="button" onClick={()=>{setSelected(e);setEditing(false)}} className="group grid w-full grid-cols-[92px_minmax(0,1fr)_88px_28px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 md:grid-cols-[130px_minmax(0,1fr)_130px_120px_100px] md:gap-4 md:px-5">
    <span className="text-xs text-slate-500 md:text-sm">{fmtDate(e.date)}</span>
    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-950">{e.description}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{modeLabel(e.purchaseStatus,e.paymentTiming)}</span></span>
    <span className="text-right text-sm font-bold text-slate-950">{fmt(e.amount)}</span>
    <span className="hidden md:block"><StatusPill status={e.status}/></span>
    <span className="flex justify-end text-slate-400 group-hover:text-[#C99600]"><Eye size={17}/></span>
    <span className="md:hidden col-span-full -mt-1 flex items-center justify-between"><StatusPill status={e.status}/>{e.receiptUrl&&<span className="inline-flex items-center gap-1 text-xs font-medium text-[#C99600]"><Paperclip size={13}/> Receipt</span>}</span>
   </button>)}
  </div>
  {selected&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-none bg-slate-950/40 p-2 sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <div className="max-h-[78vh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-white px-3 pb-3 pt-5 shadow-2xl sm:max-h-[82vh] sm:w-full sm:rounded-3xl sm:p-5">
    {editing?<><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Edit expense</h2><button onClick={()=>setEditing(false)} className="text-sm font-semibold text-slate-500">Cancel</button></div><EditExpenseForm expense={{id:selected.id,date:selected.date.slice(0,10),description:selected.description,amount:selected.amount,teamId:selected.teamId}} teams={teams} onDone={()=>{setEditing(false);window.location.reload()}}/></>:<>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#C99600]">Expense details</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{selected.description}</h2><p className="mt-1 text-sm text-slate-500">{fmtDate(selected.date)}</p></div><button onClick={close} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Close</button></div>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span className="text-sm font-medium text-slate-500">Amount</span><span className="text-xl font-bold text-slate-950">{fmt(selected.amount)}</span></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2"><Info label="Status"><StatusPill status={selected.status}/></Info><Info label="Team">{selected.teamName}</Info><Info label="Payment">{modeLabel(selected.purchaseStatus,selected.paymentTiming)}</Info><Info label="Submitted">{fmtDate(selected.submittedAt)}</Info>{selected.approvedAmount!=null&&<Info label="Approved amount">{fmt(selected.approvedAmount)}</Info>}{selected.actualAmount!=null&&<Info label="Receipt amount">{fmt(selected.actualAmount)}</Info>}</div>
      {selected.settlementNote&&<div className="mt-4 rounded-2xl border border-[#F3D36A] bg-[#FFF8E1] p-3 text-sm leading-6 text-[#7A5A00]">{selected.settlementNote}</div>}
      {selected.decisionNote&&<Info label="Approver note"><span className="text-slate-600">{selected.decisionNote}</span></Info>}
      <div className="mt-4 flex flex-wrap items-center gap-2">{selected.receiptUrl&&<a href={`/api/receipts/${selected.id}`} target="_blank" rel="noreferrer" className="secondary-button"><Paperclip size={15}/> View receipt</a>}{selected.status==='PENDING'&&!selected.relatedExpenseId&&<button onClick={()=>setEditing(true)} className="secondary-button"><Pencil size={15}/> Edit</button>}{selected.status==='PENDING'&&!selected.relatedExpenseId&&<form action={cancelExpense}><input type="hidden" name="expenseId" value={selected.id}/><button className="secondary-button text-rose-700"><XCircle size={15}/> Cancel</button></form>}{selected.status==='ADVANCE_PAID_AWAITING_RECEIPT'&&<MarkPurchasedForm expenseId={selected.id} onDone={close}/>}
      </div>
    </>}
   </div>
  </div>}
 </>;
}
function Info({label,children}:{label:string;children:React.ReactNode}){return <div className="rounded-xl border border-slate-100 bg-white p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><div className="mt-1 text-sm font-medium text-slate-900">{children}</div></div>}
