const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const pump = await p.product.findFirst({ where: { description: { contains: 'Bomba', mode: 'insensitive' } }, select: { description: true, technicalSpecs: true, salePriceCents: true } });
  console.log(JSON.stringify(pump, null, 2));
  await p.$disconnect();
})();
