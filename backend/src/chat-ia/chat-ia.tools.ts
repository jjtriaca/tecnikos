/**
 * Tool definitions for Claude — context-aware queries on tenant data.
 * Uses `any` for db param since queries run on dynamic tenant schemas.
 */
import * as crypto from 'crypto';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

/** Tools that require ADMIN role */
const ADMIN_ONLY_TOOLS = new Set([
  'configurar_whatsapp',
  'testar_conexao_whatsapp',
  'configurar_focus_nfe',
  'testar_focus_nfe',
  'salvar_codigo_ibge',
  'registrar_empresa_focus',
  'verificar_push_notifications',
]);

/** Encrypt a plaintext string using AES-256-GCM (same as EncryptionService) */
function encryptToken(plaintext: string): string {
  const envKey = process.env.ENCRYPTION_KEY;
  let key: Buffer;
  if (envKey) {
    key = Buffer.from(envKey, 'hex');
  } else {
    const secret = process.env.JWT_SECRET || 'tecnikos-default-secret';
    key = crypto.scryptSync(secret, 'tecnikos-salt', 32);
  }
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM — MUST match EncryptionService
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return `${iv.toString('base64')}:${authTag}:${encrypted}`;
}

/** Decrypt a token encrypted with encryptToken / EncryptionService */
function decryptToken(encryptedValue: string): string {
  const envKey = process.env.ENCRYPTION_KEY;
  let key: Buffer;
  if (envKey) {
    key = Buffer.from(envKey, 'hex');
  } else {
    const secret = process.env.JWT_SECRET || 'tecnikos-default-secret';
    key = crypto.scryptSync(secret, 'tecnikos-salt', 32);
  }
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Token armazenado está corrompido');
  }
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encData = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Get FOCUS_NFE_RESELLER_TOKEN from SaasConfig (DB) first, fallback to env */
async function getResellerToken(db: any): Promise<string | null> {
  try {
    // Try public schema SaasConfig table
    const { PrismaClient } = require('@prisma/client');
    const publicDb = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const row = await publicDb.saasConfig.findUnique({ where: { key: 'FOCUS_NFE_RESELLER_TOKEN' } });
    await publicDb.$disconnect();
    if (row?.value) {
      return row.encrypted ? decryptToken(row.value) : row.value;
    }
  } catch {
    // Fallback silently
  }
  return process.env.FOCUS_NFE_RESELLER_TOKEN || null;
}

