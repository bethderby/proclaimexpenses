import { Ban, CheckCircle2, Clock, CreditCard, CircleAlert, ReceiptText, ShoppingCart, XCircle } from 'lucide-react';

const META: Record<string, { label: string; icon: any; cls: string }> = {
  PENDING: { label: 'Pending approval', icon: Clock, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Approved', icon: CheckCircle2, cls: 'bg-[#EAF6F1] text-[#146650] border-[#A7D9C6]' },
  REJECTED: { label: 'Rejected', icon: XCircle, cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Cancelled', icon: Ban, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  AWAITING_PURCHASE: { label: 'Awaiting purchase', icon: ShoppingCart, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  READY_TO_PAY: { label: 'Ready to pay', icon: CreditCard, cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  PAYMENT_PENDING: { label: 'Payment pending', icon: CreditCard, cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ADVANCE_PAID_AWAITING_RECEIPT: { label: 'Advance paid · receipt needed', icon: ReceiptText, cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  PAID: { label: 'Paid', icon: CheckCircle2, cls: 'bg-[#EAF6F1] text-[#146650] border-[#A7D9C6]' },
  PAYMENT_FAILED: { label: 'Payment failed', icon: CircleAlert, cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function StatusPill({ status }: { status: string }) {
  const meta = META[status] || META.PENDING; const Icon = meta.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}><Icon size={13} /> {meta.label}</span>;
}
