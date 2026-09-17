'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export default function SubmitExpenseButton({ busy, disabled: externallyDisabled }: { busy?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const [pressed, setPressed] = useState(false);
  const disabled = pending || busy || !!externallyDisabled;
  const receiptRequired = !!externallyDisabled && !pending && !busy;

  useEffect(() => {
    if (!pending && !busy && pressed) {
      const timer = window.setTimeout(() => setPressed(false), 500);
      return () => window.clearTimeout(timer);
    }
  }, [pending, busy, pressed]);

  const active = disabled || pressed;
  const showSpinner = pending || busy || (pressed && !receiptRequired);

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={showSpinner}
      onClick={() => setPressed(true)}
      className={`action-button w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 ${active ? 'action-button-pressed' : ''}`}
    >
      {showSpinner && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {pending ? 'Submitting…' : busy ? 'Uploading receipt…' : receiptRequired ? 'Add receipt to submit' : pressed ? 'Submitting…' : 'Submit expense'}
    </button>
  );
}
