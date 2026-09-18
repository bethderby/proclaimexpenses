'use client';
import { useState, useTransition } from 'react';
import { updateExpense } from '@/app/actions/expenses';
import { errorMessage } from '@/lib/money';
import DateField from './DateField';

export default function EditExpenseForm({ expense, teams, onDone }: { expense:{id:string;date:string;description:string;amount:number;teamId:string}; teams:{id:string;name:string}[]; onDone:(message?:string)=>void }) {
 const [pending,startTransition]=useTransition();
 const [error,setError]=useState('');
 return <form action={fd=>startTransition(async()=>{
   setError('');
   try { await updateExpense(fd); onDone('Expense updated successfully.'); }
   catch(e) { setError(errorMessage(e,'Could not update expense. Please check the details and try again.')); }
 })} className="grid gap-3 sm:grid-cols-2">
  <input type="hidden" name="expenseId" value={expense.id}/>
  <label className="text-xs font-semibold text-slate-600">Description<input name="description" required defaultValue={expense.description} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></label>
  <label className="text-xs font-semibold text-slate-600">Amount<input name="amount" required type="number" step="0.01" min="0.01" defaultValue={expense.amount} onWheel={(e) => e.currentTarget.blur()} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/></label>
  <div><p className="text-xs font-semibold text-slate-600">Date</p><div className="mt-1"><DateField name="date" required defaultValue={expense.date}/></div></div>
  <label className="text-xs font-semibold text-slate-600">Team<select name="teamId" defaultValue={expense.teamId} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
  {error&&<p role="alert" className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">{error}</p>}<div className="flex gap-2 sm:col-span-2"><button disabled={pending} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white">{pending?'Saving…':'Save changes'}</button><button type="button" onClick={onDone} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Cancel</button></div>
 </form>;
}
