/**
 * Tool definitions for Claude — context-aware queries on tenant data.
 * Uses `any` for db param since queries run on dynamic tenant schemas.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
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
          enum: ['email', 'whatsapp', 'fiscal', 'workflow', 'usuarios', 'tecnicos', 'pagamento', 'automacao'],
        },
      },
      required: ['configuracao'],
    },
  },
];

/**
 * Execute a tool call against the tenant database.
 */
export async function executeTool(
  db: any,
  toolName: string,
  input: Record<string, any>,
): Promise<string> {
  try {
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
    comissaoPadrao: `${(company.commissionBps / 100).toFixed(1)}%`,
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
    default:
      return JSON.stringify({ error: `Configuração "${config}" não reconhecida` });
  }
}
