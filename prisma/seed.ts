import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEAMS = [
  { name: 'Media', approverEmails: ['priya.sales@company.com'], budgetTarget: 5000 },
  { name: 'Worship', approverEmails: ['tom.marketing@company.com'], budgetTarget: 4000 },
  { name: 'Hospitality', approverEmails: ['dana.eng@company.com'], budgetTarget: 8000 },
  { name: 'Evangelism', approverEmails: ['dana.eng@company.com'], budgetTarget: 8000 },
  { name: 'Welcome Team', approverEmails: ['dana.eng@company.com'], budgetTarget: 8000 },
];

async function main() {
  for (const t of TEAMS) {
    await prisma.team.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
  }
  console.log('Seeded teams:', TEAMS.map((t) => t.name).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
