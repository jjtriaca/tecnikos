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
      case 'configurar_whatsapp':
        return await configureWhatsApp(db, input);
      case 'testar_conexao_whatsapp':
        return await testWhatsAppConnection(db);
      case 'configurar_focus_nfe':
        return await configureFocusNfe(db, input);
      case 'testar_focus_nfe':
        return await testFocusNfe(db);
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

    // Encrypt token using same logic as EncryptionService
    const crypto = require('crypto');
    const envKey = process.env.ENCRYPTION_KEY;
    let key: Buffer;
    if (envKey) {
      key = Buffer.from(envKey, 'hex');
    } else {
      const secret = process.env.JWT_SECRET || 'tecnikos-default-secret';
      key = crypto.scryptSync(secret, 'tecnikos-salt', 32);
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(accessToken, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    const encryptedToken = `${iv.toString('base64')}:${authTag}:${encrypted}`;

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
    const crypto = require('crypto');
    const envKey = process.env.ENCRYPTION_KEY;
    let key: Buffer;
    if (envKey) {
      key = Buffer.from(envKey, 'hex');
    } else {
      const secret = process.env.JWT_SECRET || 'tecnikos-default-secret';
      key = crypto.scryptSync(secret, 'tecnikos-salt', 32);
    }

    const parts = config.metaAccessToken.split(':');
    if (parts.length !== 3) {
      return JSON.stringify({ status: 'Erro', message: 'Token armazenado está corrompido. Reconfigure em /settings/whatsapp.' });
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encData = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let token = decipher.update(encData, 'base64', 'utf8');
    token += decipher.final('utf8');

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

    // Encrypt token
    const crypto = require('crypto');
    const envKey = process.env.ENCRYPTION_KEY;
    let key: Buffer;
    if (envKey) {
      key = Buffer.from(envKey, 'hex');
    } else {
      const secret = process.env.JWT_SECRET || 'tecnikos-default-secret';
      key = crypto.scryptSync(secret, 'tecnikos-salt', 32);
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(focusNfeToken, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    const encryptedToken = `${iv.toString('base64')}:${authTag}:${encrypted}`;

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
    const crypto = require('crypto');
    const envKey = process.env.ENCRYPTION_KEY;
    let key: Buffer;
    if (envKey) {
      key = Buffer.from(envKey, 'hex');
    } else {
      const secret = process.env.JWT_SECRET || 'tecnikos-default-secret';
      key = crypto.scryptSync(secret, 'tecnikos-salt', 32);
    }

    const parts = config.focusNfeToken.split(':');
    if (parts.length !== 3) {
      return JSON.stringify({ status: 'Erro', message: 'Token armazenado está corrompido. Reconfigure em /settings/fiscal.' });
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encData = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let token = decipher.update(encData, 'base64', 'utf8');
    token += decipher.final('utf8');

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
