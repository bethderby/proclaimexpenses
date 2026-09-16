'use client';
import { useFormStatus } from 'react-dom';

export default function FormButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className || ''} disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? pendingLabel || 'Working…' : children}
    </button>
  );
}
