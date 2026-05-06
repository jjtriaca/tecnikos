const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const withSpecs = await p.product.count({ where: { technicalSpecs: { not: null } } });
  const total = await p.product.count();
  console.log({ totalProducts: total, withTechnicalSpecs: withSpecs });
  const sample = await p.product.findFirst({ where: { technicalSpecs: { not: null }, brand: { not: null } }, select: { description: true, brand: true, technicalSpecs: true } });
  console.log('Sample:', JSON.stringify(sample, null, 2));
  await p.$disconnect();
})();
