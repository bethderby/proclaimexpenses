'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cancelPaymentRun, createWisePaymentRun, syncWisePaymentRun } from '@/app/actions';

function friendlyError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function PrepareWiseButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (disabled || busy) return;
    setBusy(true);
    setError('');
    try {
      await createWisePaymentRun();
      router.refresh();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={submit}
        disabled={disabled || busy}
        aria-busy={busy}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Preparing Wise payment run…' : 'Prepare Wise payment run'}
      </button>
      {error && (
        <p role="alert" className="max-w-md text-right text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function PaymentRunActions({
  runId,
  status,
}: {
  runId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'sync' | 'cancel' | null>(null);
  const [error, setError] = useState('');

  const canAct = status !== 'COMPLETED' && status !== 'CANCELLED';

  async function runAction(kind: 'sync' | 'cancel') {
    if (!canAct || busy) return;

    if (kind === 'cancel' && !window.confirm(
      'Cancel this payment run? Any unfunded Wise transfers that can be cancelled will be cancelled, and the expenses will be returned to Ready to pay.'
    )) {
      return;
    }

    setBusy(kind);
    setError('');

    try {
      const formData = new FormData();
      formData.set('runId', runId);

      if (kind === 'sync') {
        await syncWisePaymentRun(formData);
      } else {
        await cancelPaymentRun(formData);
      }

      router.refresh();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(null);
    }
  }

  if (!canAct && !error) return null;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {canAct && (
          <>
            <button
              type="button"
              onClick={() => runAction('sync')}
              disabled={busy !== null}
              aria-busy={busy === 'sync'}
              className="rounded-xl bg-[#C99600] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#A97900] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'sync' ? 'Syncing…' : 'Sync Wise status'}
            </button>
            <button
              type="button"
              onClick={() => runAction('cancel')}
              disabled={busy !== null}
              aria-busy={busy === 'cancel'}
              className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel run'}
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-md text-xs font-medium text-rose-700 sm:text-right">
          {error}
        </p>
      )}
    </div>
  );
}