export const CHAT_IA_TOOLS: ToolDefinition[] = [
  {
    name: 'buscar_ordens_servico',
    description:
      'Busca ordens de serviço. Pode filtrar por status, técnico, cliente, período. Retorna lista resumida.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtrar por status: ABERTA, ATRIBUIDA, EM_EXECUCAO, CONCLUIDA, CANCELADA',
          enum: ['ABERTA', 'OFERTADA', 'ATRIBUIDA', 'A_CAMINHO', 'EM_EXECUCAO', 'CONCLUIDA', 'APROVADA', 'AJUSTE', 'CANCELADA'],
        },
        tecnico: { type: 'string', description: 'Nome do técnico (busca parcial)' },
        cliente: { type: 'string', description: 'Nome do cliente (busca parcial)' },
        dataInicio: { type: 'string', description: 'Data início (YYYY-MM-DD)' },
        dataFim: { type: 'string', description: 'Data fim (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Máximo de resultados (padrão: 10)' },
      },
    },
  },
  {
    name: 'buscar_clientes',
    description: 'Busca clientes/parceiros por nome, CNPJ, telefone ou email. Retorna lista resumida.',
    input_schema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Termo de busca (nome, CNPJ, telefone ou email)' },
        tipo: {
          type: 'string',
          description: 'Tipo de parceiro',
          enum: ['CLIENTE', 'FORNECEDOR', 'TECNICO'],
        },
        limit: { type: 'number', description: 'Máximo de resultados (padrão: 10)' },
      },
      required: ['busca'],
    },
  },
  {
    name: 'resumo_dashboard',
    description:
      'Retorna KPIs do dashboard: OS abertas, em execução, concluídas no mês, faturamento do mês, técnicos ativos.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'buscar_financeiro',
    description: 'Busca lançamentos financeiros. Pode filtrar por tipo (RECEIVABLE/PAYABLE), status, período.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'RECEIVABLE (a receber) ou PAYABLE (a pagar)', enum: ['RECEIVABLE', 'PAYABLE'] },
        status: {
          type: 'string',
          description: 'Status do lançamento',
          enum: ['PENDING', 'CONFIRMED', 'PAID', 'CANCELLED'],
        },
        dataInicio: { type: 'string', description: 'Data início (YYYY-MM-DD)' },
        dataFim: { type: 'string', description: 'Data fim (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Máximo de resultados (padrão: 10)' },
      },
    },
  },
  {
    name: 'buscar_tecnicos',
    description: 'Lista técnicos da empresa com suas especializações e status.',
    input_schema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Nome do técnico (busca parcial)' },
        limit: { type: 'number', description: 'Máximo de resultados (padrão: 20)' },
      },
    },
  },
  {
    name: 'info_empresa',
    description: 'Retorna dados da empresa: nome, CNPJ, plano, limites, configurações ativas.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'verificar_configuracao',
    description:
      'Verifica o status de uma configuração específica do sistema (email, whatsapp, fiscal, workflow, etc).',
    input_schema: {
      type: 'object',
      properties: {
        configuracao: {
          type: 'string',
          description: 'Qual configuração verificar',
          enum: ['email', 'whatsapp', 'fiscal', 'workflow', 'usuarios', 'tecnicos', 'pagamento', 'automacao', 'push'],
        },
      },
      required: ['configuracao'],
    },
  },
  {
    name: 'configurar_whatsapp',
    description:
      'Configura o WhatsApp Business API no sistema. Salva as credenciais, testa a conexão e retorna a URL do webhook para o cliente configurar no Meta. IMPORTANTE: o Access Token deve começar com EAA.',
    input_schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'Access Token do System User (começa com EAA...)' },
        phoneNumberId: { type: 'string', description: 'Phone Number ID do Meta (número do endpoint, NÃO é o telefone)' },
        wabaId: { type: 'string', description: 'WhatsApp Business Account ID (WABA ID)' },
        appId: { type: 'string', description: 'App ID do Meta for Developers (opcional, para sincronizar logo)' },
      },
      required: ['accessToken', 'phoneNumberId'],
    },
  },
  {
    name: 'testar_conexao_whatsapp',
    description:
      'Testa a conexão do WhatsApp já configurado. Verifica se o token ainda é válido, mostra o número conectado, qualidade da conta e lista os templates existentes.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'configurar_focus_nfe',
    description:
      'Configura o módulo fiscal Focus NFe no sistema. Salva token, ambiente (HOMOLOGATION/PRODUCTION), dados fiscais do prestador e códigos tributários. Requer que o módulo fiscal esteja habilitado na empresa.',
    input_schema: {
      type: 'object',
      properties: {
        focusNfeToken: { type: 'string', description: 'Token da API Focus NFe (obtido em app.focusnfe.com.br)' },
        focusNfeEnvironment: { type: 'string', description: 'Ambiente: HOMOLOGATION (testes) ou PRODUCTION (real)', enum: ['HOMOLOGATION', 'PRODUCTION'] },
        inscricaoMunicipal: { type: 'string', description: 'Inscrição Municipal do prestador' },
        codigoMunicipio: { type: 'string', description: 'Código IBGE do município (7 dígitos)' },
        naturezaOperacao: { type: 'string', description: 'Natureza da operação (1 a 6). 1=Tributação no município' },
        optanteSimplesNacional: { type: 'boolean', description: 'Se a empresa é optante pelo Simples Nacional' },
        itemListaServico: { type: 'string', description: 'Código do item na Lista de Serviços LC 116 (ex: 1401)' },
        codigoCnae: { type: 'string', description: 'Código CNAE do serviço (7 dígitos)' },
        codigoTributarioMunicipio: { type: 'string', description: 'Código tributário municipal do serviço' },
        aliquotaIss: { type: 'number', description: 'Alíquota ISS em percentual (ex: 2, 3, 5)' },
        nfseLayout: { type: 'string', description: 'Layout: MUNICIPAL (ABRASF) ou NACIONAL (SPED)', enum: ['MUNICIPAL', 'NACIONAL'] },
        autoEmitOnEntry: { type: 'boolean', description: 'Auto-emitir NFS-e ao criar lançamento a receber' },
      },
      required: ['focusNfeToken'],
    },
  },
  {
    name: 'testar_focus_nfe',
    description:
      'Testa a conexão do Focus NFe já configurado. Verifica se o token é válido, mostra o ambiente (homologação/produção) e o status da configuração fiscal.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'verificar_fiscal_completo',
    description:
      'Verifica o status completo da configuração fiscal NFS-e, retornando um checklist detalhado de cada item: token, código IBGE, inscrição municipal, serviços habilitados, alíquota ISS. Use ao guiar o wizard de configuração fiscal.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'buscar_municipio_ibge',
    description:
      'Busca o código IBGE de um município brasileiro pelo nome ou nome parcial. Retorna os municípios encontrados com código IBGE e UF. Use quando o cliente informar a cidade para auto-preencher o código IBGE.',
    input_schema: {
      type: 'object',
      properties: {
        municipio: { type: 'string', description: 'Nome do município (ex: "São Paulo", "Curitiba")' },
        uf: { type: 'string', description: 'Sigla do estado (ex: "SP", "PR") — opcional para filtrar' },
      },
      required: ['municipio'],
    },
  },
  {
    name: 'salvar_codigo_ibge',
    description:
      'Salva o código IBGE do município na configuração fiscal. Use após confirmar o município correto com o cliente.',
    input_schema: {
      type: 'object',
      properties: {
        codigoMunicipio: { type: 'string', description: 'Código IBGE do município (7 dígitos)' },
        inscricaoMunicipal: { type: 'string', description: 'Inscrição Municipal do prestador (opcional)' },
      },
      required: ['codigoMunicipio'],
    },
  },
  {
    name: 'listar_servicos_nfse',
    description:
      'Lista os serviços NFS-e (códigos tributários nacionais) já cadastrados na empresa. Use no wizard para mostrar ao cliente quais serviços já estão configurados.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'registrar_empresa_focus',
    description:
      'Registra ou atualiza a empresa do cliente na Focus NFe (provedor de emissão fiscal). Usa os dados já cadastrados da empresa (CNPJ, endereço, regime tributário) para registrar automaticamente. Retorna os tokens de emissão e o status do registro. Use no wizard fiscal após coletar os dados básicos.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'verificar_push_notifications',
    description:
      'Verifica o status das notificações push na empresa. Retorna quantos dispositivos estão inscritos e se o serviço está configurado (chaves VAPID). Use no wizard de push notifications.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'verificar_nfse_imports',
    description:
      'Verifica o saldo de importações NFS-e automáticas da empresa: limite, uso no ciclo atual e pacotes disponíveis para compra. Use no wizard de importação NFS-e.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'verificar_plano_billing',
    description:
      'Retorna informações detalhadas do plano e billing da empresa: plano atual, limites, uso, ciclo de cobrança, add-ons ativos, promoções e planos disponíveis para upgrade. Use no wizard de billing/planos.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Execute a tool call against the tenant database.
 * @param userRoles - user roles from JWT (config tools require ADMIN)
 */
export async function executeTool(
  db: any,
  toolName: string,
  input: Record<string, any>,
  userRoles: string[] = [],
): Promise<string> {
  try {
    // Security: config tools require ADMIN role
    if (ADMIN_ONLY_TOOLS.has(toolName)) {
      if (!userRoles.includes('ADMIN')) {
        return JSON.stringify({
          error: 'Acesso negado. Apenas administradores podem usar ferramentas de configuração.',
          dica: 'Peça ao administrador da empresa para realizar essa configuração.',
        });
      }
    }

    switch (toolName) {
      case 'buscar_ordens_servico':
        return await searchServiceOrders(db, input);
      case 'buscar_clientes':
        return await searchPartners(db, input);
      case 'resumo_dashboard':
        return await getDashboardSummary(db);
      case 'buscar_financeiro':
        return await searchFinancial(db, input);
      case 'buscar_tecnicos':
        return await searchTechnicians(db, input);
      case 'info_empresa':
        return await getCompanyInfo(db);
      case 'verificar_configuracao':
        return await checkConfiguration(db, input);
      case 'configurar_whatsapp':
        return await configureWhatsApp(db, input);
      case 'testar_conexao_whatsapp':
        return await testWhatsAppConnection(db);
      case 'configurar_focus_nfe':
        return await configureFocusNfe(db, input);
      case 'testar_focus_nfe':
        return await testFocusNfe(db);
      case 'verificar_fiscal_completo':
        return await checkFiscalComplete(db);
      case 'buscar_municipio_ibge':
        return await searchMunicipioIbge(input);
      case 'salvar_codigo_ibge':
        return await saveCodigoIbge(db, input);
      case 'listar_servicos_nfse':
        return await listServicosNfse(db);
      case 'registrar_empresa_focus':
        return await registerEmpresaFocus(db);
      case 'verificar_push_notifications':
        return await checkPushNotifications(db);
      case 'verificar_nfse_imports':
        return await checkNfseImports(db);
      case 'verificar_plano_billing':
        return await checkPlanoBilling(db);
      default:
        return JSON.stringify({ error: `Tool "${toolName}" não encontrada` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function searchServiceOrders(db: any, input: Record<string, any>): Promise<string> {
  const where: any = { deletedAt: null };
  if (input.status) where.status = input.status;
  if (input.dataInicio || input.dataFim) {
    where.createdAt = {};
    if (input.dataInicio) where.createdAt.gte = new Date(input.dataInicio);
    if (input.dataFim) where.createdAt.lte = new Date(input.dataFim + 'T23:59:59Z');
  }
  if (input.tecnico) {
    where.assignedPartner = { name: { contains: input.tecnico, mode: 'insensitive' } };
  }
  if (input.cliente) {
    where.clientPartner = { name: { contains: input.cliente, mode: 'insensitive' } };
  }

  const orders = await db.serviceOrder.findMany({
    where,
    take: input.limit || 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      valueCents: true,
      createdAt: true,
      scheduledStartAt: true,
      clientPartner: { select: { name: true } },
      assignedPartner: { select: { name: true } },
    },
  });

  const total = await db.serviceOrder.count({ where });

  return JSON.stringify({
    total,
    resultados: orders.map((o: any) => ({
      codigo: o.code,
      titulo: o.title,
      status: o.status,
      valor: o.valueCents ? `R$ ${(o.valueCents / 100).toFixed(2)}` : null,
      cliente: o.clientPartner?.name || 'Sem cliente',
      tecnico: o.assignedPartner?.name || 'Não atribuído',
      criadaEm: o.createdAt.toISOString().split('T')[0],
      agendadaPara: o.scheduledStartAt?.toISOString().split('T')[0] || null,
    })),
  });
}

async function searchPartners(db: any, input: Record<string, any>): Promise<string> {
  const where: any = { deletedAt: null };
  if (input.tipo) {
    where.partnerTypes = { has: input.tipo };
  }
  if (input.busca) {
    where.OR = [
      { name: { contains: input.busca, mode: 'insensitive' } },
      { tradeName: { contains: input.busca, mode: 'insensitive' } },
      { document: { contains: input.busca } },
      { phone: { contains: input.busca } },
      { email: { contains: input.busca, mode: 'insensitive' } },
    ];
  }

  const partners = await db.partner.findMany({
    where,
    take: input.limit || 10,
    orderBy: { name: 'asc' },
    select: {
      name: true,
      tradeName: true,
      document: true,
      phone: true,
      email: true,
      partnerTypes: true,
      city: true,
      state: true,
    },
  });

  return JSON.stringify({
    total: partners.length,
    resultados: partners.map((p: any) => ({
      nome: p.tradeName || p.name,
      documento: p.document,
      telefone: p.phone,
      email: p.email,
      tipos: p.partnerTypes,
      cidade: p.city ? `${p.city}/${p.state}` : null,
    })),
  });
}

async function getDashboardSummary(db: any): Promise<string> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [osAbertas, osExecucao, osConcluidas, osCriadasMes, totalClientes, totalTecnicos] =
    await Promise.all([
      db.serviceOrder.count({ where: { status: 'ABERTA', deletedAt: null } }),
      db.serviceOrder.count({ where: { status: 'EM_EXECUCAO', deletedAt: null } }),
      db.serviceOrder.count({
        where: { status: 'CONCLUIDA', deletedAt: null, updatedAt: { gte: startOfMonth } },
      }),
      db.serviceOrder.count({ where: { createdAt: { gte: startOfMonth }, deletedAt: null } }),
      db.partner.count({ where: { deletedAt: null, partnerTypes: { has: 'CLIENTE' } } }),
      db.partner.count({ where: { deletedAt: null, partnerTypes: { has: 'TECNICO' } } }),
    ]);

  let faturamentoMes = 0;
  let aReceber = 0;
  try {
    const entries = await db.financialEntry.findMany({
      where: {
        type: 'RECEIVABLE',
        deletedAt: null,
        dueDate: { gte: startOfMonth },
      },
      select: { grossCents: true, status: true },
    });
    faturamentoMes = entries.reduce((sum: number, e: any) => sum + e.grossCents, 0);
    aReceber = entries
      .filter((e: any) => e.status === 'PENDING')
      .reduce((sum: number, e: any) => sum + e.grossCents, 0);
  } catch {
    // financialEntry may not exist in all schemas
  }

  return JSON.stringify({
    osAbertas,
    osEmExecucao: osExecucao,
    osConcluidasMes: osConcluidas,
    osCriadasMes,
    totalClientes,
    totalTecnicos,
    faturamentoMes: `R$ ${(faturamentoMes / 100).toFixed(2)}`,
    aReceber: `R$ ${(aReceber / 100).toFixed(2)}`,
  });
}

async function searchFinancial(db: any, input: Record<string, any>): Promise<string> {
  const where: any = { deletedAt: null };
  if (input.tipo) where.type = input.tipo;
  if (input.status) where.status = input.status;
  if (input.dataInicio || input.dataFim) {
    where.dueDate = {};
    if (input.dataInicio) where.dueDate.gte = new Date(input.dataInicio);
    if (input.dataFim) where.dueDate.lte = new Date(input.dataFim + 'T23:59:59Z');
  }

  const entries = await db.financialEntry.findMany({
    where,
    take: input.limit || 10,
    orderBy: { dueDate: 'desc' },
    select: {
      code: true,
      description: true,
      type: true,
      status: true,
      grossCents: true,
      netCents: true,
      dueDate: true,
      partner: { select: { name: true } },
    },
  });

  return JSON.stringify({
    resultados: entries.map((e: any) => ({
      codigo: e.code,
      descricao: e.description,
      tipo: e.type === 'RECEIVABLE' ? 'A Receber' : 'A Pagar',
      status: e.status,
      valorBruto: `R$ ${(e.grossCents / 100).toFixed(2)}`,
      valorLiquido: `R$ ${(e.netCents / 100).toFixed(2)}`,
      vencimento: e.dueDate?.toISOString().split('T')[0],
      parceiro: e.partner?.name || null,
    })),
  });
}

async function searchTechnicians(db: any, input: Record<string, any>): Promise<string> {
  const where: any = { deletedAt: null, partnerTypes: { has: 'TECNICO' } };
  if (input.busca) {
    where.name = { contains: input.busca, mode: 'insensitive' };
  }

  const technicians = await db.partner.findMany({
    where,
    take: input.limit || 20,
    orderBy: { name: 'asc' },
    select: {
      name: true,
      phone: true,
      email: true,
      rating: true,
      regime: true,
      specializations: {
        select: { specialization: { select: { name: true } } },
      },
    },
  });

  return JSON.stringify({
    total: technicians.length,
    resultados: technicians.map((t: any) => ({
      nome: t.name,
      telefone: t.phone,
      email: t.email,
      avaliacao: t.rating ? `${t.rating.toFixed(1)} estrelas` : 'Sem avaliação',
      regime: t.regime || 'PJ',
      especializacoes: t.specializations?.map((s: any) => s.specialization?.name).filter(Boolean) || [],
    })),
  });
}

async function getCompanyInfo(db: any): Promise<string> {
  const company = await db.company.findFirst({
    select: {
      name: true,
      tradeName: true,
      cnpj: true,
      phone: true,
      email: true,
      city: true,
      state: true,
      maxOsPerMonth: true,
      maxUsers: true,
      fiscalEnabled: true,
      status: true,
      commissionBps: true,
    },
  });

  if (!company) return JSON.stringify({ error: 'Empresa não encontrada' });

  return JSON.stringify({
    nome: company.tradeName || company.name,
    razaoSocial: company.name,
    cnpj: company.cnpj,
    telefone: company.phone,
    email: company.email,
    cidade: company.city ? `${company.city}/${company.state}` : null,
    limiteOS: company.maxOsPerMonth === 0 ? 'Ilimitado' : `${company.maxOsPerMonth}/mês`,
    limiteUsuarios: company.maxUsers === 0 ? 'Ilimitado' : company.maxUsers,
    moduloFiscal: company.fiscalEnabled ? 'Habilitado' : 'Desabilitado',
  });
}

async function checkConfiguration(db: any, input: Record<string, any>): Promise<string> {
  const config = input.configuracao;

  switch (config) {
    case 'email': {
      const ec = await db.emailConfig.findFirst().catch(() => null);
      return JSON.stringify({
        configuracao: 'Email SMTP',
        status: ec?.isConnected ? 'Conectado' : 'Não configurado',
        detalhes: ec ? { servidor: ec.smtpHost, porta: ec.smtpPort, remetente: ec.fromEmail } : null,
        href: '/settings/email',
      });
    }
    case 'whatsapp': {
      const wa = await db.whatsAppConfig.findFirst().catch(() => null);
      return JSON.stringify({
        configuracao: 'WhatsApp Business',
        status: wa?.isConnected ? 'Conectado' : 'Não configurado',
        href: '/settings/whatsapp',
      });
    }
    case 'fiscal': {
      const company = await db.company.findFirst({ select: { fiscalEnabled: true, taxRegime: true } });
      const nfse = await db.nfseConfig.findFirst().catch(() => null);
      return JSON.stringify({
        configuracao: 'Módulo Fiscal / NFS-e',
        status: company?.fiscalEnabled ? 'Habilitado' : 'Desabilitado',
        detalhes: {
          regimeTributario: company?.taxRegime,
          focusNfe: nfse?.focusNfeToken ? 'Configurado' : 'Não configurado',
          ambiente: nfse?.focusNfeEnvironment || null,
        },
        href: '/settings/fiscal',
      });
    }
    case 'workflow': {
      const count = await db.workflowTemplate.count({ where: { deletedAt: null } });
      return JSON.stringify({
        configuracao: 'Fluxos de Atendimento',
        status: count > 0 ? `${count} template(s) criado(s)` : 'Nenhum template criado',
        href: '/workflow',
      });
    }
    case 'usuarios': {
      const count = await db.user.count({ where: { deletedAt: null } });
      const users = await db.user.findMany({
        where: { deletedAt: null },
        select: { name: true, email: true, roles: true },
        take: 10,
      });
      return JSON.stringify({
        configuracao: 'Usuários',
        total: count,
        usuarios: users.map((u: any) => ({ nome: u.name, email: u.email, perfis: u.roles })),
        href: '/users',
      });
    }
    case 'tecnicos': {
      const count = await db.partner.count({ where: { deletedAt: null, partnerTypes: { has: 'TECNICO' } } });
      return JSON.stringify({
        configuracao: 'Técnicos',
        total: count,
        status: count > 0 ? `${count} técnico(s) cadastrado(s)` : 'Nenhum técnico cadastrado',
        href: '/partners',
      });
    }
    case 'pagamento': {
      const count = await db.paymentMethod.count();
      return JSON.stringify({
        configuracao: 'Formas de Pagamento',
        total: count,
        status: count > 0 ? `${count} forma(s) cadastrada(s)` : 'Nenhuma forma cadastrada',
        href: '/finance',
      });
    }
    case 'automacao': {
      const count = await db.automationRule.count({ where: { isActive: true } });
      return JSON.stringify({
        configuracao: 'Automações',
        total: count,
        status: count > 0 ? `${count} regra(s) ativa(s)` : 'Nenhuma regra criada',
        href: '/automation',
      });
    }
    case 'push': {
      const pushCount = await db.pushSubscription.count().catch(() => 0);
      return JSON.stringify({
        configuracao: 'Notificações Push',
        total: pushCount,
        status: pushCount > 0 ? `${pushCount} dispositivo(s) inscrito(s)` : 'Nenhum dispositivo inscrito',
        href: '/notifications',
      });
    }
    default:
      return JSON.stringify({ error: `Configuração "${config}" não reconhecida` });
  }
}

// ── WhatsApp Configuration Tools ────────────────────────

async function configureWhatsApp(db: any, input: Record<string, any>): Promise<string> {
  const { accessToken, phoneNumberId, wabaId, appId } = input;

  if (!accessToken || !phoneNumberId) {
    return JSON.stringify({ error: 'Access Token e Phone Number ID são obrigatórios' });
  }

  if (!accessToken.startsWith('EAA')) {
    return JSON.stringify({ error: 'O Access Token deve começar com "EAA". Verifique se copiou o token completo do System User.' });
  }

  // Test connection first
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      const msg = error?.error?.message || `HTTP ${res.status}`;
      return JSON.stringify({
        success: false,
        error: `Teste de conexão falhou: ${msg}. Verifique se o Phone Number ID e o Access Token estão corretos.`,
      });
    }

    const data = await res.json();
    const displayName = data.verified_name || data.display_phone_number || 'Desconhecido';
    const phoneNumber = data.display_phone_number || '';

    // Encrypt token using shared helper (12-byte IV, matches EncryptionService)
    const encryptedToken = encryptToken(accessToken);
    const verifyToken = crypto.randomBytes(16).toString('hex');

    // Save config
    const company = await db.company.findFirst({ select: { id: true } });
    if (!company) {
      return JSON.stringify({ error: 'Empresa não encontrada' });
    }

    await db.whatsAppConfig.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        metaAccessToken: encryptedToken,
        metaPhoneNumberId: phoneNumberId,
        metaWabaId: wabaId || null,
        metaAppId: appId || null,
        metaVerifyToken: verifyToken,
        isConnected: true,
        connectedAt: new Date(),
      },
      update: {
        metaAccessToken: encryptedToken,
        metaPhoneNumberId: phoneNumberId,
        metaWabaId: wabaId || null,
        metaAppId: appId || null,
        isConnected: true,
        connectedAt: new Date(),
      },
    });

    const domain = process.env.DOMAIN || 'tecnikos.com.br';
    const webhookUrl = `https://${domain}/api/whatsapp/webhook/meta/${company.id}`;

    return JSON.stringify({
      success: true,
      message: `WhatsApp conectado com sucesso! Número: ${phoneNumber}, Nome: ${displayName}`,
      webhookUrl,
      verifyToken,
      proximosPasso: 'Agora configure o Webhook no Meta for Developers com a URL e Token acima, e crie os templates de mensagem (aviso_os e teste_conexao).',
    });
  } catch (err: any) {
    return JSON.stringify({
      success: false,
      error: `Erro ao conectar: ${err.message}. Verifique sua conexão e tente novamente.`,
    });
  }
}

