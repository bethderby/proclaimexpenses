'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

const statuses = [
  ['ALL', 'All statuses'],
  ['DRAFT', 'Draft'],
  ['WISE_OPEN', 'Open batch'],
  ['WISE_RECOVERY_REQUIRED', 'Recovery required'],
  ['WISE_PREPARED', 'Prepared'],
  ['WISE_FUNDED', 'Funded'],
  ['COMPLETED', 'Completed'],
  ['CANCELLED', 'Cancelled'],
] as const;

export default function PaymentRunFilter({ status }: { status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function updateStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'ALL') params.delete('status');
    else params.set('status', value);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="block max-w-xs text-xs font-semibold uppercase tracking-wide text-slate-500">
        Payment run status
        <select
          value={status || 'ALL'}
          onChange={e => updateStatus(e.target.value)}
          disabled={pending}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#C99600]"
        >
          {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}
