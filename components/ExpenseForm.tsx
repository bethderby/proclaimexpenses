'use client';
import { useState } from 'react';
import { AlertCircle, Trash2, Upload } from 'lucide-react';
import { submitExpense } from '@/app/actions';
import DateField from './DateField';
import SubmitExpenseButton from './SubmitExpenseButton';

export default function ExpenseForm({ teams }: { teams: { id: string; name: string }[] }) {
  const [purchaseStatus, setPurchaseStatus] = useState<'ALREADY_PURCHASED'|'NOT_PURCHASED'>('ALREADY_PURCHASED');
  const [receiptUrl, setReceiptUrl] = useState<string|null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string|null>(null);
  const [receiptType, setReceiptType] = useState('');
  const [receiptName, setReceiptName] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setError(''); setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/receipts/upload', { method: 'POST', body: fd });
      const raw = await res.text(); let data:any={}; try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error('The upload server returned an invalid response.'); }
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setReceiptUrl(data.url); setReceiptPreviewUrl(data.previewUrl || data.url); setReceiptType(data.contentType || file.type); setReceiptName(file.name);
    } catch (err:any) { setError(err.message || 'Could not upload that file.'); } finally { setBusy(false); }
  }

  const alreadyBought = purchaseStatus === 'ALREADY_PURCHASED';
  // Not purchased always means a cash advance now - the "get pre-approved,
  // then pay yourself and reimburse later with no advance" option has been
  // removed as redundant: someone who can front the money can just wait
  // until they've bought it and select "Yes, already bought."
  const paymentTiming: 'AFTER_PURCHASE' | 'ADVANCE' = alreadyBought ? 'AFTER_PURCHASE' : 'ADVANCE';

  return <form action={submitExpense} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    {error && <p className="flex items-center gap-1.5 text-sm text-rose-600"><AlertCircle size={14}/>{error}</p>}
    <input type="hidden" name="receiptUrl" value={receiptUrl ?? ''}/>
    <input type="hidden" name="purchaseStatus" value={purchaseStatus}/>
    <input type="hidden" name="paymentTiming" value={paymentTiming}/>

    <div><label className="block text-sm font-medium text-stone-700 mb-1">Team</label><select name="teamId" required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
    <div><label className="block text-sm font-medium text-stone-700 mb-1">What's this expense for?</label><input name="description" required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="e.g. Train tickets for conference"/></div>
    <div><label className="block text-sm font-medium text-stone-700 mb-1">Amount</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">£</span><input type="number" step="0.01" min="0.01" name="amount" required className="h-10 w-full rounded-xl border border-stone-300 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"/></div></div>

    <div>
      <p className="mb-2 block text-sm font-medium text-stone-700">Have you already bought this?</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={()=>setPurchaseStatus('ALREADY_PURCHASED')} className={`rounded-xl border p-3 text-left ${alreadyBought?'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600':'border-slate-200 hover:bg-slate-50'}`}><p className="text-sm font-semibold text-slate-900">Yes, I've already bought it</p><p className="mt-0.5 text-xs text-slate-500">Receipt required now.</p></button>
        <button type="button" onClick={()=>setPurchaseStatus('NOT_PURCHASED')} className={`rounded-xl border p-3 text-left ${!alreadyBought?'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600':'border-slate-200 hover:bg-slate-50'}`}><p className="text-sm font-semibold text-slate-900">No, I haven't bought it</p><p className="mt-0.5 text-xs text-slate-500">Request a cash advance - we'll pay you first.</p></button>
      </div>
    </div>

    <div><label className="mb-1.5 block text-sm font-medium text-slate-700">{alreadyBought?'Purchase date':'Expected purchase date'}</label><DateField name="date" defaultValue={new Date().toISOString().slice(0,10)} required/></div>

    <div><label className="mb-1 block text-sm font-medium text-stone-700">Receipt {alreadyBought?<span className="text-rose-600">(required)</span>:<span className="text-slate-400">(optional for now)</span>}</label>{!receiptUrl?<label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-stone-300 py-6 text-sm text-stone-500 hover:border-emerald-600 hover:text-emerald-700"><Upload size={16}/>{busy?'Uploading…':'Upload receipt (image or PDF)'}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={busy}/></label>:<div className="flex items-center gap-3 rounded-md border border-stone-200 p-3">{receiptType==='application/pdf'?<div className="grid h-16 w-16 shrink-0 place-items-center rounded bg-slate-100 text-xs font-bold text-slate-600">PDF</div>:<img src={receiptPreviewUrl||receiptUrl} alt="Receipt preview" className="h-16 w-16 rounded object-cover"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm text-stone-700">{receiptName}</p><button type="button" onClick={()=>{setReceiptUrl(null);setReceiptPreviewUrl(null);setReceiptType('');setReceiptName('')}} className="mt-1 flex items-center gap-1 text-xs text-rose-600"><Trash2 size={12}/> Remove</button></div></div>}{!alreadyBought&&<p className="mt-2 text-xs text-slate-500">You'll be reminded to upload proof after purchase.</p>}</div>

    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{alreadyBought?'The receipt is required because you have already spent the money.':'If approved, the charity will pay you an advance through Wise. After purchase, upload the receipt and actual amount; the app will calculate any balance to return or extra reimbursement.'}</div>
    <SubmitExpenseButton busy={busy}/>
  </form>;
}
