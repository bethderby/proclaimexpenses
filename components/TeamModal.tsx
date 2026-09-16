'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { createTeam, updateTeam } from '@/app/actions';
import FormButton from './FormButton';

type Team = { id:string; name:string; budgetTarget:number; approvers:{id:string;name:string|null;email:string}[] };

export default function TeamModal({ open, onClose, team }:{open:boolean;onClose:()=>void;team?:Team}) {
  const [approvers, setApprovers] = useState<string[]>(team?.approvers.map(a=>a.email) || ['']);
  useEffect(() => { setApprovers(team?.approvers.map(a=>a.email) || ['']); }, [team?.id, open]);
  if (!open) return null;
  const action = team ? updateTeam : createTeam;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#C99600]">{team?'Edit team':'New team'}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{team?'Edit team':'Create a team'}</h2></div><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
      <form action={action} className="mt-6 space-y-5">
        {team && <input type="hidden" name="teamId" value={team.id}/>} 
        <label className="block text-sm font-medium text-slate-700">Team name<input name="name" required defaultValue={team?.name || ''} placeholder="e.g. Media" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FDCF37]"/></label>
        <label className="block text-sm font-medium text-slate-700">Monthly budget<input name="budgetTarget" type="number" min="0" step="0.01" defaultValue={team?.budgetTarget ?? 0} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FDCF37]"/></label>
        <div><div className="flex items-center justify-between"><label className="text-sm font-medium text-slate-700">{team ? "Change approver(s)" : "Approvers"}</label><button type="button" onClick={()=>setApprovers([...approvers,''])} className="inline-flex items-center gap-1 text-sm font-semibold text-[#C99600]"><Plus size={15}/> Add approver</button></div>{team ? <><p className="mt-2 text-xs font-semibold text-slate-500">Current approver email{team.approvers.length===1?'':'s'}</p><div className="mt-1 flex flex-wrap gap-2">{team.approvers.length ? team.approvers.map(a=><span key={a.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">{a.email}</span>) : <span className="text-xs text-slate-400">No approvers currently set</span>}</div><p className="mt-3 text-xs text-slate-500">Edit the email address{team.approvers.length===1?'':'es'} below to replace the current approver{team.approvers.length===1?'':'s'}.</p></> : <p className="mt-1 text-xs text-slate-500">Any listed approver can approve an expense for this team.</p>}<div className="mt-3 space-y-2">{approvers.map((email,i)=><div key={i} className="flex gap-2"><input name="approverEmail" type="email" required value={email} onChange={e=>setApprovers(approvers.map((v,j)=>j===i?e.target.value:v))} placeholder="name@company.com" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#FDCF37]"/>{approvers.length>1&&<button type="button" onClick={()=>setApprovers(approvers.filter((_,j)=>j!==i))} aria-label="Remove approver" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16}/></button>}</div>)}</div></div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-5"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><FormButton pendingLabel={team?'Saving…':'Creating…'} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">{team?'Save changes':'Create team'}</FormButton></div>
      </form>
    </div>
  </div>
}
