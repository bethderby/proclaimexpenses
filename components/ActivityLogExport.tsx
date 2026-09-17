'use client';
import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import DateField from './DateField';

export default function ActivityLogExport({ teams }: { teams:{id:string;name:string}[] }) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d:Date) => d.toISOString().slice(0,10);
  const [teamId, setTeamId] = useState('');
  const [start, setStart] = useState(iso(first));
  const [end, setEnd] = useState(iso(today));
  const href = useMemo(() => {
    const params = new URLSearchParams({ start, end });
    if (teamId) params.set('team', teamId);
    return `/api/export/activity-log?${params.toString()}`;
  }, [teamId, start, end]);

  return <div className="panel p-5 sm:p-6">
    <div className="flex flex-col gap-1 mb-5">
      <p className="font-semibold text-slate-950">Export activity log</p>
      <p className="text-sm text-slate-500">Every expense in the range, whatever happened to it &mdash; including rejected, cancelled and failed payments. For a financial statement of successful spend only, use Export report on the Reports page instead.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team
        <select value={teamId} onChange={e=>setTeamId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
          <option value="">All teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</p><div className="mt-1.5"><DateField value={start} onChange={setStart} reportFormat /></div></div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</p><div className="mt-1.5"><DateField value={end} onChange={setEnd} reportFormat /></div></div>
    </div>
    <div className="mt-5">
      <a href={href} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-[.99]"><FileSpreadsheet size={16}/> Export to Excel</a>
    </div>
  </div>;
}
