import { CheckCircle2, Clock, XCircle } from 'lucide-react';

const META: Record<string, { label: string; icon: any; cls: string }> = {
  PENDING: { label: 'Pending', icon: Clock, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Approved', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejected', icon: XCircle, cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function StatusPill({ status }: { status: string }) {
  const meta = META[status] || META.PENDING;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
      <Icon size={13} /> {meta.label}
    </span>
  );
}
