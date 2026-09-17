'use client';
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Trash2, Upload, X } from 'lucide-react';
import { submitExpense } from '@/app/actions/expenses';
import { errorMessage } from '@/lib/money';
import DateField from './DateField';
import SubmitExpenseButton from './SubmitExpenseButton';

type ReceiptUploadResponse = { url?: string; previewUrl?: string; contentType?: string; error?: string };

export default function ExpenseForm({ teams, hasBankDetails }: { teams: { id: string; name: string }[]; hasBankDetails: boolean }) {
  const [purchaseStatus, setPurchaseStatus] = useState<'ALREADY_PURCHASED'|'NOT_PURCHASED'>('ALREADY_PURCHASED');
  const [receiptUrl, setReceiptUrl] = useState<string|null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string|null>(null);
  const [receiptType, setReceiptType] = useState('');
  const [receiptName, setReceiptName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showBankPrompt, setShowBankPrompt] = useState(false);
  const MAX_FILE_SIZE = 4 * 1024 * 1024;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setError('');
    if (file.size > MAX_FILE_SIZE) {
      setError('This file is too large. Please choose a receipt smaller than 4MB.');
      e.target.value = '';
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/receipts/upload', { method: 'POST', body: fd });
      const raw = await res.text();
      let data: ReceiptUploadResponse = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error(res.status === 413 ? 'This file is too large. Please choose a receipt smaller than 4MB.' : 'We could not upload this receipt. Please try again.');
      }
      if (!res.ok) throw new Error(data.error || (res.status === 413 ? 'This file is too large. Please choose a receipt smaller than 4MB.' : 'We could not upload this receipt. Please try again.'));
      setReceiptUrl(data.url ?? null); setReceiptPreviewUrl(data.previewUrl || data.url || null); setReceiptType(data.contentType || file.type); setReceiptName(file.name);
    } catch (err) { setError(errorMessage(err, 'We could not upload this receipt. Please try again.')); } finally { setBusy(false); }
  }

  const alreadyBought = purchaseStatus === 'ALREADY_PURCHASED';
  const paymentTiming: 'AFTER_PURCHASE' | 'ADVANCE' = alreadyBought ? 'AFTER_PURCHASE' : 'ADVANCE';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (alreadyBought && !receiptUrl) {
      e.preventDefault();
      setError('Please upload the receipt before submitting an already-purchased expense.');
      return;
    }
    if (!hasBankDetails) {
      e.preventDefault();
      setShowBankPrompt(true);
    }
  }

  return <>
    <form action={submitExpense} onSubmit={handleSubmit} className="panel space-y-5 p-5 sm:p-6">
      {error && <p className="flex items-center gap-1.5 text-sm text-rose-600"><AlertCircle size={14}/>{error}</p>}
      <input type="hidden" name="receiptUrl" value={receiptUrl ?? ''}/>
      <input type="hidden" name="purchaseStatus" value={purchaseStatus}/>
      <input type="hidden" name="paymentTiming" value={paymentTiming}/>

      <div><label className="field-label">Team</label><select name="teamId" required className="field-control">{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div><label className="field-label">What&apos;s this expense for?</label><input name="description" required className="field-control" placeholder="e.g. Train tickets for conference"/></div>
      <div><label className="field-label">Amount</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">£</span><input type="number" step="0.01" min="0.01" name="amount" required className="field-control h-10 pl-7"/></div></div>

      <div>
        <p className="mb-2 block text-sm font-medium text-stone-700">Have you already bought this?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={()=>setPurchaseStatus('ALREADY_PURCHASED')} className={`rounded-xl border p-3 text-left ${alreadyBought?'border-[#C99600] bg-[#FFF8E1] ring-1 ring-[#C99600]':'border-slate-200 hover:bg-slate-50'}`}><p className="text-sm font-semibold text-slate-900">Yes, I&apos;ve already bought it</p><p className="mt-0.5 text-xs text-slate-500">Receipt required now.</p></button>
          <button type="button" onClick={()=>setPurchaseStatus('NOT_PURCHASED')} className={`rounded-xl border p-3 text-left ${!alreadyBought?'border-[#C99600] bg-[#FFF8E1] ring-1 ring-[#C99600]':'border-slate-200 hover:bg-slate-50'}`}><p className="text-sm font-semibold text-slate-900">No, I haven&apos;t bought it</p><p className="mt-0.5 text-xs text-slate-500">Request a cash advance - we&apos;ll pay you first.</p></button>
        </div>
      </div>

      <div><label className="field-label">{alreadyBought?'Purchase date':'Expected purchase date'}</label><DateField name="date" defaultValue={new Date().toISOString().slice(0,10)} required/></div>

      <div><label className="field-label">Receipt {alreadyBought?<span className="text-rose-600">(required)</span>:<span className="text-slate-400">(optional for now)</span>}</label>{!receiptUrl?<label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-stone-300 py-6 text-sm text-stone-500 hover:border-[#C99600] hover:text-[#C99600]"><Upload size={16}/>{busy?'Uploading…':'Upload receipt (image or PDF)'}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={busy}/></label>:<div className="flex items-center gap-3 rounded-md border border-stone-200 p-3">{receiptType==='application/pdf'?<div className="grid h-16 w-16 shrink-0 place-items-center rounded bg-slate-100 text-xs font-bold text-slate-600">PDF</div>:<img src={receiptPreviewUrl||receiptUrl} alt="Receipt preview" className="h-16 w-16 rounded object-cover"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm text-stone-700">{receiptName}</p><button type="button" onClick={()=>{setReceiptUrl(null);setReceiptPreviewUrl(null);setReceiptType('');setReceiptName('')}} className="mt-1 flex items-center gap-1 text-xs text-rose-600"><Trash2 size={12}/> Remove</button></div></div>}{!alreadyBought&&<p className="mt-2 text-xs text-slate-500">You&apos;ll be reminded to upload proof after purchase.</p>}</div>

      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{alreadyBought?'The receipt is required as proof of payment.':'After purchase, upload the receipt and actual amount you paid; the app will calculate any balance to return or extra reimbursement.'}</div>
      <SubmitExpenseButton busy={busy} disabled={alreadyBought && !receiptUrl} />
    </form>

    {showBankPrompt && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="bank-details-required-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlertCircle size={21}/></div><div><h2 id="bank-details-required-title" className="text-xl font-semibold text-slate-950">Add your bank details first</h2><p className="mt-1 text-sm leading-6 text-slate-500">We need your payment details before you can submit an expense. Otherwise an approved expense cannot be paid to you.</p></div></div>
          <button type="button" onClick={()=>setShowBankPrompt(false)} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18}/></button>
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><p className="font-semibold text-slate-900">What to do</p><p className="mt-1">Scroll to <strong>Your payment details</strong>, enter your sort code, account number and account name, then save them. You can then submit this expense.</p></div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={()=>setShowBankPrompt(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Not now</button>
          <button type="button" onClick={()=>{setShowBankPrompt(false);document.getElementById('payment-details')?.scrollIntoView({behavior:'smooth',block:'start'});}} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><CheckCircle2 size={16}/> Add bank details</button>
        </div>
      </div>
    </div>}
  </>;
}
