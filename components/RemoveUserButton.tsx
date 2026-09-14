'use client';
import { UserMinus } from 'lucide-react';
import { removeUser } from '@/app/actions';
import FormButton from './FormButton';

export default function RemoveUserButton({ email, name }: { email: string; name: string }) {
  return (
    <form
      action={removeUser}
      onSubmit={(e) => {
        if (!confirm(`Remove ${name}? Their unapproved legacy records will be deleted, but expense history stays. They can sign in again later if they need to come back.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="email" value={email} />
      <FormButton
        pendingLabel="Removing…"
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 active:scale-[.97]"
      >
        <UserMinus size={15} /> Remove
      </FormButton>
    </form>
  );
}
