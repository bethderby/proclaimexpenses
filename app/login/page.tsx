'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  return <main className="min-h-dvh bg-[#0B231C] text-white lg:grid lg:grid-cols-2">
    <section className="relative hidden overflow-hidden lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:p-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(70,156,130,.35),transparent_38%),radial-gradient(circle_at_85%_75%,rgba(20,102,80,.4),transparent_42%)]"/>
      <div className="relative flex items-center gap-3"><img src="/favicon.png" alt="Proclaim" className="h-11 w-11 rounded-2xl object-cover" /><div><p className="font-semibold">Proclaim Expenses</p><p className="text-xs text-white/50">Expense Management</p></div></div>
      <div className="relative max-w-xl"><h1 className="text-5xl font-bold leading-tight tracking-tight xl:text-6xl">Proclaim Expenses</h1><p className="mt-6 max-w-lg text-xl leading-8 text-white/70">Expenses, made easy. Stewarding God&rsquo;s finances <span className="font-cursive text-3xl font-bold text-[#78C2A9]">together</span></p><div className="mt-8 space-y-3 text-sm text-white/80"><p className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[#78C2A9]"/> Submit an expense</p><p className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[#78C2A9]"/> Submit expenses in minutes</p><p className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[#78C2A9]"/> Receive approval updates by email</p></div></div>
      <p className="relative text-xs text-white/40">Proclaim Expenses</p>
    </section>
    <section className="flex min-h-dvh items-start justify-center bg-[#F7F8F6] p-6 pt-12 text-slate-950 sm:items-center sm:p-10"><div className="w-full max-w-md"><div className="mb-10 flex items-center gap-3 lg:hidden"><img src="/favicon.png" alt="Proclaim" className="h-10 w-10 rounded-xl object-cover" /><div><p className="font-semibold">Proclaim Expenses</p><p className="text-xs text-slate-500">Expenses, made easy. Stewarding God&rsquo;s finances <span className="font-cursive text-base font-bold text-[#146650]">together</span></p></div></div><div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-9"><p className="text-sm font-semibold text-[#146650]">Welcome</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Sign in to the Expenses Portal</h2><p className="mt-3 text-sm leading-6 text-slate-500">Submit expenses, track approvals and manage reimbursements in one place.</p><button onClick={() => { setLoading(true); signIn('google', { callbackUrl: '/' }); }} disabled={loading} className="mt-8 flex w-full items-center justify-between rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[.99] disabled:cursor-wait disabled:opacity-80"><span>{loading ? 'Redirecting…' : 'Continue with Google'}</span>{loading ? <Loader2 size={17} className="animate-spin"/> : <ArrowRight size={17}/>}</button></div></div></section>
  </main>;
}
