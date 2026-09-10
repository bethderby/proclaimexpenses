import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExportControls from '@/components/ExportControls';

export default async function ExportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-stone-900 tracking-tight mb-1">Export</h2>
      <p className="text-sm text-stone-500 mb-6">Export data or create a consolidated report for any date range.</p>
      <ExportControls teams={teams.map((t) => ({ id: t.id, name: t.name }))} isAdmin={!!(session.user as any).isAdmin} />
    </div>
  );
}
