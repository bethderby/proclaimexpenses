'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteTeam } from '@/app/actions';
import TeamModal from './TeamModal';
import FormButton from './FormButton';

type Team={id:string;name:string;budgetTarget:number;spent:number;pending:number;approvers:{id:string;name:string|null;email:string}[]};
const money=(n:number)=>`£${n.toFixed(2)}`;

export default function TeamManager({teams=[],newButton=false}:{teams?:Team[];newButton?:boolean}){
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState<Team|undefined>();

 if(newButton) return <>
   <button type="button" onClick={()=>{setEditing(undefined);setOpen(true)}} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
     <Plus size={18}/> New team
   </button>
   <TeamModal open={open} onClose={()=>setOpen(false)} team={editing}/>
 </>;

 return <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
   <div className="overflow-x-auto">
     <table className="min-w-[920px] w-full border-collapse text-left">
       <thead className="border-b border-stone-200 bg-stone-50/70">
         <tr>
           <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[.16em] text-stone-500">Team</th>
           <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[.16em] text-stone-500">Monthly budget</th>
           <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[.16em] text-stone-500">Spent this month</th>
           <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[.16em] text-stone-500">Approvers</th>
           <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[.16em] text-stone-500">Pending</th>
           <th className="w-28 px-5 py-4 text-right text-xs font-semibold uppercase tracking-[.16em] text-stone-500">Actions</th>
         </tr>
       </thead>
       <tbody className="divide-y divide-stone-100">
         {teams.map(t=>{
           const pct=t.budgetTarget?Math.min(100,t.spent/t.budgetTarget*100):0;
           return <tr key={t.id} className="transition hover:bg-stone-50/50">
             <td className="px-5 py-5 align-top">
               <p className="text-base font-semibold text-stone-900">{t.name}</p>
             </td>
             <td className="px-5 py-5 align-top">
               <p className="text-sm font-semibold text-stone-900">{money(t.budgetTarget)}</p>
               <div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-stone-100">
                 <div className="h-full rounded-full bg-emerald-700" style={{width:`${pct}%`}} />
               </div>
             </td>
             <td className="px-5 py-5 align-top">
               <p className="text-sm text-stone-700">{money(t.spent)}</p>
               <p className="mt-1 text-xs text-stone-400">{pct.toFixed(0)}% of budget</p>
             </td>
             <td className="max-w-xs px-5 py-5 align-top">
               {t.approvers.length ? <div className="space-y-1">
                 {t.approvers.map(a=><p key={a.id} className="truncate text-sm text-stone-700" title={a.email}>{a.name||a.email}</p>)}
               </div> : <p className="text-sm text-stone-400">No approvers configured</p>}
             </td>
             <td className="px-5 py-5 align-top">
               {t.pending>0 ? <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{t.pending} pending</span> : <span className="text-sm text-stone-400">None</span>}
             </td>
             <td className="px-5 py-5 align-top">
               <div className="flex justify-end gap-1">
                 <button type="button" onClick={()=>{setEditing(t);setOpen(true)}} aria-label={`Edit ${t.name}`} title="Edit team" className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 hover:text-stone-900">
                   <Pencil size={17}/>
                 </button>
                 <form action={deleteTeam}>
                   <input type="hidden" name="teamId" value={t.id}/>
                   <FormButton pendingLabel="Deleting…" className="rounded-lg p-2 text-stone-500 hover:bg-rose-50 hover:text-rose-600">
                     <Trash2 size={17}/>
                   </FormButton>
                 </form>
               </div>
             </td>
           </tr>;
         })}
       </tbody>
     </table>
   </div>
   {teams.length===0 && <div className="px-6 py-14 text-center text-sm text-stone-500">No teams yet.</div>}
   <TeamModal open={open} onClose={()=>setOpen(false)} team={editing}/>
 </div>;
}