async function testWhatsAppConnection(db: any): Promise<string> {
  const config = await db.whatsAppConfig.findFirst({
    select: { metaAccessToken: true, metaPhoneNumberId: true, metaWabaId: true, isConnected: true, metaVerifyToken: true },
  });

  if (!config) {
    return JSON.stringify({ status: 'Não configurado', message: 'WhatsApp ainda não foi configurado. Use a tool configurar_whatsapp ou acesse /settings/whatsapp.' });
  }

  if (!config.isConnected) {
    return JSON.stringify({ status: 'Desconectado', message: 'WhatsApp foi desconectado. Reconfigure em /settings/whatsapp.' });
  }

  try {
    let token: string;
    try {
      token = decryptToken(config.metaAccessToken);
    } catch {
      return JSON.stringify({ status: 'Erro', message: 'Token armazenado está corrompido. Reconfigure em /settings/whatsapp.' });
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${config.metaPhoneNumberId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      const msg = error?.error?.message || `HTTP ${res.status}`;
      return JSON.stringify({
        status: 'Erro',
        message: `Conexão falhou: ${msg}. O token pode ter expirado ou as permissões foram revogadas. Reconfigure em /settings/whatsapp.`,
      });
    }

    const data = await res.json();

    let templates: any[] = [];
    if (config.metaWabaId) {
      try {
        const tplRes = await fetch(`https://graph.facebook.com/v21.0/${config.metaWabaId}/message_templates?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tplData = await tplRes.json();
        templates = (tplData.data || []).map((t: any) => ({
          nome: t.name,
          status: t.status,
          categoria: t.category,
          idioma: t.language,
        }));
      } catch { /* ignore */ }
    }

    const domain = process.env.DOMAIN || 'tecnikos.com.br';
    const company = await db.company.findFirst({ select: { id: true } });

    return JSON.stringify({
      status: 'Conectado',
      numero: data.display_phone_number,
      nomeVerificado: data.verified_name,
      qualidade: data.quality_rating || 'N/A',
      templates: templates.length > 0 ? templates : 'Nenhum template encontrado. Crie os templates aviso_os e teste_conexao no WhatsApp Manager.',
      webhookUrl: company ? `https://${domain}/api/whatsapp/webhook/meta/${company.id}` : null,
      verifyToken: config.metaVerifyToken,
    });
  } catch (err: any) {
    return JSON.stringify({
      status: 'Erro',
      message: `Erro ao testar: ${err.message}`,
    });
  }
}

// ── Focus NFe Configuration Tools ───────────────────────

async function configureFocusNfe(db: any, input: Record<string, any>): Promise<string> {
  const { focusNfeToken, ...restInput } = input;

  if (!focusNfeToken) {
    return JSON.stringify({ error: 'Token da Focus NFe é obrigatório. Obtenha em app.focusnfe.com.br' });
  }

  // Check if fiscal module is enabled
  const company = await db.company.findFirst({ select: { id: true, fiscalEnabled: true } });
  if (!company) {
    return JSON.stringify({ error: 'Empresa não encontrada' });
  }

  if (!company.fiscalEnabled) {
    return JSON.stringify({
      error: 'O módulo fiscal não está habilitado. Ative-o primeiro em Configurações > Fiscal (/settings/fiscal) usando o toggle "Módulo Fiscal".',
      href: '/settings/fiscal',
    });
  }

  // Test token by calling Focus NFe API
  const env = input.focusNfeEnvironment || 'HOMOLOGATION';
  const baseUrl = env === 'PRODUCTION'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';

  try {
    const authHeader = 'Basic ' + Buffer.from(focusNfeToken + ':').toString('base64');
    const res = await fetch(`${baseUrl}/v2/nfse?limit=1`, {
      headers: { Authorization: authHeader },
    });

    if (res.status === 401 || res.status === 403) {
      return JSON.stringify({
        success: false,
        error: `Token inválido para o ambiente ${env === 'PRODUCTION' ? 'Produção' : 'Homologação'}. Verifique o token em app.focusnfe.com.br.`,
      });
    }

    // Encrypt token using shared helper (12-byte IV, matches EncryptionService)
    const encryptedToken = encryptToken(focusNfeToken);

    // Build update data - only include provided fields
    const configData: any = {
      focusNfeToken: encryptedToken,
      focusNfeEnvironment: env,
    };

    if (restInput.inscricaoMunicipal !== undefined) configData.inscricaoMunicipal = restInput.inscricaoMunicipal;
    if (restInput.codigoMunicipio !== undefined) configData.codigoMunicipio = restInput.codigoMunicipio;
    if (restInput.naturezaOperacao !== undefined) configData.naturezaOperacao = restInput.naturezaOperacao;
    if (restInput.optanteSimplesNacional !== undefined) configData.optanteSimplesNacional = restInput.optanteSimplesNacional;
    if (restInput.itemListaServico !== undefined) configData.itemListaServico = restInput.itemListaServico;
    if (restInput.codigoCnae !== undefined) configData.codigoCnae = restInput.codigoCnae;
    if (restInput.codigoTributarioMunicipio !== undefined) configData.codigoTributarioMunicipio = restInput.codigoTributarioMunicipio;
    if (restInput.aliquotaIss !== undefined) configData.aliquotaIss = restInput.aliquotaIss;
    if (restInput.nfseLayout !== undefined) configData.nfseLayout = restInput.nfseLayout;
    if (restInput.autoEmitOnEntry !== undefined) configData.autoEmitOnEntry = restInput.autoEmitOnEntry;

    await db.nfseConfig.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, ...configData },
      update: configData,
    });

    const pendingFields: string[] = [];
    if (!restInput.inscricaoMunicipal) pendingFields.push('Inscrição Municipal');
    if (!restInput.codigoMunicipio) pendingFields.push('Código do Município (IBGE)');
    if (!restInput.itemListaServico) pendingFields.push('Item Lista de Serviço');
    if (!restInput.aliquotaIss) pendingFields.push('Alíquota ISS');

    return JSON.stringify({
      success: true,
      message: `Focus NFe configurado com sucesso! Ambiente: ${env === 'PRODUCTION' ? 'Produção' : 'Homologação'}.`,
      camposPendentes: pendingFields.length > 0
        ? `Campos ainda não preenchidos (necessários para emissão): ${pendingFields.join(', ')}. Complete em /settings/fiscal.`
        : 'Todos os campos principais estão preenchidos.',
      dica: env === 'HOMOLOGATION'
        ? 'Você está em Homologação (testes). Quando estiver pronto, troque para Produção.'
        : 'Você está em Produção. NFS-e emitidas serão REAIS.',
    });
  } catch (err: any) {
    return JSON.stringify({
      success: false,
      error: `Erro ao configurar: ${err.message}`,
    });
  }
}

