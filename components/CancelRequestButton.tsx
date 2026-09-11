'use client';
import { Ban } from 'lucide-react';
import { cancelRequest } from '@/app/actions';
import FormButton from './FormButton';

export default function CancelRequestButton({ requestId }: { requestId: string }) {
  return (
    <form
      action={cancelRequest}
      onSubmit={(e) => {
        if (!confirm('Cancel this request? This can\u2019t be undone.')) e.preventDefault();
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <FormButton
        pendingLabel="Cancelling…"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 active:scale-[.96]"
      >
        <Ban size={13} /> Cancel
      </FormButton>
    </form>
  );
}
