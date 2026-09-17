'use client';
import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import DateField from './DateField';

export default function ActivityLogExport() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d:Date) => d.toISOString().slice(0,10);
  const [start, setStart] = useState(iso(first));
  const [end, setEnd] = useState(iso(today));

  const href = useMemo(() => {
    const params = new URLSearchParams({ start, end });
    return `/api/export/activity-log?${params.toString()}`;
  }, [start, end]);

  return <div className="panel p-5 sm:p-6">
    <div className="flex flex-col gap-1 mb-5">
      <p className="font-semibold text-slate-950">Export activity log</p>
      <p className="text-sm text-slate-500">Export the full activity log for the selected date range. All teams are included.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</p><div className="mt-1.5"><DateField value={start} onChange={setStart} reportFormat /></div></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</p><div className="mt-1.5"><DateField value={end} onChange={setEnd} reportFormat /></div></div>
    </div>
    <div className="mt-5">
      <a href={href} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-[.99]"><FileText size={16}/> Export log as TXT</a>
    </div>
  </div>;
}