async function testFocusNfe(db: any): Promise<string> {
  const company = await db.company.findFirst({ select: { id: true, fiscalEnabled: true, taxRegime: true } });
  if (!company) {
    return JSON.stringify({ status: 'Erro', message: 'Empresa não encontrada' });
  }

  if (!company.fiscalEnabled) {
    return JSON.stringify({
      status: 'Desabilitado',
      message: 'O módulo fiscal não está habilitado. Ative em Configurações > Fiscal.',
      href: '/settings/fiscal',
    });
  }

  const config = await db.nfseConfig.findFirst().catch(() => null);
  if (!config) {
    return JSON.stringify({
      status: 'Não configurado',
      message: 'Configuração fiscal não encontrada. Configure em /settings/fiscal.',
      href: '/settings/fiscal',
    });
  }

  if (!config.focusNfeToken) {
    return JSON.stringify({
      status: 'Sem token',
      message: 'Token da Focus NFe não configurado. Obtenha em app.focusnfe.com.br e configure em /settings/fiscal.',
      href: '/settings/fiscal',
    });
  }

  // Decrypt and test token
  try {
    let token: string;
    try {
      token = decryptToken(config.focusNfeToken);
    } catch {
      return JSON.stringify({ status: 'Erro', message: 'Token armazenado está corrompido. Reconfigure em /settings/fiscal.' });
    }

    const baseUrl = config.focusNfeEnvironment === 'PRODUCTION'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    const authHeader = 'Basic ' + Buffer.from(token + ':').toString('base64');
    const res = await fetch(`${baseUrl}/v2/nfse?limit=1`, {
      headers: { Authorization: authHeader },
    });

    if (res.status === 401 || res.status === 403) {
      return JSON.stringify({
        status: 'Token inválido',
        message: 'O token da Focus NFe foi recusado. Pode ter expirado ou estar incorreto. Reconfigure em /settings/fiscal.',
      });
    }

    // Check completeness
    const missing: string[] = [];
    if (!config.inscricaoMunicipal) missing.push('Inscrição Municipal');
    if (!config.codigoMunicipio) missing.push('Código do Município');
    if (!config.itemListaServico) missing.push('Item Lista de Serviço');
    if (!config.aliquotaIss) missing.push('Alíquota ISS');
    if (!config.codigoCnae) missing.push('CNAE');

    return JSON.stringify({
      status: 'Conectado',
      ambiente: config.focusNfeEnvironment === 'PRODUCTION' ? 'Produção' : 'Homologação',
      layout: config.nfseLayout || 'MUNICIPAL',
      regimeTributario: company.taxRegime || 'Não definido',
      inscricaoMunicipal: config.inscricaoMunicipal || 'Não preenchido',
      codigoMunicipio: config.codigoMunicipio || 'Não preenchido',
      simplesNacional: config.optanteSimplesNacional ? 'Sim' : 'Não',
      aliquotaIss: config.aliquotaIss ? `${config.aliquotaIss}%` : 'Não definida',
      autoEmissao: config.autoEmitOnEntry ? 'Ativada' : 'Desativada',
      camposFaltando: missing.length > 0 ? missing : 'Nenhum — configuração completa!',
      dica: missing.length > 0
        ? `Complete os campos faltantes em /settings/fiscal para poder emitir NFS-e. O contador da empresa pode ajudar com os códigos tributários.`
        : config.focusNfeEnvironment === 'HOMOLOGATION'
          ? 'Tudo configurado! Faça um teste de emissão em Homologação antes de trocar para Produção.'
          : 'Tudo configurado e em Produção! Pronto para emitir NFS-e.',
    });
  } catch (err: any) {
    return JSON.stringify({
      status: 'Erro',
      message: `Erro ao testar: ${err.message}`,
    });
  }
}

