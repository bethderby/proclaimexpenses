import FormButton from './FormButton';
import { saveReportSchedule } from '@/app/actions';

export default function ReportSchedule({ enabled, dayOfMonth, recipients }: { enabled: boolean; dayOfMonth: number; recipients: string[] }) {
  const recipientText = recipients.join('\n');
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-slate-950">Automatic report schedule</p>
        <p className="text-sm text-slate-500">Choose which day the monthly Expense Report is sent and who receives it.</p>
      </div>
      <form action={saveReportSchedule} className="mt-5 space-y-5">
        <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
          <input type="checkbox" name="enabled" value="true" defaultChecked={enabled} className="h-4 w-4 rounded border-slate-300 accent-[#C99600]" />
          Send the report automatically each month
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Day of month
            <select name="dayOfMonth" defaultValue={dayOfMonth} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </label>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time (UK)
            <div className="mt-1.5 flex min-h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-700">06:00 daily check</div>
            <p className="mt-1.5 text-xs font-normal normal-case tracking-normal text-slate-400">Automatic reports are checked once daily by Vercel. The selected day controls when the report is sent.</p>
          </div>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Specific recipients (optional)
          <textarea name="recipients" defaultValue={recipientText} rows={4} placeholder="finance@example.com\ntrustee@example.com" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#C99600]" />
          <span className="mt-1.5 block text-xs font-normal normal-case tracking-normal text-slate-400">Enter one email per line, or separate emails with commas.</span>
          <span className="mt-2 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case tracking-normal text-slate-600"><strong className="font-semibold text-slate-800">Admin recipients:</strong> If no specific email addresses are entered, the report will be sent to all active admins.</span>
        </label>
        <div className="flex justify-start">
          <FormButton pendingLabel="Saving…" className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.97]">Save schedule</FormButton>
        </div>
      </form>
    </div>
  );
}
