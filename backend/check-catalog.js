const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const products = await p.product.count();
  const services = await p.service.count();
  const catalog = await p.poolCatalogConfig.count();
  console.log({ products, services, catalog });
  const sample = await p.product.findMany({ take: 3 });
  console.log('produto sample:', JSON.stringify(sample, null, 2));
  await p.$disconnect();
})();