// ── Wizard NFS-e Tools ──────────────────────────────────

async function checkFiscalComplete(db: any): Promise<string> {
  const company = await db.company.findFirst({
    select: { id: true, fiscalEnabled: true, taxRegime: true, cnpj: true, name: true, city: true, state: true },
  });

  if (!company) return JSON.stringify({ error: 'Empresa não encontrada' });

  const checklist: { item: string; status: string; valor?: string; acao?: string }[] = [];

  // Step 0: Módulo fiscal habilitado
  checklist.push({
    item: 'Módulo Fiscal habilitado',
    status: company.fiscalEnabled ? 'OK' : 'PENDENTE',
    acao: company.fiscalEnabled ? undefined : 'Ativar em /settings/fiscal → toggle "Módulo Fiscal"',
  });

  if (!company.fiscalEnabled) {
    return JSON.stringify({
      empresa: company.name,
      checklist,
      resumo: 'O módulo fiscal precisa ser habilitado primeiro.',
      proximoPasso: 'Peça ao cliente para ativar o módulo fiscal em Configurações > Fiscal.',
    });
  }

  const nfseConfig = await db.nfseConfig.findFirst().catch(() => null);
  const serviceCodeCount = await db.nfseServiceCode.count({ where: { active: true } }).catch(() => 0);

  // Step 1: Conta Focus NFe / Token
  const hasToken = !!(nfseConfig?.focusNfeToken || nfseConfig?.focusNfeTokenHomolog);
  checklist.push({
    item: 'Token Focus NFe',
    status: hasToken ? 'OK' : 'PENDENTE',
    valor: hasToken ? `Ambiente: ${nfseConfig?.focusNfeEnvironment === 'PRODUCTION' ? 'Produção' : 'Homologação'}` : undefined,
    acao: hasToken ? undefined : 'Criar conta em focusnfe.com.br → copiar token → colar em /settings/fiscal',
  });

  // Step 2: Código IBGE do município
  checklist.push({
    item: 'Código IBGE do Município',
    status: nfseConfig?.codigoMunicipio ? 'OK' : 'PENDENTE',
    valor: nfseConfig?.codigoMunicipio || undefined,
    acao: nfseConfig?.codigoMunicipio ? undefined : 'Informar a cidade da empresa para buscar o código IBGE automaticamente',
  });

  // Step 3: Inscrição Municipal
  checklist.push({
    item: 'Inscrição Municipal',
    status: nfseConfig?.inscricaoMunicipal ? 'OK' : 'PENDENTE',
    valor: nfseConfig?.inscricaoMunicipal || undefined,
    acao: nfseConfig?.inscricaoMunicipal ? undefined : 'Informar o número da Inscrição Municipal (fornecido pela prefeitura)',
  });

  // Step 4: Serviços habilitados
  checklist.push({
    item: 'Serviços NFS-e cadastrados',
    status: serviceCodeCount > 0 ? 'OK' : 'PENDENTE',
    valor: serviceCodeCount > 0 ? `${serviceCodeCount} serviço(s)` : undefined,
    acao: serviceCodeCount > 0 ? undefined : 'Cadastrar serviços em /settings/fiscal → aba "Serviços Habilitados"',
  });

  // Step 5: Alíquota ISS
  checklist.push({
    item: 'Alíquota ISS',
    status: nfseConfig?.aliquotaIss ? 'OK' : 'PENDENTE',
    valor: nfseConfig?.aliquotaIss ? `${nfseConfig.aliquotaIss}%` : undefined,
    acao: nfseConfig?.aliquotaIss ? undefined : 'Definir alíquota ISS (consultar contador ou prefeitura)',
  });

  // Step 6: Regime tributário
  checklist.push({
    item: 'Regime Tributário',
    status: company.taxRegime ? 'OK' : 'PENDENTE',
    valor: company.taxRegime || undefined,
    acao: company.taxRegime ? undefined : 'Selecionar regime em /settings/fiscal (Simples Nacional, Lucro Presumido ou Lucro Real)',
  });

  const okCount = checklist.filter((c) => c.status === 'OK').length;
  const total = checklist.length;
  const allOk = okCount === total;
  const nextPending = checklist.find((c) => c.status === 'PENDENTE');

  return JSON.stringify({
    empresa: company.name,
    cidade: company.city ? `${company.city}/${company.state}` : null,
    cnpj: company.cnpj,
    checklist,
    progresso: `${okCount}/${total}`,
    tudoConfigurado: allOk,
    proximoPasso: allOk
      ? 'Tudo configurado! Sugerir teste de emissão em homologação.'
      : `Próximo: ${nextPending?.item} — ${nextPending?.acao}`,
  });
}

