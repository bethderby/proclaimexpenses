'use client';
import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import DateField from './DateField';

export default function ActivityLogExport() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [start, setStart] = useState(iso(first));
  const [end, setEnd] = useState(iso(today));
  const base = useMemo(() => {
    const params = new URLSearchParams({ start, end });
    return `/api/export/activity-log?${params.toString()}`;
  }, [start, end]);

  return <div className="panel overflow-hidden">
    <div className="panel-header">
      <div>
        <p className="panel-kicker">Export</p>
        <h2 className="panel-title">Activity log</h2>
      </div>
    </div>
    <div className="p-5 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</p><div className="mt-1.5"><DateField value={start} onChange={setStart} reportFormat /></div></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</p><div className="mt-1.5"><DateField value={end} onChange={setEnd} reportFormat /></div></div>
    </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={`${base}&format=xlsx`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-[.99]"><FileSpreadsheet size={16}/> Export log as XLSX</a>
        <a href={`${base}&format=pdf`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-[.99]"><FileText size={16}/> Export log as PDF</a>
      </div>
    </div>
  </div>;
}
