'use client';
import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileDown, Mail } from 'lucide-react';
import { sendReportNow } from '@/app/actions';
import DateField from './DateField';
import FormButton from './FormButton';

export default function ExportControls({ teams, isAdmin }: { teams:{id:string;name:string}[]; isAdmin:boolean }) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d:Date) => d.toISOString().slice(0,10);
  const [teamId, setTeamId] = useState('');
  const [start, setStart] = useState(iso(first));
  const [end, setEnd] = useState(iso(today));
  const query = useMemo(() => {
    const params = new URLSearchParams({ start, end });
    if (teamId) params.set('team', teamId);
    return params.toString();
  }, [teamId, start, end]);
  const pdf = `/api/export/pdf?${query}`;
  const xlsx = `/api/export/xlsx?${query}`;

  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-1 mb-5">
        <p className="font-semibold text-slate-950">Export report</p>
        <p className="text-sm text-slate-500">Choose a team and date range, then select the format you want.</p>
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
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a href={pdf} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.99]"><FileDown size={16}/> Download PDF</a>
        <a href={xlsx} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-[.99]"><FileSpreadsheet size={16}/> Export to Excel</a>
      </div>
    </div>

    {isAdmin && <>
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
        <div className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3"><Mail size={20} className="mt-0.5 shrink-0"/><div><p className="font-semibold">Email this month's Expense Report</p><p className="mt-1 text-sm text-slate-300">Send the current month's expenses as a PDF Expense Report now. It will use the recipients saved below.</p><form action={sendReportNow} className="mt-4 flex w-full justify-start"><input type="hidden" name="start" value={iso(first)}/><input type="hidden" name="end" value={iso(today)}/><FormButton pendingLabel="Sending…" className="inline-flex min-h-[42px] w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 active:scale-[.97] sm:w-auto">Send now</FormButton></form></div></div>
      </div>
    </>}
  </div>
}