async function searchMunicipioIbge(input: Record<string, any>): Promise<string> {
  const { municipio, uf } = input;
  if (!municipio) return JSON.stringify({ error: 'Informe o nome do município' });

  try {
    // Use IBGE API to search municipalities
    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`;
    const res = await fetch(url);
    if (!res.ok) {
      return JSON.stringify({ error: 'Erro ao consultar API do IBGE. Tente novamente.' });
    }

    const data: any[] = await res.json();

    // Filter by name (case-insensitive, partial match, accent-insensitive)
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const searchTerm = normalize(municipio);

    let results = data.filter((m: any) => {
      const name = normalize(m.nome);
      return name.includes(searchTerm);
    });

    // Filter by UF if provided
    if (uf) {
      const ufUpper = uf.toUpperCase();
      results = results.filter((m: any) => m.microrregiao?.mesorregiao?.UF?.sigla === ufUpper);
    }

    // Limit to 10 results
    const mapped = results.slice(0, 10).map((m: any) => ({
      nome: m.nome,
      uf: m.microrregiao?.mesorregiao?.UF?.sigla || '',
      codigoIbge: String(m.id),
    }));

    if (mapped.length === 0) {
      return JSON.stringify({
        resultados: [],
        mensagem: `Nenhum município encontrado com "${municipio}"${uf ? ` no estado ${uf}` : ''}. Verifique a grafia.`,
      });
    }

    return JSON.stringify({
      resultados: mapped,
      mensagem: mapped.length === 1
        ? `Encontrado: ${mapped[0].nome}/${mapped[0].uf} — código IBGE: ${mapped[0].codigoIbge}. Confirmar com o cliente antes de salvar.`
        : `Encontrados ${mapped.length} municípios. Pergunte ao cliente qual é o correto.`,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Erro ao buscar município: ${err.message}` });
  }
}

