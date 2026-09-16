'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateBankDetails } from '@/app/actions';

export default function BankDetailsForm({ initial }: { initial: { accountName:string; sortCode:string; accountNumber:string } }) {
 const [pending,startTransition]=useTransition(); const [error,setError]=useState(''); const [saved,setSaved]=useState(false); const router=useRouter();
 return <form action={fd=>startTransition(async()=>{setError('');setSaved(false);try{await updateBankDetails(fd);setSaved(true);router.refresh()}catch(e:any){setError(e?.message||'Could not save bank details.')}})} className="space-y-4">
   <div><label className="block text-sm font-medium text-slate-700">Account name</label><input name="bankAccountName" required defaultValue={initial.accountName} placeholder="Name on your bank account" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
   <div className="grid gap-4 sm:grid-cols-2"><div><label className="block text-sm font-medium text-slate-700">Sort code</label><input name="bankSortCode" inputMode="numeric" maxLength={8} required defaultValue={initial.sortCode} placeholder="12-34-56 or 123456" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div><div><label className="block text-sm font-medium text-slate-700">Account number</label><input name="bankAccountNumber" inputMode="numeric" maxLength={8} required defaultValue={initial.accountNumber} placeholder="12345678" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div></div>
   <p className="text-xs text-slate-500">Enter your UK sort code as 6 digits. You can type it with or without dashes, for example 12-34-56 or 123456.</p>
   {error && <p className="text-sm text-rose-600">{error}</p>}{saved && <p className="text-sm font-medium text-[#C99600]">Payment details saved.</p>}
   <button disabled={pending} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending?'Saving…':'Save payment details'}</button>
 </form>;
}
