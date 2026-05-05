const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: "postgresql://tecnikos_user:tecnikos_pass@localhost:5433/tecnikos?schema=public" } } });
(async () => {
  const schemas = await p.$queryRawUnsafe(`SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('public', 'tenant_sls')`);
  console.log("schemas:", schemas);
  
  const pubCount = await p.$queryRawUnsafe(`SELECT COUNT(*)::int FROM "PoolCatalogConfig"`);
  console.log("public count:", pubCount);
  
  // Try tenant_sls
  try {
    const tenantCount = await p.$queryRawUnsafe(`SELECT COUNT(*)::int FROM tenant_sls."PoolCatalogConfig"`);
    console.log("tenant_sls count:", tenantCount);
  } catch (e) {
    console.log("tenant_sls error:", e.message.slice(0, 100));
  }
  await p.$disconnect();
})();
