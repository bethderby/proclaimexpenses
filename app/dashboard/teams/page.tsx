import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import TeamManager from '@/components/TeamManager';
import { Shield } from 'lucide-react';
import FormButton from '@/components/FormButton';
import RemoveUserButton from '@/components/RemoveUserButton';
import { setAdminStatus } from '@/app/actions';

export default async function TeamsPage(){
 const session=await getServerSession(authOptions); if(!session?.user)redirect('/login'); const user=session.user as any; if(!user.isAdmin)redirect('/dashboard/submit');
 const now=new Date(); const monthStart=new Date(now.getFullYear(),now.getMonth(),1); const nextMonth=new Date(now.getFullYear(),now.getMonth()+1,1);
 const [teams,users,expenses,pending]=await Promise.all([
  prisma.team.findMany({orderBy:{name:'asc'},include:{members:{where:{role:'APPROVER'},include:{user:{select:{id:true,name:true,email:true}}}}}}),
  prisma.user.findMany({where:{removedAt:null},orderBy:{email:'asc'}}),
  prisma.expense.findMany({where:{date:{gte:monthStart,lt:nextMonth}},select:{teamId:true,amount:true}}),
  prisma.fundingRequest.findMany({where:{status:'PENDING'},select:{teamId:true}})
 ]);
 const spend=new Map<string,number>(); expenses.forEach(e=>spend.set(e.teamId,(spend.get(e.teamId)||0)+e.amount));
 const pendingCount=new Map<string,number>(); pending.forEach(r=>pendingCount.set(r.teamId,(pendingCount.get(r.teamId)||0)+1));
 const teamData=teams.map(t=>{ const approvers=t.members.map(m=>({id:m.user.id,name:m.user.name,email:m.user.email||''})).filter(a=>a.email); if(!approvers.length && t.approverEmail) approvers.push({id:`legacy-${t.id}`,name:null,email:t.approverEmail}); return {id:t.id,name:t.name,budgetTarget:t.budgetTarget,spent:spend.get(t.id)||0,pending:pendingCount.get(t.id)||0,approvers}; });
 return <div className="space-y-7">
   <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-stone-500">{teams.length} teams</p><h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">Teams</h1><p className="mt-3 max-w-3xl text-base leading-7 text-stone-500">Each team has a monthly budget and its own approvers. Requests are routed to them automatically.</p></div><TeamManager newButton /></div>
   <TeamManager teams={teamData}/>
   <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-stone-900">People</h2><p className="text-sm text-stone-500">Grant or remove admin access, or remove someone from Proclaim entirely.</p></div><Shield size={20} className="text-stone-400"/></div><div className="mt-5 divide-y divide-stone-100">{users.map(u=><div key={u.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-stone-900">{u.name||u.email}</p><p className="truncate text-xs text-stone-500">{u.email}</p></div><div className="flex flex-wrap items-center gap-2"><form action={setAdminStatus} className="flex items-center gap-2"><input type="hidden" name="email" value={u.email||''}/><select name="isAdmin" defaultValue={u.isAdmin?'true':'false'} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"><option value="false">Standard user</option><option value="true">Administrator</option></select><FormButton pendingLabel="Saving…" className="rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200">Save</FormButton></form>{u.email && u.email.toLowerCase()!==(user.email||'').toLowerCase() && <RemoveUserButton email={u.email} name={u.name||u.email}/>}</div></div>)}</div></section>
 </div>;
}
