const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Deactivate any existing add-ons
  await prisma.addOn.updateMany({ data: { isActive: false } });

  const addons = [
    { name: '+50 OS/mês', description: '50 ordens de serviço adicionais por mês', osQuantity: 50, userQuantity: 0, technicianQuantity: 0, aiMessageQuantity: 0, priceCents: 6700, sortOrder: 1 },
    { name: '+100 OS/mês', description: '100 ordens de serviço adicionais por mês', osQuantity: 100, userQuantity: 0, technicianQuantity: 0, aiMessageQuantity: 0, priceCents: 12700, sortOrder: 2 },
    { name: '+200 OS/mês', description: '200 ordens de serviço adicionais por mês', osQuantity: 200, userQuantity: 0, technicianQuantity: 0, aiMessageQuantity: 0, priceCents: 23700, sortOrder: 3 },
    { name: '+1 Usuário Gestor', description: '1 usuário gestor adicional', osQuantity: 0, userQuantity: 1, technicianQuantity: 0, aiMessageQuantity: 0, priceCents: 5700, sortOrder: 4 },
    { name: '+2 Usuários Gestores', description: '2 usuários gestores adicionais', osQuantity: 0, userQuantity: 2, technicianQuantity: 0, aiMessageQuantity: 0, priceCents: 9700, sortOrder: 5 },
    { name: '+5 Técnicos', description: '5 técnicos adicionais', osQuantity: 0, userQuantity: 0, technicianQuantity: 5, aiMessageQuantity: 0, priceCents: 7900, sortOrder: 6 },
    { name: '+100 Msgs IA', description: '100 mensagens de IA adicionais por mês', osQuantity: 0, userQuantity: 0, technicianQuantity: 0, aiMessageQuantity: 100, priceCents: 4700, sortOrder: 7 },
    { name: '+500 Msgs IA', description: '500 mensagens de IA adicionais por mês', osQuantity: 0, userQuantity: 0, technicianQuantity: 0, aiMessageQuantity: 500, priceCents: 19700, sortOrder: 8 },
  ];

  for (const a of addons) {
    const created = await prisma.addOn.create({ data: a });
    console.log('Created:', a.name, '- R$' + (a.priceCents / 100).toFixed(2), '- ID:', created.id);
  }

  const count = await prisma.addOn.count({ where: { isActive: true } });
  console.log('\nTotal active add-ons:', count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
