'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { PlusCircle, FileText, Receipt, Inbox, PiggyBank, Download, Wallet, Users, LogOut } from 'lucide-react';

export default function Sidebar({ name, email, isApprover, isAdmin, pendingCount }: { name: string; email: string; isApprover: boolean; isAdmin: boolean; pendingCount: number }) {
  const pathname = usePathname();
  const items = [
    { href: '/dashboard', label: 'Overview', icon: Wallet },
    { href: '/dashboard/submit', label: 'New request', icon: PlusCircle },
    { href: '/dashboard/my-requests', label: 'My requests', icon: FileText },
    ...(isApprover ? [{ href: '/dashboard/approvals', label: 'Approvals', icon: Inbox, badge: pendingCount }] : []),
    { href: '/dashboard/expenses', label: 'Expenses', icon: Receipt },
    { href: '/dashboard/budgets', label: 'Budgets & reports', icon: PiggyBank },
    ...(isAdmin ? [{ href: '/dashboard/teams', label: 'Admin Portal', icon: Users }] : []),
    { href: '/dashboard/export', label: 'Export', icon: Download },
  ];
  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col">
        <div className="border-b border-slate-100 px-6 py-6">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white"><Wallet size={20}/></div><div><p className="font-semibold text-slate-950">Proclaim</p><p className="text-xs text-slate-500">Expenses & budgeting</p></div></div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {items.map((it) => { const Icon=it.icon; const active=pathname===it.href || pathname.startsWith(it.href + '/'); return <Link key={it.href} href={it.href} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${active?'bg-slate-950 text-white shadow-sm':'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><span className="flex items-center gap-3"><Icon size={18}/>{it.label}</span>{'badge' in it && !!it.badge && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs text-white">{it.badge}</span>}</Link> })}
        </nav>
        <div className="border-t border-slate-100 p-4"><div className="rounded-xl bg-slate-50 p-3"><p className="truncate text-sm font-semibold text-slate-900">{name}</p><p className="truncate text-xs text-slate-500">{email}</p><button onClick={()=>signOut({callbackUrl:'/login'})} className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-950"><LogOut size={14}/> Sign out</button></div></div>
      </aside>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
          {items.map((it)=>{const Icon=it.icon; const active=pathname===it.href || (it.href !== '/dashboard' && pathname.startsWith(it.href+'/')); return <Link key={it.href} href={it.href} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition ${active?'bg-slate-950 text-white':'text-slate-500 hover:bg-slate-100'}`}><Icon size={18}/><span className="max-w-full truncate">{it.label}</span>{'badge' in it && !!it.badge && <span className="absolute right-5 top-1 h-2 w-2 rounded-full bg-emerald-500"/>}</Link>})}
        </div>
      </nav>
    </>
  );
}
