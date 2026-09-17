'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Receipt, History, Inbox, BarChart3, Wallet, Users, LogOut, Menu, X, CreditCard, ListChecks } from 'lucide-react';

export default function Sidebar({ name, email, isApprover, isAdmin, pendingCount }: { name: string; email: string; isApprover: boolean; isAdmin: boolean; pendingCount: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'; else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  const items = [
    { href: '/dashboard', label: 'Overview', icon: Wallet },
    
    { href: '/dashboard/expenses', label: 'Submit expense', icon: Receipt },
    { href: '/dashboard/expense-history', label: 'Expense History', icon: History },
    ...(isApprover ? [{ href: '/dashboard/approvals', label: 'Approvals', icon: Inbox, badge: pendingCount }, { href: '/dashboard/payments', label: 'Payments', icon: CreditCard }] : []),
    ...(isAdmin ? [{ href: '/dashboard/outstanding', label: 'Outstanding', icon: ListChecks }, { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 }, { href: '/dashboard/teams', label: 'Admin Portal', icon: Users }] : []),
  ];
  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col">
        <div className="border-b border-slate-100 px-6 py-6">
          <div className="flex items-center gap-3"><img src="/favicon.png" alt="Proclaim" className="h-10 w-10 rounded-xl object-cover" /><div><p className="font-semibold text-slate-950">Proclaim Expenses</p><p className="text-xs text-slate-500">Expense Management</p></div></div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {items.map((it) => { const Icon=it.icon; const active=pathname===it.href || (it.href !== '/dashboard' && pathname.startsWith(it.href + '/')); return <Link key={it.href} href={it.href} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${active?'bg-slate-950 text-white shadow-sm ring-1 ring-slate-900/5':'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><span className="flex items-center gap-3"><Icon size={18}/>{it.label}</span>{'badge' in it && !!it.badge && <span className="rounded-full bg-[#C99600] px-2 py-0.5 text-xs font-semibold text-white">{it.badge}</span>}</Link> })}
        </nav>
        <div className="border-t border-slate-100 p-4"><div className="rounded-xl bg-slate-50 p-3"><p className="truncate text-sm font-semibold text-slate-900">{name}</p><p className="truncate text-xs text-slate-500">{email}</p><button onClick={()=>signOut({callbackUrl:'/login'})} className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-950 active:scale-[.97]"><LogOut size={14}/> Sign out</button></div></div>
      </aside>

      {/* Mobile top bar with hamburger */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5"><img src="/favicon.png" alt="Proclaim" className="h-8 w-8 rounded-lg object-cover" /><p className="font-semibold text-slate-950">Proclaim Expenses</p></div>
        <button onClick={()=>setOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 active:scale-[.94]">
          <Menu size={22}/>
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`}>
        <div onClick={()=>setOpen(false)} className={`absolute inset-0 bg-slate-950/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}/>
        <aside className={`absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col bg-white shadow-xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
            <div className="flex items-center gap-3"><img src="/favicon.png" alt="Proclaim" className="h-9 w-9 rounded-xl object-cover" /><div><p className="font-semibold text-slate-950">Proclaim Expenses</p><p className="text-xs text-slate-500">Expense Management</p></div></div>
            <button onClick={()=>setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 active:scale-[.94]"><X size={20}/></button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {items.map((it) => { const Icon=it.icon; const active=pathname===it.href || (it.href !== '/dashboard' && pathname.startsWith(it.href + '/')); return <Link key={it.href} href={it.href} onClick={()=>setOpen(false)} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${active?'bg-slate-950 text-white shadow-sm ring-1 ring-slate-900/5':'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><span className="flex items-center gap-3"><Icon size={18}/>{it.label}</span>{'badge' in it && !!it.badge && <span className="rounded-full bg-[#C99600] px-2 py-0.5 text-xs font-semibold text-white">{it.badge}</span>}</Link> })}
          </nav>
          <div className="border-t border-slate-100 p-4"><div className="rounded-xl bg-slate-50 p-3"><p className="truncate text-sm font-semibold text-slate-900">{name}</p><p className="truncate text-xs text-slate-500">{email}</p><button onClick={()=>signOut({callbackUrl:'/login'})} className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-950 active:scale-[.97]"><LogOut size={14}/> Sign out</button></div></div>
        </aside>
      </div>
    </>
  );
}
