'use client';
import { useState } from 'react';
import { FileText, Paperclip, Pencil } from 'lucide-react';
import EditExpenseForm from './EditExpenseForm';

const fmt = (n: number) => `£${n.toFixed(2)}`;
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ExpenseRow({
  expense,
  teams,
  variant,
}: {
  expense: { id: string; date: string; description: string; amount: number; teamId: string; teamName: string; receiptUrl: string };
  teams: { id: string; name: string }[];
  variant: 'desktop' | 'mobile';
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    // Full width regardless of variant — this is what was breaking on
    // desktop before: the edit form was crammed into a 90px table cell.
    return (
      <div className="border-b border-slate-100 bg-slate-50/60 p-4 last:border-0">
        <EditExpenseForm
          expense={{ id: expense.id, date: expense.date, description: expense.description, amount: expense.amount, teamId: expense.teamId }}
          teams={teams}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  if (variant === 'desktop') {
    return (
      <div className="grid grid-cols-[100px_1fr_140px_100px_90px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-0 hover:bg-slate-50">
        <span className="text-slate-500">{fmtDate(expense.date)}</span>
        <span className="truncate font-medium text-slate-950">{expense.description}</span>
        <span className="truncate text-slate-500">{expense.teamName}</span>
        <span className="text-right font-semibold text-slate-950">{fmt(expense.amount)}</span>
        <span className="flex items-center justify-end gap-1">
          <a href={`/api/receipts/${expense.id}`} target="_blank" rel="noreferrer" title="View receipt" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 active:scale-[.94]"><Paperclip size={15} /></a>
          <button onClick={() => setEditing(true)} title="Edit" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 active:scale-[.94]"><Pencil size={15} /></button>
        </span>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 p-4 last:border-0">
      <div className="flex items-start gap-3">
        <a href={`/api/receipts/${expense.id}`} target="_blank" rel="noreferrer" className="shrink-0">
          {expense.receiptUrl.toLowerCase().endsWith('.pdf')
            ? <div className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600"><FileText size={16} /></div>
            : <img src={`/api/receipts/${expense.id}`} alt="Receipt" className="h-11 w-11 rounded-lg border border-slate-200 object-cover bg-slate-50" />}
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-950">{expense.description}</p><p className="shrink-0 text-sm font-bold text-slate-950">{fmt(expense.amount)}</p></div>
          <p className="mt-0.5 truncate text-xs text-slate-500">{expense.teamName} · {fmtDate(expense.date)}</p>
        </div>
      </div>
      <button onClick={() => setEditing(true)} className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.97]">Edit</button>
    </div>
  );
}
