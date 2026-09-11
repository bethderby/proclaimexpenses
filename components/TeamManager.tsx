'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteTeam } from '@/app/actions';
import TeamModal from './TeamModal';
import FormButton from './FormButton';

type Team={id:string;name:string;budgetTarget:number;spent:number;pending:number;approvers:{id:string;name:string|null;email:string}[]};
const money=(n:number)=>`£${n.toFixed(2)}`;
export default function TeamManager({teams=[],newButton=false}:{teams?:Team[];newButton?:boolean}){
 const [open,setOpen]=useState(false); const [editing,setEditing]=useState<Team|undefined>();
 if(newButton) return <><button type="button" onClick={()=>{setEditing(undefined);setOpen(true)}} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#244c40] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d3e34]"><Plus size={18}/> New team</button><TeamModal open={open} onClose={()=>setOpen(false)} team={editing}/></>;
 return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{teams.map(t=>{
  const pct=t.budgetTarget?Math.min(100,t.spent/t.budgetTarget*100):0;
  return <div key={t.id} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
   <div className="flex items-start justify-between gap-3"><h2 className="font-serif text-2xl text-stone-900">{t.name}</h2><button type="button" onClick={()=>{setEditing(t);setOpen(true)}} aria-label={`Edit ${t.name}`} className="rounded-lg p-1.5 text-stone-700 hover:bg-stone-100"><Pencil size={18}/></button></div>
   <div className="mt-8 grid grid-cols-[1fr_auto] gap-x-5 gap-y-1"><div className="text-sm leading-6 text-stone-500">Spent this<br/>month</div><div className="text-right text-xl font-semibold text-stone-900">{money(t.spent)} <span className="font-normal text-stone-400">/</span><br/><span className="font-normal text-stone-500">{money(t.budgetTarget)}</span></div></div>
   <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#244c40]" style={{width:`${pct}%`}}/></div>
   <div className="mt-7"><p className="text-xs font-semibold uppercase tracking-[.18em] text-stone-500">Approvers</p><div className="mt-3 space-y-1.5">{t.approvers.length?<>{t.approvers.map(a=><p key={a.id} className="truncate text-sm text-stone-700">{a.name||a.email}</p>)}</>:<p className="text-sm text-stone-400">No approvers configured</p>}</div></div>
   {t.pending>0&&<p className="mt-6 text-sm font-medium text-amber-700">{t.pending} request{t.pending===1?'':'s'} awaiting approval</p>}
   <div className="mt-5 flex justify-end border-t border-stone-100 pt-4"><form action={deleteTeam}><input type="hidden" name="teamId" value={t.id}/><FormButton pendingLabel="Deleting…" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"><Trash2 size={15}/> Delete</FormButton></form></div>
  </div>;
 })}{teams.length===0&&<div className="rounded-2xl border border-dashed border-stone-300 bg-white py-14 text-center text-sm text-stone-500 md:col-span-2 xl:col-span-3">No teams yet.</div>}<TeamModal open={open} onClose={()=>setOpen(false)} team={editing}/></div>;
}
