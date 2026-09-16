import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import BudgetCharts from '@/components/BudgetCharts';
import ExportControls from '@/components/ExportControls';
import ReportSchedule from '@/components/ReportSchedule';

function monthLabel(mk:string){const[y,m]=mk.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'});}
export default async function ReportsPage(){
 const session=await getServerSession(authOptions); if(!session?.user)redirect('/login'); const user=session.user as any; if(!user.isAdmin)redirect('/dashboard');
 const [teams,expenses,schedule]=await Promise.all([prisma.team.findMany({orderBy:{name:'asc'}}),prisma.expense.findMany({include:{team:true},orderBy:{date:'asc'}}),prisma.reportSchedule.findUnique({where:{id:'default'}})]);
 const spendByTeam:Record<string,number>={}; teams.forEach(t=>spendByTeam[t.id]=0); expenses.forEach(e=>spendByTeam[e.teamId]=(spendByTeam[e.teamId]||0)+e.amount);
 const barData=teams.map(t=>({name:t.name,Spent:Math.round(spendByTeam[t.id]||0)}));
 const pieData=teams.map(t=>({name:t.name,value:Math.round(spendByTeam[t.id]||0)})).filter(x=>x.value>0);
 const monthTotals:Record<string,number>={}; expenses.forEach(e=>{const mk=e.date.toISOString().slice(0,7);monthTotals[mk]=(monthTotals[mk]||0)+e.amount;});
 const trendData=Object.keys(monthTotals).sort().map(mk=>({month:monthLabel(mk),Spend:Math.round(monthTotals[mk])}));
 const reportRecipients = schedule?.recipients ?? [];
 return <div className="space-y-7"><div><p className="text-sm font-semibold text-[#C99600]">Reporting</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Reports</h1><p className="mt-2 text-sm text-slate-500">Export your expense data and review spending across teams.</p></div><ExportControls teams={teams.map(t=>({id:t.id,name:t.name}))} isAdmin={!!user.isAdmin}/><ReportSchedule enabled={schedule?.enabled ?? true} dayOfMonth={schedule?.dayOfMonth ?? 1} hour={schedule?.hour ?? 6} recipients={reportRecipients}/><BudgetCharts barData={barData} trendData={trendData} pieData={pieData}/></div>
}