async function saveCodigoIbge(db: any, input: Record<string, any>): Promise<string> {
  const { codigoMunicipio, inscricaoMunicipal } = input;
  if (!codigoMunicipio || codigoMunicipio.length !== 7) {
    return JSON.stringify({ error: 'Código IBGE deve ter 7 dígitos' });
  }

  const company = await db.company.findFirst({ select: { id: true } });
  if (!company) return JSON.stringify({ error: 'Empresa não encontrada' });

  const updateData: any = { codigoMunicipio };
  if (inscricaoMunicipal) updateData.inscricaoMunicipal = inscricaoMunicipal;

  await db.nfseConfig.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id, ...updateData },
    update: updateData,
  });

  return JSON.stringify({
    success: true,
    message: `Código IBGE ${codigoMunicipio} salvo com sucesso!${inscricaoMunicipal ? ` Inscrição Municipal: ${inscricaoMunicipal}` : ''}`,
    proximoPasso: 'Verificar se serviços NFS-e estão cadastrados.',
  });
}

async function listServicosNfse(db: any): Promise<string> {
  const services = await db.nfseServiceCode.findMany({
    where: { active: true },
    orderBy: { cTribNac: 'asc' },
    select: {
      id: true,
      cTribNac: true,
      description: true,
      aliquotaIss: true,
    },
    take: 20,
  }).catch(() => []);

  if (services.length === 0) {
    return JSON.stringify({
      total: 0,
      servicos: [],
      mensagem: 'Nenhum serviço NFS-e cadastrado. Cadastre em /settings/fiscal → aba "Serviços Habilitados". Use a busca para encontrar o código tributário correto.',
      href: '/settings/fiscal',
    });
  }

  return JSON.stringify({
    total: services.length,
    servicos: services.map((s: any) => ({
      codigo: s.cTribNac,
      descricao: s.description,
      aliquotaIss: s.aliquotaIss ? `${s.aliquotaIss}%` : 'Usando padrão',
    })),
    mensagem: `${services.length} serviço(s) cadastrado(s).`,
  });
}

async function registerEmpresaFocus(db: any): Promise<string> {
  const resellerToken = await getResellerToken(db);
  if (!resellerToken) {
    return JSON.stringify({
      success: false,
      error: 'Token de revenda Focus NFe não configurado. Configure em Configurações do Admin.',
    });
  }

  const company = await db.company.findFirst({
    select: {
      id: true, name: true, tradeName: true, cnpj: true,
      addressStreet: true, addressNumber: true, addressComp: true,
      neighborhood: true, city: true, state: true, cep: true,
      phone: true, email: true, taxRegime: true, crt: true,
      fiscalEnabled: true,
    },
  });

  if (!company) return JSON.stringify({ success: false, error: 'Empresa não encontrada' });
  if (!company.cnpj) return JSON.stringify({ success: false, error: 'CNPJ da empresa não está cadastrado. Preencha em /settings.' });
  if (!company.fiscalEnabled) {
    return JSON.stringify({
      success: false,
      error: 'Módulo fiscal não habilitado. Ative em /settings/fiscal primeiro.',
      href: '/settings/fiscal',
    });
  }

  const config = await db.nfseConfig.findFirst().catch(() => null);
  const layout = config?.nfseLayout || 'MUNICIPAL';
  const environment = config?.focusNfeEnvironment || 'HOMOLOGATION';

  // Map taxRegime
  const regimeTrib = company.taxRegime === 'SN' ? (company.crt === 2 ? 2 : 1) : 3;

  const empresaData: any = {
    nome: company.name,
    nome_fantasia: company.tradeName || undefined,
    cnpj: company.cnpj.replace(/\D/g, ''),
    inscricao_municipal: config?.inscricaoMunicipal || undefined,
    regime_tributario: regimeTrib,
    logradouro: company.addressStreet || undefined,
    numero: company.addressNumber || undefined,
    complemento: company.addressComp || undefined,
    bairro: company.neighborhood || undefined,
    municipio: company.city || undefined,
    cep: company.cep?.replace(/\D/g, '') || undefined,
    uf: company.state || undefined,
    telefone: company.phone?.replace(/\D/g, '') || undefined,
    email: company.email || undefined,
    enviar_email_destinatario: config?.sendEmailToTomador ?? true,
  };

  if (layout === 'NACIONAL') {
    empresaData.habilita_nfsen_producao = environment === 'PRODUCTION';
    empresaData.habilita_nfsen_homologacao = environment === 'HOMOLOGATION';
  } else {
    empresaData.habilita_nfse = true;
  }

  // Remove undefined
  Object.keys(empresaData).forEach((k) => empresaData[k] === undefined && delete empresaData[k]);

  const baseUrl = environment === 'PRODUCTION'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
  const authHeader = 'Basic ' + Buffer.from(resellerToken + ':').toString('base64');

  try {
    // Check if exists
    const cleanCnpj = company.cnpj.replace(/\D/g, '');
    const checkRes = await fetch(`${baseUrl}/v2/empresas/${cleanCnpj}`, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    });

    let result: any;
    let action: string;

    if (checkRes.status === 404) {
      // Create
      const createRes = await fetch(`${baseUrl}/v2/empresas`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(empresaData),
      });
      result = await createRes.json().catch(() => null);
      if (!createRes.ok) {
        const msg = result?.erros?.[0]?.mensagem || result?.mensagem || `HTTP ${createRes.status}`;
        return JSON.stringify({ success: false, error: `Erro ao registrar: ${msg}` });
      }
      action = 'registrada';
    } else if (checkRes.ok) {
      // Update
      const updateRes = await fetch(`${baseUrl}/v2/empresas/${cleanCnpj}`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(empresaData),
      });
      result = await updateRes.json().catch(() => null);
      if (!updateRes.ok) {
        const msg = result?.erros?.[0]?.mensagem || result?.mensagem || `HTTP ${updateRes.status}`;
        return JSON.stringify({ success: false, error: `Erro ao atualizar: ${msg}` });
      }
      action = 'atualizada';
    } else {
      return JSON.stringify({ success: false, error: `Erro ao consultar Focus NFe: HTTP ${checkRes.status}` });
    }

    // Save tokens and companyId
    const updateData: any = { focusNfeCompanyId: String(result.id) };
    if (result.token_producao) updateData.focusNfeToken = encryptToken(result.token_producao);
    if (result.token_homologacao) updateData.focusNfeTokenHomolog = encryptToken(result.token_homologacao);

    await db.nfseConfig.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, ...updateData },
      update: updateData,
    });

    return JSON.stringify({
      success: true,
      message: `Empresa ${action} na Focus NFe com sucesso! (ID: ${result.id})`,
      focusNfeId: result.id,
      tokenProducao: !!result.token_producao,
      tokenHomologacao: !!result.token_homologacao,
      certificado: result.certificado_valido_ate
        ? `Válido até ${result.certificado_valido_ate}`
        : 'Nenhum certificado instalado — necessário para emissão em produção',
      proximoPasso: !result.certificado_valido_ate
        ? 'Para emitir notas reais, será necessário instalar o certificado digital e-CNPJ A1.'
        : 'Empresa pronta para emitir NFS-e!',
    });
  } catch (err: any) {
    return JSON.stringify({ success: false, error: `Erro: ${err.message}` });
  }
}

// ─── Push Notifications ───────────────────────────────────────────────

