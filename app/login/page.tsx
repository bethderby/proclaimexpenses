'use client';

import { signIn } from 'next-auth/react';
import { LogIn, Wallet } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-stone-50 rounded-lg border border-stone-200 p-8">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="text-emerald-700" size={22} />
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900">Proclaim Expenses</h1>
        </div>
        <p className="text-sm text-stone-500 mb-6">Team expenses, submitted and approved in one place.</p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          <LogIn size={16} /> Sign in with Google
        </button>
      </div>
    </div>
  );
}
