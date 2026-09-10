'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, Trash2, Upload } from 'lucide-react';
import { submitExpense } from '@/app/actions';
import DateField from './DateField';

function LogExpenseButton({ receiptReady, busy }: { receiptReady: boolean; busy: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!receiptReady || busy || pending}
      className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.99] disabled:cursor-wait disabled:bg-emerald-700 disabled:opacity-100"
    >
      {pending ? 'Logging…' : busy ? 'Uploading…' : 'Log expense'}
    </button>
  );
}



export default function ExpenseForm({
  teams,
  approvedRequests,
}: {
  teams: { id: string; name: string }[];
  approvedRequests: { id: string; description: string; amount: number }[];
}) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<string>('');
  const [receiptName, setReceiptName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/receipts/upload', { method: 'POST', body: fd });
      const raw = await res.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error('The upload server returned an invalid response. Please try again.'); }
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setReceiptUrl(data.url);
      setReceiptPreviewUrl(data.previewUrl || data.url);
      setReceiptType(data.contentType || file.type);
      setReceiptName(file.name);
    } catch (err: any) {
      setError(err.message || 'Could not upload that file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submitExpense} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5 sm:p-6">
      {error && (
        <p className="text-sm text-rose-600 flex items-center gap-1.5">
          <AlertCircle size={14} /> {error}
        </p>
      )}
      <input type="hidden" name="receiptUrl" value={receiptUrl ?? ''} />
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Team</label>
        <select
          name="teamId"
          required
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
        <DateField name="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">What did you buy?</label>
        <input
          name="description"
          required
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">£</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="amount"
            required
            className="w-full rounded-md border border-stone-300 h-10 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            
          />
        </div>
      </div>
      {approvedRequests.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Linked request (optional)</label>
          <select
            name="requestId"
            defaultValue=""
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="">Not linked to a request</option>
            {approvedRequests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.description} (£{r.amount.toFixed(2)})
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Receipt</label>
        {!receiptUrl ? (
          <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-stone-300 py-6 text-sm text-stone-500 cursor-pointer hover:border-emerald-600 hover:text-emerald-700">
            <Upload size={16} /> {busy ? 'Uploading…' : 'Upload receipt (image or PDF)'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={busy} />
          </label>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-stone-200 p-3">
            {receiptType === 'application/pdf' ? (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded bg-slate-100 text-xs font-bold text-slate-600">PDF</div>
            ) : (
              <img src={receiptPreviewUrl || receiptUrl} alt="Receipt preview" className="h-16 w-16 object-cover rounded" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-700 truncate">{receiptName}</p>
              <button
                type="button"
                onClick={() => {
                  setReceiptUrl(null);
                  setReceiptPreviewUrl(null);
                  setReceiptType('');
                  setReceiptName('');
                }}
                className="text-xs text-rose-600 flex items-center gap-1 mt-1 transition active:scale-[.96]"
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
        )}
      </div>
      <LogExpenseButton receiptReady={!!receiptUrl} busy={busy} />
    </form>
  );
}
