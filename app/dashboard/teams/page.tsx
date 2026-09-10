import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createTeam, deleteTeam, setAdminStatus, updateTeam } from '@/app/actions';
import { Trash2, Shield, Plus } from 'lucide-react';

export default async function AdminPortal(){
 const session=await getServerSession(authOptions); if(!session?.user)redirect('/login'); const user=session.user as any; if(!user.isAdmin)redirect('/dashboard/submit');
 const [teams,users]=await Promise.all([
  prisma.team.findMany({orderBy:{name:'asc'}}),
  prisma.user.findMany({orderBy:{email:'asc'}})
 ]);
 return <div className="space-y-7">
  <div><p className="text-sm font-semibold text-emerald-600">Administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Admin Portal</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Manage teams, budgets, people and permissions from one clean workspace.</p></div>
  <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
   <form action={createTeam} className="h-fit rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm"><div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Plus size={19}/></div><h2 className="text-lg font-semibold">Create a team</h2><p className="mt-1 text-sm text-slate-300">Set the team approver below. A person can approve multiple teams.</p><div className="mt-6 space-y-4">
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Team name<input name="name" required placeholder="e.g. Marketing" className="mt-1.5 w-full rounded-xl border-0 bg-white/10 px-3 py-3 text-sm text-white placeholder:text-slate-500 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"/></label>
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Approver email<input name="approverEmail" type="email" required placeholder="name@company.com" className="mt-1.5 w-full rounded-xl border-0 bg-white/10 px-3 py-3 text-sm text-white placeholder:text-slate-500 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"/></label>
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Budget target<input type="number" step="0.01" min="0" name="budgetTarget" placeholder="Optional" className="mt-1.5 w-full rounded-xl border-0 bg-white/10 px-3 py-3 text-sm text-white placeholder:text-slate-500 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"/></label>
    <button className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100">Create team</button>
   </div></form>
   <div className="space-y-4">{teams.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">No teams yet.</div>:teams.map(t=><div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><form action={updateTeam} className="flex min-w-0 flex-1 flex-wrap gap-2"><input type="hidden" name="teamId" value={t.id}/><input name="approverEmail" type="email" defaultValue={t.approverEmail||""} className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input name="name" defaultValue={t.name} className="min-w-[160px] flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-950"/><input type="number" step="0.01" min="0" name="budgetTarget" defaultValue={t.budgetTarget} className="w-40 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><button className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700">Save</button></form><form action={deleteTeam}><input type="hidden" name="teamId" value={t.id}/><button className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={15}/> Delete</button></form></div>
    <div className="mt-6 border-t border-slate-100 pt-5"><p className="text-sm font-semibold text-slate-950">Approval routing</p><p className="mt-1 text-xs text-slate-500">Anyone can submit to this team. Every request for this team is routed to the configured approver above. The same person can approve multiple teams.</p></div>
   </div>)}</div>
  </div>
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-950">Administrators</h2><p className="text-sm text-slate-500">Grant or remove full Admin Portal access.</p></div><Shield size={20} className="text-slate-400"/></div><div className="mt-5 divide-y divide-slate-100">{users.map(u=><div key={u.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{u.name||u.email}</p><p className="truncate text-xs text-slate-500">{u.email}</p></div><form action={setAdminStatus} className="flex items-center gap-2"><input type="hidden" name="email" value={u.email||''}/><select name="isAdmin" defaultValue={u.isAdmin?'true':'false'} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="false">Standard user</option><option value="true">Administrator</option></select><button className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Save</button></form></div>)}</div></section>
 </div>
}
