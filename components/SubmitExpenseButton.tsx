'use client';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

export default function SubmitExpenseButton({ busy, disabled: externallyDisabled }: { busy?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || busy || !!externallyDisabled;
  const receiptRequired = !!externallyDisabled && !pending && !busy;
  const submitting = pending || busy;

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={submitting}
      className={`action-button w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
        receiptRequired
          ? 'cursor-not-allowed bg-slate-200 text-slate-500 opacity-100'
          : submitting
            ? 'cursor-not-allowed bg-slate-950 text-white opacity-100'
            : 'bg-slate-950 text-white hover:bg-slate-800'
      }`}
    >
      {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {pending ? 'Submitting…' : busy ? 'Uploading receipt…' : receiptRequired ? 'Add receipt to submit' : 'Submit expense'}
    </button>
  );
}
