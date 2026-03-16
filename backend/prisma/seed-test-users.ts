/**
 * Seed para testes de segurança: cria Company B + users de teste
 */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  const hashLeitura = await bcrypt.hash('leitura123', 10);

  // Company B
  const companyB = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Company B (Teste)',
    },
  });
  console.log(`Company B: ${companyB.name} (${companyB.id})`);

  // Admin da Company B
  const userB = await prisma.user.upsert({
    where: { email: 'admin@companyb.com' },
    update: { passwordHash: hash },
    create: {
      companyId: companyB.id,
      name: 'Admin Company B',
      email: 'admin@companyb.com',
      passwordHash: hash,
      roles: [UserRole.ADMIN],
    },
  });
  console.log(`User B: ${userB.email} / admin123 (role: ${userB.roles})`);

  // User LEITURA na Company A (demo)
  const userLeitura = await prisma.user.upsert({
    where: { email: 'leitura@demo.com' },
    update: { passwordHash: hashLeitura },
    create: {
      companyId: '00000000-0000-0000-0000-000000000001',
      name: 'Usuário Leitura',
      email: 'leitura@demo.com',
      passwordHash: hashLeitura,
      roles: [UserRole.LEITURA],
    },
  });
  console.log(`User Leitura: ${userLeitura.email} / leitura123 (role: ${userLeitura.roles})`);

  // User FINANCEIRO na Company A
  const userFin = await prisma.user.upsert({
    where: { email: 'financeiro@demo.com' },
    update: { passwordHash: hash },
    create: {
      companyId: '00000000-0000-0000-0000-000000000001',
      name: 'Usuário Financeiro',
      email: 'financeiro@demo.com',
      passwordHash: hash,
      roles: [UserRole.FINANCEIRO],
    },
  });
  console.log(`User Financeiro: ${userFin.email} / admin123 (role: ${userFin.roles})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
