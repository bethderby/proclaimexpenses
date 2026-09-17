import FormButton from './FormButton';
import { saveReportSchedule } from '@/app/actions';

export default function ReportSchedule({ enabled, dayOfMonth, recipients }: { enabled: boolean; dayOfMonth: number; recipients: string[] }) {
  const recipientText = recipients.join('\n');
  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-slate-950">Automatic report schedule</p>
        <p className="text-sm text-slate-500">Choose whether the monthly Expense Report is sent automatically, which day it is sent, and who receives it.</p>
      </div>
      <form action={saveReportSchedule} className="mt-5 space-y-5">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800">
          <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
            <input type="checkbox" name="enabled" value="true" defaultChecked={enabled} className="peer sr-only" />
            <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-[#C99600] peer-focus-visible:ring-2 peer-focus-visible:ring-[#C99600] peer-focus-visible:ring-offset-2" />
            <span className="relative ml-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
          </span>
          <span>Send the report automatically each month</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Day of month
            <select name="dayOfMonth" defaultValue={dayOfMonth} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </label>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automatic check
            <div className="mt-1.5 flex min-h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-700">Once daily</div>
            <p className="mt-1.5 text-xs font-normal normal-case tracking-normal text-slate-400">The automatic check runs once daily because of the Vercel schedule limit. The selected day controls when the report is sent.</p>
          </div>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Additional recipients (optional)
          <textarea name="recipients" defaultValue={recipientText} rows={4} placeholder="finance@example.com, trustee@example.com" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#C99600]" />
          <span className="mt-1.5 block text-xs font-normal normal-case tracking-normal text-slate-400">Enter one email per line, or separate emails with commas.</span>
          <span className="mt-2 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case tracking-normal text-slate-600"><strong className="font-semibold text-slate-800">Admin recipients:</strong> All active admins with an email address on file will receive the report as well as any additional recipients entered above.</span>
        </label>
        <div className="flex justify-start">
          <FormButton pendingLabel="Saving…" className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.97]">Save schedule</FormButton>
        </div>
      </form>
    </div>
  );
}
