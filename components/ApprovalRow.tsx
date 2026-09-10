'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { decideRequest } from '@/app/actions';

const fmt = (n: number) => `£${n.toFixed(2)}`;

export default function ApprovalRow({
  id,
  description,
  amount,
  date,
  userName,
  teamName,
}: {
  id: string;
  description: string;
  amount: number;
  date: string;
  userName: string;
  teamName: string;
}) {
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<'APPROVED' | 'REJECTED' | null>(null);

  function decide(status: 'APPROVED' | 'REJECTED') {
    setPendingAction(status);
    startTransition(async () => {
      await decideRequest(id, status, note);
    });
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-stone-800">{description}</p>
        <span className="font-semibold text-stone-900">{fmt(amount)}</span>
      </div>
      <p className="text-xs text-stone-500 mt-0.5">
        {userName} · {teamName} · {date}
      </p>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        
        className="mt-3 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
      />
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() => decide('APPROVED')}
          className="flex items-center gap-1.5 rounded-md bg-emerald-700 text-white px-3 py-1.5 text-sm font-medium transition hover:bg-emerald-800 active:scale-[.97] disabled:cursor-wait disabled:opacity-70"
        >
          <CheckCircle2 size={14} /> {pending && pendingAction === 'APPROVED' ? 'Approving…' : 'Approve'}
        </button>
        <button
          disabled={pending}
          onClick={() => decide('REJECTED')}
          className="flex items-center gap-1.5 rounded-md border border-rose-300 text-rose-700 px-3 py-1.5 text-sm font-medium transition hover:bg-rose-50 active:scale-[.97] disabled:cursor-wait disabled:opacity-70"
        >
          <XCircle size={14} /> {pending && pendingAction === 'REJECTED' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </div>
  );
}
