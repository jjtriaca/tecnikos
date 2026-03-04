/**
 * Seed: cria dados iniciais para testes.
 *
 * Uso: npx prisma db seed
 */
import { PrismaClient, UserRole, ServiceOrderStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  // ── Empresa Demo ──
  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      name: 'Empresa Demo',
      commissionBps: 1000,
    },
  });
  console.log(`✅ Company: ${company.name} (${company.id})`);

  // ── Usuário Admin ──
  const passwordHash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: { passwordHash },
    create: {
      companyId: COMPANY_ID,
      name: 'Administrador',
      email: 'admin@demo.com',
      passwordHash,
      roles: [UserRole.ADMIN],
    },
  });
  console.log(`✅ User: ${user.email} / admin123 (role: ${user.roles})`);

  // ── Usuário Despacho ──
  const despachoHash = await bcrypt.hash('despacho123', 10);
  const despacho = await prisma.user.upsert({
    where: { email: 'despacho@demo.com' },
    update: { passwordHash: despachoHash },
    create: {
      companyId: COMPANY_ID,
      name: 'Operador Despacho',
      email: 'despacho@demo.com',
      passwordHash: despachoHash,
      roles: [UserRole.DESPACHO],
    },
  });
  console.log(`✅ User: ${despacho.email} / despacho123 (role: ${despacho.roles})`);

  // ── Especializações ──
  const specNames = [
    'Elétrica', 'Hidráulica', 'HVAC/Ar Condicionado', 'Pintura',
    'Alvenaria', 'Serralheria', 'Marcenaria', 'Instalação',
    'Manutenção Preventiva', 'Redes/TI',
  ];

  const specs: Record<string, string> = {};
  for (const name of specNames) {
    const spec = await prisma.specialization.upsert({
      where: { companyId_name: { companyId: COMPANY_ID, name } },
      update: {},
      create: {
        companyId: COMPANY_ID,
        name,
        isDefault: true,
      },
    });
    specs[name] = spec.id;
  }
  console.log(`✅ Especializações: ${specNames.length} cadastradas`);

  // ── Parceiro/Técnico 1: Carlos ──
  const techHash = await bcrypt.hash('tech123', 10);
  const carlos = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: { passwordHash: techHash },
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      companyId: COMPANY_ID,
      partnerTypes: ['TECNICO'],
      personType: 'PF',
      name: 'Carlos Técnico',
      phone: '11999991234',
      email: 'tecnico@demo.com',
      passwordHash: techHash,
      rating: 4.5,
      document: '12345678901',
      documentType: 'CPF',
      city: 'São Paulo',
      state: 'SP',
      status: 'ATIVO',
    },
  });
  console.log(`✅ Parceiro/Técnico: ${carlos.name} — tecnico@demo.com / tech123`);

  // Assign specializations to Carlos (Elétrica, HVAC, Instalação)
  for (const specName of ['Elétrica', 'HVAC/Ar Condicionado', 'Instalação']) {
    await prisma.partnerSpecialization.upsert({
      where: {
        partnerId_specializationId: {
          partnerId: carlos.id,
          specializationId: specs[specName],
        },
      },
      update: {},
      create: {
        partnerId: carlos.id,
        specializationId: specs[specName],
      },
    });
  }
  console.log(`  → Especializações: Elétrica, HVAC, Instalação`);

  // ── Parceiro/Técnico 2: Ana ──
  const tech2Hash = await bcrypt.hash('tech123', 10);
  const ana = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: { passwordHash: tech2Hash },
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      companyId: COMPANY_ID,
      partnerTypes: ['TECNICO'],
      personType: 'PF',
      name: 'Ana Técnica',
      phone: '11988885678',
      email: 'tecnico2@demo.com',
      passwordHash: tech2Hash,
      rating: 4.8,
      document: '98765432100',
      documentType: 'CPF',
      city: 'São Paulo',
      state: 'SP',
      status: 'ATIVO',
    },
  });
  console.log(`✅ Parceiro/Técnico: ${ana.name} — tecnico2@demo.com / tech123`);

  // Assign specializations to Ana (Hidráulica, Manutenção Preventiva, HVAC)
  for (const specName of ['Hidráulica', 'Manutenção Preventiva', 'HVAC/Ar Condicionado']) {
    await prisma.partnerSpecialization.upsert({
      where: {
        partnerId_specializationId: {
          partnerId: ana.id,
          specializationId: specs[specName],
        },
      },
      update: {},
      create: {
        partnerId: ana.id,
        specializationId: specs[specName],
      },
    });
  }
  console.log(`  → Especializações: Hidráulica, Manutenção Preventiva, HVAC`);

  // ── Parceiro: Cliente PJ ──
  await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      companyId: COMPANY_ID,
      partnerTypes: ['CLIENTE'],
      personType: 'PJ',
      name: 'TechCorp Soluções Ltda',
      tradeName: 'TechCorp',
      document: '12345678000190',
      documentType: 'CNPJ',
      phone: '1133334444',
      email: 'contato@techcorp.com.br',
      city: 'São Paulo',
      state: 'SP',
      status: 'ATIVO',
    },
  });
  console.log(`✅ Parceiro: TechCorp Soluções Ltda (CLIENTE/PJ)`);

  // ── Parceiro: Fornecedor PJ ──
  await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000021' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000021',
      companyId: COMPANY_ID,
      partnerTypes: ['FORNECEDOR'],
      personType: 'PJ',
      name: 'Distribuidora Elétrica Brasil SA',
      tradeName: 'ElétricaBR',
      document: '98765432000100',
      documentType: 'CNPJ',
      phone: '1122225555',
      email: 'vendas@eletricabr.com.br',
      city: 'Guarulhos',
      state: 'SP',
      status: 'ATIVO',
    },
  });
  console.log(`✅ Parceiro: Distribuidora Elétrica Brasil (FORNECEDOR/PJ)`);

  // ── Parceiro: Cliente PF ──
  await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000022' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000022',
      companyId: COMPANY_ID,
      partnerTypes: ['CLIENTE'],
      personType: 'PF',
      name: 'Maria Silva Santos',
      document: '11122233344',
      documentType: 'CPF',
      phone: '11977776666',
      email: 'maria.santos@email.com',
      city: 'São Paulo',
      state: 'SP',
      isRuralProducer: false,
      status: 'ATIVO',
    },
  });
  console.log(`✅ Parceiro: Maria Silva Santos (CLIENTE/PF)`);

  // ── Parceiro Multi-tipo: Cliente + Técnico ──
  const multiHash = await bcrypt.hash('tech123', 10);
  const multi = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000023' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000023',
      companyId: COMPANY_ID,
      partnerTypes: ['CLIENTE', 'TECNICO'],
      personType: 'PF',
      name: 'Roberto Multifuncional',
      document: '55566677788',
      documentType: 'CPF',
      phone: '11966665555',
      email: 'roberto@email.com',
      passwordHash: multiHash,
      rating: 4.2,
      city: 'São Paulo',
      state: 'SP',
      status: 'ATIVO',
    },
  });
  console.log(`✅ Parceiro: Roberto Multifuncional (CLIENTE+TECNICO/PF)`);

  // Assign specializations to Roberto (Pintura, Alvenaria)
  for (const specName of ['Pintura', 'Alvenaria']) {
    await prisma.partnerSpecialization.upsert({
      where: {
        partnerId_specializationId: {
          partnerId: multi.id,
          specializationId: specs[specName],
        },
      },
      update: {},
      create: {
        partnerId: multi.id,
        specializationId: specs[specName],
      },
    });
  }
  console.log(`  → Especializações: Pintura, Alvenaria`);

  // ── Workflow Template ──
  const wf = await prisma.workflowTemplate.upsert({
    where: { id: '00000000-0000-0000-0000-000000000100' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000100',
      companyId: COMPANY_ID,
      name: 'Fluxo Padrão',
      isDefault: true,
      requiredSpecializationIds: [specs['Elétrica'], specs['HVAC/Ar Condicionado']],
      steps: [
        { order: 1, name: 'Check-in no local', icon: '📍', requirePhoto: false, requireNote: false },
        { order: 2, name: 'Foto antes do serviço', icon: '📷', requirePhoto: true, requireNote: false },
        { order: 3, name: 'Execução do serviço', icon: '🔧', requirePhoto: false, requireNote: true },
        { order: 4, name: 'Foto depois do serviço', icon: '📷', requirePhoto: true, requireNote: false },
        { order: 5, name: 'Assinatura do cliente', icon: '✍️', requirePhoto: false, requireNote: true },
      ],
    },
  });
  console.log(`✅ Workflow: ${wf.name} (${wf.steps ? (wf.steps as any[]).length : 0} passos, padrão: ${wf.isDefault})`);

  // ── Ordens de Serviço de exemplo ──
  const os1 = await prisma.serviceOrder.upsert({
    where: { id: '00000000-0000-0000-0000-000000001001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001001',
      companyId: COMPANY_ID,
      title: 'Instalação de ar condicionado',
      description: 'Instalar split 12000 BTUs no quarto principal.',
      addressText: 'Rua Augusta, 1500 - São Paulo, SP',
      lat: -23.5536,
      lng: -46.6580,
      valueCents: 35000,
      deadlineAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: ServiceOrderStatus.ABERTA,
      workflowTemplateId: wf.id,
      clientPartnerId: '00000000-0000-0000-0000-000000000020', // TechCorp
    },
  });
  console.log(`✅ OS: ${os1.title} (ABERTA, com workflow)`);

  const os2 = await prisma.serviceOrder.upsert({
    where: { id: '00000000-0000-0000-0000-000000001002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001002',
      companyId: COMPANY_ID,
      title: 'Manutenção preventiva - Geladeira',
      description: 'Limpeza do condensador e verificação de gás.',
      addressText: 'Av. Paulista, 900 - São Paulo, SP',
      lat: -23.5629,
      lng: -46.6544,
      valueCents: 15000,
      deadlineAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      status: ServiceOrderStatus.ATRIBUIDA,
      assignedPartnerId: carlos.id,
      acceptedAt: new Date(),
      workflowTemplateId: wf.id,
      clientPartnerId: '00000000-0000-0000-0000-000000000022', // Maria Silva Santos
    },
  });
  console.log(`✅ OS: ${os2.title} (ATRIBUÍDA → Carlos Técnico)`);

  const os3 = await prisma.serviceOrder.upsert({
    where: { id: '00000000-0000-0000-0000-000000001003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001003',
      companyId: COMPANY_ID,
      title: 'Reparo de máquina de lavar',
      description: 'Motor fazendo barulho estranho durante centrifugação.',
      addressText: 'Rua Oscar Freire, 300 - São Paulo, SP',
      lat: -23.5615,
      lng: -46.6720,
      valueCents: 28000,
      deadlineAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: ServiceOrderStatus.EM_EXECUCAO,
      assignedPartnerId: ana.id,
      acceptedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      workflowTemplateId: wf.id,
      clientPartnerId: '00000000-0000-0000-0000-000000000023', // Roberto Multifuncional
    },
  });
  console.log(`✅ OS: ${os3.title} (EM EXECUÇÃO → Ana Técnica, ATRASADA)`);

  console.log('\n🎉 Seed completo!\n');
  console.log('Logins disponíveis:');
  console.log('  Gestor:   admin@demo.com / admin123');
  console.log('  Despacho: despacho@demo.com / despacho123');
  console.log('  Técnico:  tecnico@demo.com / tech123');
  console.log('  Técnico:  tecnico2@demo.com / tech123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
