'use client';
import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileDown, Mail } from 'lucide-react';
import { sendReportNow } from '@/app/actions';
import DateField from './DateField';
import FormButton from './FormButton';
export default function ExportControls({ teams, isAdmin }: { teams:{id:string;name:string}[]; isAdmin:boolean }) {
 const today=new Date(); const first=new Date(today.getFullYear(),today.getMonth(),1); const iso=(d:Date)=>d.toISOString().slice(0,10);
 const [teamId,setTeamId]=useState(''); const [start,setStart]=useState(iso(first)); const [end,setEnd]=useState(iso(today));
 const pdf=useMemo(()=>`/api/export/pdf?${teamId?`team=${teamId}&`:''}start=${start}&end=${end}`,[teamId,start,end]);
 return <div className="space-y-5">
  <div className={`grid gap-4 ${isAdmin ? 'sm:grid-cols-2' : ''}`}>
   <a href="/api/export/xlsx" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[.99]"><FileSpreadsheet className="mb-8" size={22}/><p className="font-semibold text-slate-950">Full spreadsheet</p><p className="mt-1 text-sm text-slate-500">Every request and expense across all teams.</p><span className="mt-4 inline-block text-sm font-semibold">Download Excel →</span></a>
   {isAdmin && <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm"><Mail className="mb-8" size={22}/><p className="font-semibold">Email report</p><p className="mt-1 text-sm text-slate-300">Send one combined PDF containing every team.</p><form action={sendReportNow} className="mt-4 flex gap-2"><input type="hidden" name="start" value={start}/><input type="hidden" name="end" value={end}/><FormButton pendingLabel="Sending…" className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 active:scale-[.97]">Send now</FormButton></form></div>}
  </div>
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-1 mb-5"><p className="font-semibold text-slate-950">PDF report</p><p className="text-sm text-slate-500">Choose any date range. Leave team set to All teams for one consolidated report.</p></div><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team<select value={teamId} onChange={e=>setTeamId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</p><div className="mt-1.5"><DateField value={start} onChange={setStart} /></div></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</p><div className="mt-1.5"><DateField value={end} onChange={setEnd} /></div></div></div><a href={pdf} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.99]"><FileDown size={16}/> Download PDF</a><p className="mt-4 text-xs text-slate-400">The scheduled report runs on the 1st and emails the same all-team report. Resend must have a verified sender.</p></div>
 </div>
}
