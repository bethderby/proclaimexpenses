'use client';

import { useState, useTransition } from 'react';
import { resetExpenseToPending } from '@/app/actions';

export default function ResetExpenseApprovalButton({ expenseId }: { expenseId: string }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');

  function reset() {
    if (busy) return;
    if (!window.confirm('Return this expense to Pending so it must be approved again?')) return;
    setError('');
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('expenseId', expenseId);
        await resetExpenseToPending(formData);
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not return the expense for approval.');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={reset} disabled={busy} className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? 'Returning…' : 'Return for approval'}
      </button>
      {error && <p role="alert" className="max-w-xs text-right text-[11px] font-medium text-rose-700">{error}</p>}
    </div>
  );
}