async function checkPushNotifications(db: any): Promise<string> {
  const totalSubscriptions = await db.pushSubscription.count().catch(() => 0);
  const users = await db.pushSubscription
    .findMany({
      select: { userId: true, deviceName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    .catch(() => []);

  // Check VAPID keys in SaasConfig (public schema)
  let vapidConfigured = false;
  try {
    const { PrismaClient } = require('@prisma/client');
    const publicDb = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const vapidRow = await publicDb.saasConfig.findUnique({ where: { key: 'VAPID_PUBLIC_KEY' } });
    await publicDb.$disconnect();
    vapidConfigured = !!vapidRow?.value;
  } catch {
    // ignore
  }

  return JSON.stringify({
    totalDispositivos: totalSubscriptions,
    vapidConfigurado: vapidConfigured,
    status: totalSubscriptions > 0 ? 'Ativo' : 'Nenhum dispositivo inscrito',
    dispositivos: users.map((u: any) => ({
      dispositivo: u.deviceName || 'Desconhecido',
      inscritoEm: u.createdAt,
    })),
    href: '/notifications',
    dica: totalSubscriptions === 0
      ? 'Para ativar: acesse Notificações e clique em "Ativar Push". O navegador vai solicitar permissão.'
      : `${totalSubscriptions} dispositivo(s) recebendo notificações push.`,
  });
}

// ─── NFS-e Imports ────────────────────────────────────────────────────

async function checkNfseImports(db: any): Promise<string> {
  const company = await db.company.findFirst({
    select: { id: true, maxNfseImports: true },
  });

  if (!company) return JSON.stringify({ error: 'Empresa não encontrada' });

  // Count imports this billing cycle
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const usedImports = await db.nfseEntrada
    .count({
      where: {
        companyId: company.id,
        importedAt: { not: null },
        createdAt: { gte: firstOfMonth },
      },
    })
    .catch(() => 0);

  // Fetch available add-on packages from public schema
  let availablePackages: any[] = [];
  try {
    const { PrismaClient } = require('@prisma/client');
    const publicDb = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    availablePackages = await publicDb.addOn.findMany({
      where: { isActive: true, nfseImportQuantity: { gt: 0 } },
      select: { id: true, name: true, nfseImportQuantity: true, priceCents: true },
      orderBy: { sortOrder: 'asc' },
    });
    await publicDb.$disconnect();
  } catch {
    // ignore
  }

  return JSON.stringify({
    maxImportacoes: company.maxNfseImports,
    usadasNoCiclo: usedImports,
    restantes: Math.max(0, company.maxNfseImports - usedImports),
    status: company.maxNfseImports === 0
      ? 'Sem créditos de importação automática'
      : `${usedImports}/${company.maxNfseImports} utilizadas no ciclo`,
    pacotesDisponiveis: availablePackages.map((p: any) => ({
      nome: p.name,
      quantidade: p.nfseImportQuantity,
      preco: `R$ ${(p.priceCents / 100).toFixed(2)}`,
    })),
    href: '/settings/billing?filter=nfse',
    dica: company.maxNfseImports === 0
      ? 'A importação manual é gratuita. Para importação automática via Focus NFe, adquira um pacote de créditos.'
      : `Você tem ${Math.max(0, company.maxNfseImports - usedImports)} importações restantes neste ciclo.`,
  });
}

// ─── Plano & Billing ─────────────────────────────────────────────────

async function checkPlanoBilling(db: any): Promise<string> {
  const company = await db.company.findFirst({
    select: {
      id: true,
      name: true,
      maxOsPerMonth: true,
      maxUsers: true,
      maxTechnicians: true,
      maxAiMessages: true,
      maxNfseImports: true,
    },
  });

  if (!company) return JSON.stringify({ error: 'Empresa não encontrada' });

  // Count current usage
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [osCount, userCount, techCount] = await Promise.all([
    db.serviceOrder.count({ where: { createdAt: { gte: firstOfMonth } } }).catch(() => 0),
    db.user.count({ where: { deletedAt: null } }).catch(() => 0),
    db.partner.count({ where: { deletedAt: null, partnerTypes: { has: 'TECNICO' } } }).catch(() => 0),
  ]);

  // Get plan/subscription from public schema
  let planInfo: any = null;
  let subscriptionInfo: any = null;
  let availablePlans: any[] = [];
  try {
    const { PrismaClient } = require('@prisma/client');
    const publicDb = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

    // Find tenant by company name match or by schema
    const tenants = await publicDb.tenant.findMany({
      where: { status: { in: ['ACTIVE', 'BLOCKED'] } },
      select: {
        id: true,
        companyName: true,
        planId: true,
        plan: { select: { id: true, name: true, priceCents: true, priceYearlyCents: true, maxUsers: true, maxOsPerMonth: true, maxTechnicians: true, maxAiMessages: true } },
        subscriptions: {
          where: { status: 'ACTIVE' },
          select: {
            billingCycle: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            nextBillingDate: true,
            pendingPlanId: true,
            promotionMonthsLeft: true,
            creditBalanceCents: true,
            addOnPurchases: {
              where: { status: 'ACTIVE' },
              select: { addOn: { select: { name: true } }, quantity: true, expiresAt: true },
            },
          },
          take: 1,
        },
      },
    });

    // Match by company name
    const tenant = tenants.find((t: any) => t.companyName === company.name) || tenants[0];
    if (tenant) {
      planInfo = tenant.plan;
      subscriptionInfo = tenant.subscriptions[0] || null;
    }

    // Available plans for upgrade
    availablePlans = await publicDb.plan.findMany({
      where: { isActive: true },
      select: { id: true, name: true, priceCents: true, maxOsPerMonth: true, maxUsers: true, maxTechnicians: true },
      orderBy: { sortOrder: 'asc' },
    });

    await publicDb.$disconnect();
  } catch {
    // ignore
  }

  return JSON.stringify({
    planoAtual: planInfo ? {
      nome: planInfo.name,
      precoMensal: `R$ ${(planInfo.priceCents / 100).toFixed(2)}`,
      precoAnual: planInfo.priceYearlyCents ? `R$ ${(planInfo.priceYearlyCents / 100).toFixed(2)}` : null,
    } : 'Não encontrado',
    limites: {
      os: company.maxOsPerMonth === 0 ? 'Ilimitado' : `${osCount}/${company.maxOsPerMonth} usadas`,
      usuarios: company.maxUsers === 0 ? 'Ilimitado' : `${userCount}/${company.maxUsers} ativos`,
      tecnicos: company.maxTechnicians === 0 ? 'Ilimitado' : `${techCount}/${company.maxTechnicians} cadastrados`,
      mensagensIA: company.maxAiMessages === 0 ? 'Ilimitado' : `${company.maxAiMessages}/mês`,
      importacoesNfse: company.maxNfseImports === 0 ? 'Nenhum (compre add-on)' : `${company.maxNfseImports}`,
    },
    assinatura: subscriptionInfo ? {
      ciclo: subscriptionInfo.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal',
      periodoAtual: `${new Date(subscriptionInfo.currentPeriodStart).toLocaleDateString('pt-BR')} a ${new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString('pt-BR')}`,
      proximaCobranca: new Date(subscriptionInfo.nextBillingDate).toLocaleDateString('pt-BR'),
      mudancaPendente: subscriptionInfo.pendingPlanId ? 'Sim (alteração agendada)' : 'Não',
      credito: subscriptionInfo.creditBalanceCents ? `R$ ${(subscriptionInfo.creditBalanceCents / 100).toFixed(2)}` : null,
      addOnsAtivos: subscriptionInfo.addOnPurchases?.map((a: any) => a.addOn.name) || [],
    } : null,
    planosDisponiveis: availablePlans
      .filter((p: any) => planInfo && p.id !== planInfo.id)
      .map((p: any) => ({
        nome: p.name,
        preco: `R$ ${(p.priceCents / 100).toFixed(2)}/mês`,
        limiteOS: p.maxOsPerMonth === 0 ? 'Ilimitado' : p.maxOsPerMonth,
        limiteUsuarios: p.maxUsers === 0 ? 'Ilimitado' : p.maxUsers,
      })),
    href: '/settings/billing',
  });
}
