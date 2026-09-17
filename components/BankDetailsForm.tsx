'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateBankDetails } from '@/app/actions';

export default function BankDetailsForm({ initial }: { initial: { accountName:string; sortCode:string; accountNumber:string } }) {
 const hasDetails=!!(initial.accountName&&initial.sortCode&&initial.accountNumber);
 const [editing,setEditing]=useState(!hasDetails);
 const [pending,startTransition]=useTransition(); const [error,setError]=useState(''); const [saved,setSaved]=useState(false); const router=useRouter();
 if (!editing) return <div className="space-y-4">
   <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
     <div className="grid gap-3 sm:grid-cols-3">
       <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account name</p><p className="mt-1 text-sm font-semibold text-slate-900">{initial.accountName}</p></div>
       <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sort code</p><p className="mt-1 text-sm font-semibold text-slate-900">{initial.sortCode}</p></div>
       <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account number</p><p className="mt-1 text-sm font-semibold text-slate-900">••••{initial.accountNumber.slice(-4)}</p></div>
     </div>
   </div>
   {saved && <p className="text-sm font-medium text-[#C99600]">Payment details saved.</p>}
   <button type="button" onClick={()=>setEditing(true)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">Edit payment details</button>
 </div>;
 return <form action={fd=>startTransition(async()=>{setError('');setSaved(false);try{await updateBankDetails(fd);setSaved(true);setEditing(false);router.refresh()}catch(e:any){setError(e?.message||'Could not save bank details.')}})} className="space-y-4">
   <div><label className="field-label">Account name</label><input name="bankAccountName" required defaultValue={initial.accountName} placeholder="Name on your bank account" className="field-control mt-1" /></div>
   <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label">Sort code</label><input name="bankSortCode" inputMode="numeric" maxLength={8} required defaultValue={initial.sortCode} placeholder="12-34-56 or 123456" className="field-control mt-1" /></div><div><label className="field-label">Account number</label><input name="bankAccountNumber" inputMode="numeric" maxLength={8} required defaultValue={initial.accountNumber} placeholder="12345678" className="field-control mt-1" /></div></div>
   <p className="text-xs text-slate-500">Enter your UK sort code as 6 digits. You can type it with or without dashes, for example 12-34-56 or 123456.</p>
   {error && <p className="text-sm text-rose-600">{error}</p>}
   <div className="flex gap-2"><button type="submit" disabled={pending} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending?'Saving…':'Save payment details'}</button>{hasDetails&&<button type="button" onClick={()=>setEditing(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>}</div>
 </form>;
}
