'use client';
import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import DateField from './DateField';

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function isoFirstOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function DateRangeFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [pending, startTransition] = useTransition();

  const isThisMonth = from === isoFirstOfMonth() && to === isoToday();

  function go(f: string, t: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', f);
    params.set('to', t);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="min-w-[150px]">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">From</p>
        <DateField value={draftFrom} onChange={setDraftFrom} />
      </div>
      <div className="min-w-[150px]">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">To</p>
        <DateField value={draftTo} onChange={setDraftTo} />
      </div>
      <button
        onClick={() => go(draftFrom, draftTo)}
        disabled={pending}
        className="flex h-10 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.97] disabled:cursor-wait disabled:opacity-70"
      >
        <Search size={15} /> {pending ? 'Looking up…' : 'Look up'}
      </button>
      {!isThisMonth && (
        <button
          onClick={() => { setDraftFrom(isoFirstOfMonth()); setDraftTo(isoToday()); go(isoFirstOfMonth(), isoToday()); }}
          disabled={pending}
          className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[.97]"
        >
          Back to this month
        </button>
      )}
    </div>
  );
}
