'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cancelPaymentRun, syncWisePaymentRun } from '@/app/actions/payments';

function friendlyError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function PrepareWiseButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit() {
    if (disabled || busy) return;
    setBusy(true);
    setError('');
    try {
      const { createWisePaymentRun } = await import('@/app/actions/payments');
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
        {busy ? 'Creating payment run…' : 'Create payment run manually'}
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
  const [success, setSuccess] = useState('');

  const canAct = status !== 'COMPLETED' && status !== 'CANCELLED';

  async function runAction(kind: 'sync' | 'cancel') {
    if (!canAct || busy) return;

    if (kind === 'cancel' && !window.confirm(
      'Cancel this payment run? Any unfunded Wise transfers that can be cancelled will be cancelled, and the expenses will be returned to Pending and will need approval again.'
    )) {
      return;
    }

    setBusy(kind);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.set('runId', runId);

      if (kind === 'sync') {
        await syncWisePaymentRun(formData);
        setSuccess('Wise status synced successfully.');
      } else {
        await cancelPaymentRun(formData);
        setSuccess('Cancellation requested successfully. Wise may take a moment to finish cancelling the batch. The affected expenses will return to Pending once cancellation is confirmed.');
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
            {status !== 'WISE_CANCELLING' && (
              <button
                type="button"
                onClick={() => runAction('cancel')}
                disabled={busy !== null}
                aria-busy={busy === 'cancel'}
                className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel run'}
              </button>
            )}
          </>
        )}
      </div>
      {status === 'WISE_CANCELLING' && !error && (
        <p className="max-w-md text-xs font-medium text-slate-500 sm:text-right">
          Cancellation requested. Waiting for Wise to confirm the final transfer states.
        </p>
      )}
      {success && (
        <p role="status" className="max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700 sm:text-right">
          {success}
        </p>
      )}
      {error && (
        <p role="alert" className="max-w-md text-xs font-medium text-rose-700 sm:text-right">
          {error}
        </p>
      )}
    </div>
  );
}
