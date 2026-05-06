const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const products = await p.product.count();
  const services = await p.service.count();
  const catalog = await p.poolCatalogConfig.count();
  const cBySection = await p.poolCatalogConfig.groupBy({ by: ['poolSection'], _count: true });
  console.log({ products, services, catalog });
  console.log('catalog por etapa:', cBySection);
  await p.$disconnect();
})();
