'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export default function SubmitExpenseButton({ busy, disabled: externallyDisabled }: { busy?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const [pressed, setPressed] = useState(false);
  const disabled = pending || busy || !!externallyDisabled;

  useEffect(() => {
    if (!pending && !busy && pressed) {
      const timer = window.setTimeout(() => setPressed(false), 500);
      return () => window.clearTimeout(timer);
    }
  }, [pending, busy, pressed]);

  const active = disabled || pressed;

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={disabled}
      onClick={() => setPressed(true)}
      className={`action-button w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-[#C99600] disabled:opacity-100 ${active ? 'action-button-pressed' : ''}`}
    >
      {disabled && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {pending ? 'Submitting…' : busy ? 'Uploading receipt…' : externallyDisabled ? 'Receipt required' : pressed ? 'Submitting…' : 'Submit expense'}
    </button>
  );
}
