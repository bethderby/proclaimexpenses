import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import BudgetCharts from '@/components/BudgetCharts';
function monthLabel(mk:string){const[y,m]=mk.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-GB',{month:'short',year:'numeric'});}
export default async function BudgetsPage(){
 const session=await getServerSession(authOptions); if(!session?.user)redirect('/login'); const user=session.user as any;
 const [teams,spent]=await Promise.all([prisma.team.findMany({orderBy:{name:'asc'}}),prisma.expense.findMany()]);
 const spendByTeam:Record<string,number>={}; teams.forEach(t=>spendByTeam[t.id]=0); spent.forEach(e=>spendByTeam[e.teamId]=(spendByTeam[e.teamId]||0)+e.amount);
 const teamSummaries=teams.map(t=>({id:t.id,name:t.name,target:t.budgetTarget,spent:spendByTeam[t.id]||0,canEdit:!!user.isAdmin||t.approverEmail?.toLowerCase()===(user.email??'').toLowerCase()}));
 const barData=teams.map(t=>({name:t.name,Spent:Math.round(spendByTeam[t.id]||0),Target:t.budgetTarget}));
 const monthTotals:Record<string,number>={}; spent.forEach(e=>{const mk=e.date.toISOString().slice(0,7);monthTotals[mk]=(monthTotals[mk]||0)+e.amount;});
 const trendData=Object.keys(monthTotals).sort().map(mk=>({month:monthLabel(mk),Spend:Math.round(monthTotals[mk])}));
 return <div className="space-y-6"><div><p className="text-sm font-semibold text-emerald-600">Financial overview</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Budgets & reports</h1><p className="mt-2 text-sm text-slate-500">Track spend against team targets.</p></div><BudgetCharts teams={teamSummaries} barData={barData} trendData={trendData}/></div>
}
