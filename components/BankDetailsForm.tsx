'use client';
import { useState, useTransition } from 'react';
import { updateBankDetails } from '@/app/actions';

export default function BankDetailsForm({ initial }: { initial: { accountName:string; sortCode:string; accountNumber:string } }) {
 const [pending,startTransition]=useTransition(); const [error,setError]=useState(''); const [saved,setSaved]=useState(false);
 return <form action={fd=>startTransition(async()=>{setError('');setSaved(false);try{await updateBankDetails(fd);setSaved(true)}catch(e:any){setError(e?.message||'Could not save bank details.')}})} className="space-y-4">
   <div><label className="block text-sm font-medium text-slate-700">Account name</label><input name="bankAccountName" required defaultValue={initial.accountName} placeholder="Proclaim Jesus / Your name" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
   <div className="grid gap-4 sm:grid-cols-2"><div><label className="block text-sm font-medium text-slate-700">Sort code</label><input name="bankSortCode" inputMode="numeric" maxLength={8} required defaultValue={initial.sortCode} placeholder="12-34-56" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div><div><label className="block text-sm font-medium text-slate-700">Account number</label><input name="bankAccountNumber" inputMode="numeric" maxLength={8} required defaultValue={initial.accountNumber} placeholder="12345678" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div></div>
   <p className="text-xs text-slate-500">These details are used only when the charity prepares your reimbursement payment. They are never used as your login details.</p>
   {error && <p className="text-sm text-rose-600">{error}</p>}{saved && <p className="text-sm font-medium text-emerald-700">Payment details saved.</p>}
   <button disabled={pending} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending?'Saving…':'Save payment details'}</button>
 </form>;
}
