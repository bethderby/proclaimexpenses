'use client';
import { useState, useTransition } from 'react';
import { updateExpense } from '@/app/actions';
import DateField from './DateField';

export default function EditExpenseForm({ expense, teams }: { expense: { id:string; date:string; description:string; amount:number; teamId:string }; teams:{id:string;name:string}[] }) {
  const [open,setOpen]=useState(false); const [pending,startTransition]=useTransition(); const [error,setError]=useState('');
  if (!open) return <button type="button" onClick={()=>setOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.97]">Edit</button>;
  return <form action={(fd)=>startTransition(async()=>{setError(''); try { await updateExpense(fd); setOpen(false); } catch(e:any){setError(e?.message||'Could not update expense.');}})} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
    <input type="hidden" name="expenseId" value={expense.id}/>
    <label className="text-xs font-semibold text-slate-600">Description<input name="description" required defaultValue={expense.description} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></label>
    <label className="text-xs font-semibold text-slate-600">Amount<input name="amount" required type="number" step="0.01" min="0" defaultValue={expense.amount} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></label>
    <div><p className="text-xs font-semibold text-slate-600">Date</p><div className="mt-1"><DateField name="date" required defaultValue={expense.date} /></div></div>
    <label className="text-xs font-semibold text-slate-600">Team<select name="teamId" defaultValue={expense.teamId} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    {error && <p className="text-xs text-rose-600 sm:col-span-2">{error}</p>}
    <div className="flex gap-2 sm:col-span-2"><button disabled={pending} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition active:scale-[.97] disabled:cursor-wait disabled:bg-emerald-700">{pending?'Saving…':'Save changes'}</button><button type="button" onClick={()=>setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[.97]">Cancel</button></div>
  </form>;
}
