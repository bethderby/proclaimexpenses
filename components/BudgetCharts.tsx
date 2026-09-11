'use client';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
const fmt=(n:number)=>`£${n.toFixed(2)}`;
export default function BudgetCharts({barData,trendData,pieData}:{barData:{name:string;Spent:number}[];trendData:{month:string;Spend:number}[];pieData:{name:string;value:number}[]}){
 return <div className="grid gap-6 lg:grid-cols-2">
   <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
     <p className="font-semibold text-slate-950">Spend by team</p><p className="mb-4 text-xs text-slate-500">Total recorded spending for each team.</p>
     {barData.length===0?<p className="py-20 text-center text-sm text-slate-400">No expenses logged yet.</p>:<ResponsiveContainer width="100%" height={280}><BarChart data={barData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip formatter={(v:any)=>fmt(Number(v))}/><Bar dataKey="Spent" fill="#0f172a" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>}
   </div>
   <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
     <p className="font-semibold text-slate-950">Team spending</p><p className="mb-4 text-xs text-slate-500">Share of recorded spending by team.</p>
     {pieData.length===0?<p className="py-20 text-center text-sm text-slate-400">No expenses logged yet.</p>:<ResponsiveContainer width="100%" height={280}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={45} paddingAngle={2}>{pieData.map((_,i)=><Cell key={i} fill={`hsl(${i*47}, 62%, 45%)`}/>)}</Pie><Tooltip formatter={(v:any)=>fmt(Number(v))}/><Legend/></PieChart></ResponsiveContainer>}
   </div>
   <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
     <p className="font-semibold text-slate-950">Monthly spend</p><p className="mb-4 text-xs text-slate-500">Recorded spending over time.</p>
     {trendData.length===0?<p className="py-20 text-center text-sm text-slate-400">No expenses logged yet.</p>:<ResponsiveContainer width="100%" height={280}><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip formatter={(v:any)=>fmt(Number(v))}/><Line type="monotone" dataKey="Spend" stroke="#0f172a" strokeWidth={3} dot={{r:3}}/></LineChart></ResponsiveContainer>}
   </div>
 </div>
}
