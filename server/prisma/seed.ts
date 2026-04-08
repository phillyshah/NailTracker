import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: hash },
    create: {
      username: 'admin',
      password: hash,
      role: 'admin',
    },
  });

  console.log('Admin user created/updated');

  // Create sample distributors
  const distributors = [
    {
      name: 'Mid-Atlantic Ortho Supply',
      region: 'Northeast',
      contact: 'Jane Smith',
      email: 'jane@midatlanticortho.com',
      phone: '(215) 555-0101',
    },
    {
      name: 'Southeastern Medical Dist.',
      region: 'Southeast',
      contact: 'Carlos Rivera',
      email: 'carlos@southeasternmed.com',
      phone: '(404) 555-0202',
    },
    {
      name: 'Great Lakes Surgical',
      region: 'Midwest',
      contact: 'Amy Chen',
      email: 'amy@greatlakessurgical.com',
      phone: '(312) 555-0303',
    },
  ];

  for (const d of distributors) {
    await prisma.distributor.upsert({
      where: { name: d.name },
      update: d,
      create: d,
    });
  }

  console.log(`${distributors.length} distributors created/updated`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
