import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEAMS = [
  { name: 'Media', approverEmail: 'priya.sales@company.com', budgetTarget: 5000 },
  { name: 'Worship', approverEmail: 'tom.marketing@company.com', budgetTarget: 4000 },
  { name: 'Hospitality', approverEmail: 'dana.eng@company.com', budgetTarget: 8000 },
  { name: 'Evangelism', approverEmail: 'dana.eng@company.com', budgetTarget: 8000 },
  { name: 'Welcome Team', approverEmail: 'dana.eng@company.com', budgetTarget: 8000 },
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
