'use client';
import { useFormStatus } from 'react-dom';

export default function SubmitExpenseButton({ busy }: { busy?: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || busy;
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.99] disabled:cursor-wait disabled:bg-emerald-700 disabled:opacity-100"
    >
      {pending ? 'Submitting…' : busy ? 'Uploading receipt…' : 'Submit expense'}
    </button>
  );
}
