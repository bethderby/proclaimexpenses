'use client';
import { useFormStatus } from 'react-dom';

export default function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.99] disabled:cursor-wait disabled:bg-[#146650] disabled:opacity-100">{pending ? 'Submitting…' : children}</button>;
}
