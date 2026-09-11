import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import BudgetCharts from '@/components/BudgetCharts';
import ExportControls from '@/components/ExportControls';

function monthLabel(mk:string){const[y,m]=mk.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'});}
export default async function ReportsPage(){
 const session=await getServerSession(authOptions); if(!session?.user)redirect('/login'); const user=session.user as any;
 const [teams,expenses]=await Promise.all([prisma.team.findMany({orderBy:{name:'asc'}}),prisma.expense.findMany({include:{team:true},orderBy:{date:'asc'}})]);
 const spendByTeam:Record<string,number>={}; teams.forEach(t=>spendByTeam[t.id]=0); expenses.forEach(e=>spendByTeam[e.teamId]=(spendByTeam[e.teamId]||0)+e.amount);
 const barData=teams.map(t=>({name:t.name,Spent:Math.round(spendByTeam[t.id]||0)}));
 const pieData=teams.map(t=>({name:t.name,value:Math.round(spendByTeam[t.id]||0)})).filter(x=>x.value>0);
 const monthTotals:Record<string,number>={}; expenses.forEach(e=>{const mk=e.date.toISOString().slice(0,7);monthTotals[mk]=(monthTotals[mk]||0)+e.amount;});
 const trendData=Object.keys(monthTotals).sort().map(mk=>({month:monthLabel(mk),Spend:Math.round(monthTotals[mk])}));
 return <div className="space-y-7"><div><p className="text-sm font-semibold text-emerald-600">Reporting</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Reports</h1><p className="mt-2 text-sm text-slate-500">Export your expense data and review spending across teams.</p></div><ExportControls teams={teams.map(t=>({id:t.id,name:t.name}))} isAdmin={!!user.isAdmin}/><BudgetCharts barData={barData} trendData={trendData} pieData={pieData}/></div>
}
