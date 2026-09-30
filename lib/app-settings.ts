import { prisma } from '@/lib/prisma';

export async function isWiseEnabled() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'default' }, select: { wiseEnabled: true } });
  return settings?.wiseEnabled ?? true;
}
