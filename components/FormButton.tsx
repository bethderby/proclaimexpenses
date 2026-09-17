'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!pending && pressed) {
      const timer = window.setTimeout(() => setPressed(false), 500);
      return () => window.clearTimeout(timer);
    }
  }, [pending, pressed]);

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={() => setPressed(true)}
      className={`${className || ''} action-button disabled:cursor-wait disabled:opacity-70 ${pressed ? 'action-button-pressed' : ''}`}
    >
      {pending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel || 'Working…' : pressed ? 'Working…' : children}
    </button>
  );
}
