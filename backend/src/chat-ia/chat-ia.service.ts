import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConnectionService } from '../tenant/tenant-connection.service';
import { ChatIAOnboardingService, OnboardingStatus } from './chat-ia.onboarding';
import { CHAT_IA_TOOLS, executeTool } from './chat-ia.tools';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Você é o assistente IA do Tecnikos, um sistema de gestão de serviços técnicos (Field Service Management).

REGRAS FUNDAMENTAIS:
- Responda SEMPRE em português brasileiro, de forma objetiva e amigável
- Use as ferramentas disponíveis para consultar dados reais — NUNCA invente dados
- Se não souber ou não tiver a informação, diga claramente
- Seja conciso mas completo nas respostas
- Use formatação markdown quando apropriado (listas, negrito, etc)
- NUNCA invente funcionalidades que o sistema não tem. Se o usuário perguntar sobre algo que não existe, diga honestamente que ainda não foi implementado e que será considerado para versões futuras.

MÓDULOS E FUNCIONALIDADES QUE EXISTEM NO SISTEMA:
- **Ordens de Serviço (OS)**: Criar, editar, atribuir técnico, acompanhar status (Aberta > Ofertada > Atribuída > A Caminho > Em Execução > Concluída > Aprovada). Cada OS tem: cliente, descrição, endereço, técnico atribuído, valor, workflow de etapas.
- **Parceiros/Cadastros**: Clientes, fornecedores e técnicos. CRUD completo, importação via planilha (Sankhya).
- **Financeiro**: Lançamentos a receber e a pagar, repasses para técnicos. Status: Pendente, Confirmado, Pago, Cancelado.
- **Workflow**: Templates de etapas customizáveis para OS (ex: Abertura > Despacho > Execução > Conclusão).
- **Avaliações**: Avaliação de técnicos pelo gestor e pelo cliente.
- **Dashboard**: KPIs, gráficos, resumo de OS e financeiro.
- **Automação**: Regras automáticas (ex: auto-assign técnico, notificações).
- **Configurações**: Email SMTP, WhatsApp Business API, módulo fiscal/NFS-e, dispositivos.
- **Especialização de técnicos**: Categorias de habilidades dos técnicos.
- **Produtos/Serviços**: Cadastro de produtos e serviços com preços.
- **Agenda**: Visualização de OS por data.
- **Relatórios**: Relatórios de OS, técnicos, financeiro.
- **Contratos**: Geração de contratos com templates e variáveis.
- **Notificações**: Sistema de notificações internas.

FUNCIONALIDADES QUE NÃO EXISTEM AINDA:
- Orçamentos (cotações separadas da OS)
- Chat com cliente pelo sistema
- App mobile nativo para técnicos (existe versão web responsiva)
- Integração com marketplace de peças
- Controle de estoque/inventário
- Gestão de frotas/veículos

Se o usuário perguntar sobre algo que não está na lista acima, use as ferramentas para verificar antes de responder, e se não existir, seja honesto.

ONBOARDING (quando o sistema está sendo configurado pela primeira vez):
- Se o usuário está no onboarding, guie-o passo a passo pelas configurações
- Explique de forma simples o que cada configuração faz e por que é importante
- Quando uma configuração for concluída, parabenize e sugira a próxima
- Itens opcionais podem ser pulados — pergunte se quer configurar depois ou pular
- Use as action_buttons para direcionar o usuário às páginas corretas

ASSISTENTE DO DIA A DIA:
- Ajude com consultas sobre ordens de serviço, clientes, financeiro, técnicos
- Sugira ações baseadas nos dados (ex: "Você tem 3 OS atrasadas, quer ver quais são?")
- Explique APENAS funcionalidades que realmente existem no sistema
- Para dúvidas sobre como fazer algo no sistema, dê instruções passo a passo baseadas no que existe

IMPORTANTE:
- Os dados da empresa (CNPJ, razão social, endereço) vêm da Receita Federal e não podem ser editados manualmente. Para atualizar, o gestor deve usar a função de consulta por CNPJ.
- Nunca sugira editar manualmente dados que vêm do CNPJ.`;

const WIZARD_INSTRUCTIONS: Record<string, string> = {
  companyProfile: `Guie o usuário para completar o perfil da empresa em /settings:
- O nome e CNPJ já vêm da Receita Federal (não editáveis)
- Preencher: Telefone, CEP (busca automática de endereço), Número, Complemento
- Dados do responsável: nome, CPF, telefone, email
- Logo: fazer upload da logomarca (aparece nos contratos e relatórios)
- Comissão padrão: porcentagem que os técnicos recebem por OS
- Dica: O CEP busca o endereço automaticamente, só precisa preencher número e complemento
- Após preencher, clicar "Salvar Alterações"`,

  emailSmtp: `Guie o usuário para configurar email SMTP em /settings/email:
- Há PRESETS prontos: clique em "Gmail", "Outlook" ou "Yahoo" para preencher automaticamente
- Para Gmail: use smtp.gmail.com, porta 587. Se usar verificação em duas etapas, precisa criar uma "Senha de App" em myaccount.google.com > Segurança > Senhas de app
- Para Outlook/Hotmail: use smtp.office365.com, porta 587
- Para Zoho: use smtp.zoho.com, porta 587
- Campos: Host SMTP, Porta, Email remetente, Senha, Nome do remetente
- Após preencher, clicar "Testar Conexão" para verificar se funciona
- Se o teste passar, clicar "Salvar"
- Dica: pode enviar um email de teste para si mesmo clicando "Enviar teste"`,

  whatsapp: `Guie o usuário para configurar WhatsApp Business em /settings/whatsapp:
- Precisa de uma conta no Meta Business (business.facebook.com)
- Campos necessários:
  1. Phone Number ID: encontrado em Meta > WhatsApp > Configurações da API
  2. Access Token: token permanente do sistema no Meta Business
  3. App ID (opcional): para sincronizar logo do perfil
- Após preencher, clicar "Testar Conexão"
- IMPORTANTE: Configurar o Webhook no Meta:
  - URL do Webhook: será exibida após salvar (copiar e colar no Meta)
  - Token de Verificação: será exibido após salvar (copiar e colar no Meta)
  - Campos assinados: selecionar "messages"
- Se o usuário não tiver conta Meta Business, explique que precisa criar uma em business.facebook.com e registrar um número de telefone dedicado para WhatsApp Business API`,

  workflow: `Guie o usuário para criar um fluxo de atendimento em /workflow:
- Um workflow define as etapas que uma OS segue do início ao fim
- Clicar "Novo Template" para criar
- Dar um nome (ex: "Fluxo Padrão", "Manutenção Preventiva")
- Há PRESETS prontos (ex: "Padrão") que criam etapas básicas automaticamente
- Etapas típicas: Abertura > Despacho > Execução > Verificação > Conclusão
- Cada etapa pode ter ações do técnico (fotos, assinatura, checklist)
- Marcar como "Padrão" para que novas OS usem este workflow automaticamente
- Dica: comece com o preset "Padrão" e personalize depois`,

  users: `Guie o usuário para criar usuários em /users:
- Clicar "Novo Usuário"
- Campos: Nome, Email, Senha
- Perfis disponíveis (pode combinar):
  - ADMIN: acesso total ao sistema
  - DESPACHO: gerencia OS e atribuição de técnicos
  - FINANCEIRO: gerencia lançamentos e cobranças
  - FISCAL: acesso ao módulo NFS-e e configurações fiscais
  - LEITURA: acesso somente visualização (não combina com outros)
- Dica: crie pelo menos um usuário de Despacho para o dia a dia`,

  technicians: `Guie o usuário para cadastrar técnicos em /partners (aba Técnicos):
- Clicar "Novo Parceiro" e marcar como Técnico
- Campos obrigatórios: Nome, CPF/CNPJ, Telefone, Email
- Regime: CLT (funcionário) ou PJ (prestador de serviço)
- Especialização: selecionar áreas de atuação (ar condicionado, elétrica, hidráulica, etc)
- Comissão: porcentagem que o técnico recebe por OS (herda da empresa se não definir)
- Dica: se tiver planilha do Sankhya, pode importar técnicos em massa pelo botão "Importar"`,

  fiscal: `Guie o usuário para configurar o módulo fiscal/NFS-e em /settings/fiscal:
PASSO 1 - Habilitar o módulo fiscal:
- Ativar o toggle "Módulo Fiscal" no topo da página
- Selecionar Regime Tributário: Simples Nacional, Lucro Presumido ou Lucro Real
- Preencher CNAE principal (código de 7 dígitos da atividade)

PASSO 2 - Configurar Focus NFe (provedor de emissão):
- Obter token da Focus NFe em app.focusnfe.com.br (precisa criar conta)
- Colar o token no campo "Token Focus NFe"
- Selecionar ambiente: HOMOLOGAÇÃO (testes) ou PRODUÇÃO (emissão real)
- Layout: Municipal (ABRASF) para maioria das cidades ou Nacional (SPED)

PASSO 3 - Dados do Prestador:
- Inscrição Municipal (IM): número fornecido pela prefeitura
- Código do Município: código IBGE de 7 dígitos

PASSO 4 - Tributação:
- Natureza da Operação (1 a 6)
- Alíquota ISS (ex: 2%, 3%, 5%)
- Optante Simples Nacional (se aplicável)

PASSO 5 - Códigos de Serviço:
- Item Lista de Serviço (ex: 14.01 para manutenção)
- Código CNAE do serviço
- Código Tributário Municipal

PASSO 6 - Comportamento:
- Auto-emitir NFS-e ao criar lançamento a receber
- Perguntar ao finalizar OS
- Enviar NFS-e por email/WhatsApp ao tomador

Dica: comece em HOMOLOGAÇÃO para testar. Quando estiver OK, troque para PRODUÇÃO.
O contador da empresa pode ajudar com códigos fiscais (CNAE, item lista, alíquota).`,

  paymentMethods: `Guie o usuário para cadastrar formas de pagamento em /finance:
- Na página financeira, ir em configurações ou cadastrar diretamente
- Formas comuns: PIX, Cartão de Crédito, Cartão de Débito, Boleto, Dinheiro, Transferência
- Cada forma pode ter taxa percentual e taxa fixa
- Dica: PIX geralmente não tem taxa para recebimento`,

  automation: `Guie o usuário para criar regras de automação em /automation:
- Automações executam ações automaticamente baseadas em eventos
- Exemplos comuns:
  - Auto-assign: atribuir técnico automaticamente baseado em especialização e proximidade
  - Notificar cliente quando técnico está a caminho
  - Notificar gestor quando OS está atrasada
  - Enviar avaliação ao cliente após conclusão da OS
- Clicar "Nova Regra", definir gatilho (evento) e ação`,
};

export interface MessageResult {
  content: string;
  actionButtons?: { label: string; href: string; icon?: string }[];
  inputTokens?: number;
  outputTokens?: number;
  toolCalls?: any[];
}

@Injectable()
export class ChatIAService {
  private readonly logger = new Logger(ChatIAService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConnection: TenantConnectionService,
    private readonly onboarding: ChatIAOnboardingService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Anthropic SDK initialized');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — Chat IA disabled');
    }
  }

  get isConfigured(): boolean {
    return !!this.anthropic;
  }

  // ── Message Limits ─────────────────────────────────────

  async checkAndIncrementUsage(companyId: string, tenantSchema?: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
  }> {
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;
    const company = await db.company.findFirst({
      select: { chatIAMonthlyMsgs: true, chatIAMonthReset: true, maxOsPerMonth: true },
    });

    if (!company) return { allowed: false, used: 0, limit: 0 };

    // Determine limit from plan (stored in features or derived from maxOsPerMonth)
    // Essencial(100 OS) = 50 msgs, Profissional(250) = 200, Enterprise(600) = 800
    let limit = 50; // default
    if (company.maxOsPerMonth >= 600) limit = 800;
    else if (company.maxOsPerMonth >= 250) limit = 200;
    else if (company.maxOsPerMonth >= 100) limit = 50;

    // Reset monthly counter if needed
    const now = new Date();
    const resetDate = company.chatIAMonthReset;
    const needsReset = !resetDate || resetDate.getMonth() !== now.getMonth() || resetDate.getFullYear() !== now.getFullYear();

    let used = company.chatIAMonthlyMsgs;
    if (needsReset) {
      await db.company.updateMany({
        data: { chatIAMonthlyMsgs: 0, chatIAMonthReset: now },
      });
      used = 0;
    }

    if (used >= limit) {
      return { allowed: false, used, limit };
    }

    // Increment
    await db.company.updateMany({
      data: { chatIAMonthlyMsgs: used + 1 },
    });

    return { allowed: true, used: used + 1, limit };
  }

  async getUsage(companyId: string, tenantSchema?: string): Promise<{ used: number; limit: number }> {
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;
    const company = await db.company.findFirst({
      select: { chatIAMonthlyMsgs: true, chatIAMonthReset: true, maxOsPerMonth: true },
    });

    if (!company) return { used: 0, limit: 50 };

    let limit = 50;
    if (company.maxOsPerMonth >= 600) limit = 800;
    else if (company.maxOsPerMonth >= 250) limit = 200;

    // Check if needs reset
    const now = new Date();
    const resetDate = company.chatIAMonthReset;
    const needsReset = !resetDate || resetDate.getMonth() !== now.getMonth() || resetDate.getFullYear() !== now.getFullYear();

    return { used: needsReset ? 0 : company.chatIAMonthlyMsgs, limit };
  }

  // ── Conversations ──────────────────────────────────────

  async getOrCreateConversation(
    companyId: string,
    userId: string,
    conversationId?: string,
    tenantSchema?: string,
  ) {
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;

    if (conversationId) {
      const conv = await db.chatIAConversation.findUnique({
        where: { id: conversationId },
      });
      if (conv && conv.companyId === companyId) return conv;
    }

    // Create new conversation
    return db.chatIAConversation.create({
      data: {
        companyId,
        userId,
        status: 'ACTIVE',
      },
    });
  }

  async listConversations(companyId: string, userId: string, tenantSchema?: string) {
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;
    return db.chatIAConversation.findMany({
      where: { companyId, userId, status: 'ACTIVE' },
      orderBy: { lastMessageAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        isOnboarding: true,
        messageCount: true,
        lastMessageAt: true,
        createdAt: true,
      },
    });
  }

  async getMessages(conversationId: string, companyId: string, tenantSchema?: string) {
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;

    // Verify ownership
    const conv = await db.chatIAConversation.findUnique({
      where: { id: conversationId },
      select: { companyId: true },
    });
    if (!conv || conv.companyId !== companyId) return [];

    return db.chatIAMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        actionButtons: true,
        createdAt: true,
      },
    });
  }

  async archiveConversation(conversationId: string, companyId: string, tenantSchema?: string) {
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;
    const conv = await db.chatIAConversation.findUnique({
      where: { id: conversationId },
      select: { companyId: true },
    });
    if (!conv || conv.companyId !== companyId) return null;

    return db.chatIAConversation.update({
      where: { id: conversationId },
      data: { status: 'ARCHIVED' },
    });
  }

  // ── Send Message ───────────────────────────────────────

  async sendMessage(
    companyId: string,
    userId: string,
    content: string,
    conversationId?: string,
    tenantSchema?: string,
  ): Promise<{ conversationId: string; message: MessageResult }> {
    if (!this.anthropic) {
      throw new ForbiddenException('Assistente IA não configurado (ANTHROPIC_API_KEY)');
    }

    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;

    // Check usage limit
    const usage = await this.checkAndIncrementUsage(companyId, tenantSchema);
    if (!usage.allowed) {
      return {
        conversationId: conversationId || '',
        message: {
          content: `Você atingiu o limite de **${usage.limit} mensagens** este mês. O contador será resetado no início do próximo mês.\n\nPara aumentar seu limite, considere fazer upgrade do plano.`,
          actionButtons: [{ label: 'Ver Planos', href: '/settings/billing', icon: 'upgrade' }],
        },
      };
    }

    // Get or create conversation
    const conversation = await this.getOrCreateConversation(companyId, userId, conversationId, tenantSchema);

    // Save user message
    await db.chatIAMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content,
      },
    });

    // Load conversation history (last 20 messages for context)
    const history = await db.chatIAMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    // Build messages for Claude
    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Get onboarding context
    const onboardingStatus = await this.onboarding.getStatus(companyId, tenantSchema);
    const contextPrefix = this.buildContextPrefix(onboardingStatus, usage);

    // Call Claude with tools
    const result = await this.callClaude(messages, contextPrefix, db);

    // Detect action buttons from response
    const actionButtons = this.extractActionButtons(result.content, onboardingStatus);

    // Save assistant message
    await db.chatIAMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: result.content,
        actionButtons: actionButtons.length > 0 ? actionButtons : undefined,
        toolCalls: result.toolCalls?.length ? result.toolCalls : undefined,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });

    // Update conversation metadata
    const updateData: any = {
      lastMessageAt: new Date(),
      messageCount: { increment: 2 }, // user + assistant
    };

    // Auto-generate title from first user message
    if (!conversation.title && content.length > 3) {
      updateData.title = content.length > 60 ? content.substring(0, 57) + '...' : content;
    }

    await db.chatIAConversation.update({
      where: { id: conversation.id },
      data: updateData,
    });

    return {
      conversationId: conversation.id,
      message: {
        content: result.content,
        actionButtons: actionButtons.length > 0 ? actionButtons : undefined,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    };
  }

  // ── Welcome Message ────────────────────────────────────

  async getWelcomeMessage(companyId: string, tenantSchema?: string, tenantStatus?: string): Promise<MessageResult> {
    const onboardingStatus = await this.onboarding.getStatus(companyId, tenantSchema);
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;
    const company = await db.company.findFirst({ select: { tradeName: true, name: true } });
    const companyName = company?.tradeName || company?.name || 'sua empresa';

    if (!onboardingStatus.requiredDone) {
      // New company — onboarding mode
      const done = onboardingStatus.items.filter((i) => i.done);
      const pending = onboardingStatus.items.filter((i) => !i.done && !i.optional);
      const optional = onboardingStatus.items.filter((i) => !i.done && i.optional);
      const total = onboardingStatus.items.length;
      const pct = Math.round((done.length / total) * 100);

      let content = `Olá! 👋 Bem-vindo ao **Tecnikos**!\n\n`;
      content += `Sou seu assistente e vou te guiar na configuração do sistema para a **${companyName}**.\n\n`;

      // Show verification status notice if tenant is pending
      if (tenantStatus === 'PENDING_VERIFICATION') {
        content += `⏳ **Seus documentos estão em análise.** Enquanto aguarda a validação, algumas funcionalidades como Ordens de Serviço, Financeiro e Orçamentos estarão temporariamente bloqueadas. Mas não se preocupe — você já pode ir configurando o sistema!\n\n`;
      }

      // Progress bar
      const filled = Math.round(pct / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      content += `**Progresso:** ${bar} ${pct}% (${done.length}/${total})\n\n`;

      // Checklist - done items first
      if (done.length > 0) {
        done.forEach((item) => {
          content += `✅ ~~${item.label}~~\n`;
        });
      }

      // Pending required items
      content += `\n**Pendentes** (${pending.length}):\n`;
      pending.forEach((item, i) => {
        const marker = i === 0 ? '👉' : '⬜';
        content += `${marker} **${item.label}** — ${item.description}\n`;
      });

      // Optional items
      if (optional.length > 0) {
        content += `\n**Opcionais** (configura quando quiser):\n`;
        optional.forEach((item) => {
          content += `⬜ ${item.label} — ${item.description}\n`;
        });
      }

      const firstPending = pending[0];
      content += `\nVamos começar ${firstPending ? `pela **${firstPending.label}**` : ''}? Clique no botão abaixo ou me pergunte qualquer dúvida!`;

      const actionButtons = firstPending
        ? [{ label: `Configurar ${firstPending.label}`, href: firstPending.href, icon: 'settings' }]
        : [];

      return { content, actionButtons };
    }

    // All required done — normal assistant mode
    return {
      content: `Olá! 👋 Como posso ajudar a **${companyName}** hoje?\n\nPosso consultar suas ordens de serviço, clientes, financeiro, ou ajudar com qualquer dúvida sobre o sistema.`,
    };
  }

  // ── Stream Message ────────────────────────────────────

  async sendMessageStream(
    companyId: string,
    userId: string,
    content: string,
    conversationId: string | undefined,
    tenantSchema: string | undefined,
    emit: (event: string, data: any) => void,
  ): Promise<void> {
    if (!this.anthropic) {
      emit('error', { message: 'Assistente IA não configurado' });
      return;
    }

    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;

    // Check usage limit
    const usage = await this.checkAndIncrementUsage(companyId, tenantSchema);
    if (!usage.allowed) {
      emit('delta', { text: `Você atingiu o limite de **${usage.limit} mensagens** este mês. O contador será resetado no início do próximo mês.` });
      emit('buttons', { buttons: [{ label: 'Ver Planos', href: '/settings/billing', icon: 'upgrade' }] });
      emit('done', { conversationId: conversationId || '' });
      return;
    }

    // Get or create conversation
    const conversation = await this.getOrCreateConversation(companyId, userId, conversationId, tenantSchema);

    // Save user message
    await db.chatIAMessage.create({
      data: { conversationId: conversation.id, role: 'user', content },
    });

    // Load history
    const history = await db.chatIAMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Get onboarding context
    const onboardingStatus = await this.onboarding.getStatus(companyId, tenantSchema);
    const contextPrefix = this.buildContextPrefix(onboardingStatus, usage);

    // Stream response
    let result: MessageResult;
    try {
      result = await this.streamClaude(messages, contextPrefix, db, emit);
    } catch (err: any) {
      this.logger.error('Stream error', err?.message);
      emit('error', { message: 'Erro ao processar mensagem. Tente novamente.' });
      return;
    }

    // Extract action buttons
    const actionButtons = this.extractActionButtons(result.content, onboardingStatus);
    if (actionButtons.length > 0) {
      emit('buttons', { buttons: actionButtons });
    }

    // Save assistant message
    await db.chatIAMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: result.content,
        actionButtons: actionButtons.length > 0 ? actionButtons : undefined,
        toolCalls: result.toolCalls?.length ? result.toolCalls : undefined,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });

    // Update conversation metadata
    const updateData: any = {
      lastMessageAt: new Date(),
      messageCount: { increment: 2 },
    };
    if (!conversation.title && content.length > 3) {
      updateData.title = content.length > 60 ? content.substring(0, 57) + '...' : content;
    }
    await db.chatIAConversation.update({
      where: { id: conversation.id },
      data: updateData,
    });

    emit('done', { conversationId: conversation.id });
  }

  private async streamClaude(
    messages: Anthropic.MessageParam[],
    contextPrefix: string,
    db: any,
    emit: (event: string, data: any) => void,
  ): Promise<MessageResult> {
    const model = process.env.CHAT_IA_MODEL || 'claude-haiku-4-5-20251001';
    const maxTokens = parseInt(process.env.CHAT_IA_MAX_TOKENS || '2048', 10);
    const systemPrompt = SYSTEM_PROMPT + '\n\n' + contextPrefix;
    const allToolCalls: any[] = [];
    let currentMessages = [...messages];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let fullContent = '';
    let iterations = 0;

    while (iterations < 6) {
      iterations++;

      const stream = await this.anthropic!.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: currentMessages,
        tools: CHAT_IA_TOOLS as any,
        stream: true,
      });

      let streamText = '';
      const toolUseBlocks: any[] = [];
      let currentToolInput = '';
      let currentToolName = '';
      let currentToolId = '';
      let stopReason = '';

      for await (const event of stream as any) {
        switch (event.type) {
          case 'message_start':
            totalInputTokens += event.message?.usage?.input_tokens || 0;
            break;
          case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
              currentToolName = event.content_block.name;
              currentToolId = event.content_block.id;
              currentToolInput = '';
            }
            break;
          case 'content_block_delta':
            if (event.delta?.type === 'text_delta') {
              streamText += event.delta.text;
              emit('delta', { text: event.delta.text });
            } else if (event.delta?.type === 'input_json_delta') {
              currentToolInput += event.delta.partial_json;
            }
            break;
          case 'content_block_stop':
            if (currentToolName) {
              try {
                toolUseBlocks.push({
                  type: 'tool_use',
                  id: currentToolId,
                  name: currentToolName,
                  input: JSON.parse(currentToolInput || '{}'),
                });
              } catch { /* ignore parse error */ }
              currentToolName = '';
            }
            break;
          case 'message_delta':
            stopReason = event.delta?.stop_reason || '';
            totalOutputTokens += event.usage?.output_tokens || 0;
            break;
        }
      }

      fullContent += streamText;

      // If no tool use, we're done
      if (stopReason !== 'tool_use' || toolUseBlocks.length === 0) {
        break;
      }

      // Execute tools
      emit('thinking', { message: 'Consultando dados...' });
      const toolResults: any[] = [];
      for (const block of toolUseBlocks) {
        this.logger.log(`Tool call: ${block.name}`);
        allToolCalls.push({ name: block.name, input: block.input });
        const result = await executeTool(db, block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }

      // Build continuation messages
      const assistantContent: any[] = [];
      if (streamText) {
        assistantContent.push({ type: 'text', text: streamText });
      }
      assistantContent.push(...toolUseBlocks);

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: assistantContent },
        { role: 'user' as const, content: toolResults },
      ];
    }

    return {
      content: fullContent,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    };
  }

  // ── Private ────────────────────────────────────────────

  private buildContextPrefix(onboarding: OnboardingStatus, usage: { used: number; limit: number }): string {
    let ctx = `[Contexto atual: ${usage.used}/${usage.limit} mensagens usadas este mês]\n`;

    if (!onboarding.requiredDone) {
      const pending = onboarding.items.filter((i) => !i.done && !i.optional);
      const optional = onboarding.items.filter((i) => !i.done && i.optional);
      ctx += `[ONBOARDING: ${onboarding.completedCount}/${onboarding.items.length} configurações feitas]\n`;
      ctx += `[Pendentes obrigatórias: ${pending.map((i) => i.label).join(', ')}]\n`;
      if (optional.length > 0) {
        ctx += `[Opcionais: ${optional.map((i) => i.label).join(', ')}]\n`;
      }

      // Inject wizard-specific instructions for the next pending item
      const nextPending = pending[0];
      if (nextPending) {
        const wizardInstructions = WIZARD_INSTRUCTIONS[nextPending.key];
        if (wizardInstructions) {
          ctx += `\n[WIZARD ATIVO: ${nextPending.label}]\n${wizardInstructions}\n`;
        }
      }

      ctx += `[Após o usuário configurar, use a tool verificar_configuracao para confirmar que ficou OK e celebre!]\n`;
    }

    return ctx;
  }

  private async callClaude(
    messages: Anthropic.MessageParam[],
    contextPrefix: string,
    db: any,
  ): Promise<MessageResult> {
    const model = process.env.CHAT_IA_MODEL || 'claude-haiku-4-5-20251001';
    const maxTokens = parseInt(process.env.CHAT_IA_MAX_TOKENS || '2048', 10);
    const allToolCalls: any[] = [];

    let response = await this.anthropic!.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT + '\n\n' + contextPrefix,
      messages,
      tools: CHAT_IA_TOOLS as any,
    });

    // Handle tool use loop (max 5 iterations)
    let iterations = 0;
    while (response.stop_reason === 'tool_use' && iterations < 5) {
      iterations++;
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const toolResults: Anthropic.MessageParam = {
        role: 'user',
        content: [],
      };

      for (const block of toolUseBlocks) {
        if (block.type !== 'tool_use') continue;
        this.logger.log(`Tool call: ${block.name} — ${JSON.stringify(block.input).substring(0, 100)}`);
        allToolCalls.push({ name: block.name, input: block.input });

        const result = await executeTool(db, block.name, block.input as Record<string, any>);
        (toolResults.content as any[]).push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }

      // Continue conversation with tool results
      const updatedMessages = [
        ...messages,
        { role: 'assistant' as const, content: response.content },
        toolResults,
      ];

      response = await this.anthropic!.messages.create({
        model,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT + '\n\n' + contextPrefix,
        messages: updatedMessages,
        tools: CHAT_IA_TOOLS as any,
      });
    }

    // Extract text content
    const textBlocks = response.content.filter((b) => b.type === 'text');
    const content = textBlocks.map((b) => (b as any).text).join('\n');

    return {
      content,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    };
  }

  private extractActionButtons(
    content: string,
    onboarding: OnboardingStatus,
  ): { label: string; href: string; icon?: string }[] {
    const buttons: { label: string; href: string; icon?: string }[] = [];

    // If onboarding, suggest next pending item
    if (!onboarding.requiredDone) {
      const nextPending = onboarding.items.find((i) => !i.done && !i.optional);
      if (nextPending) {
        buttons.push({
          label: `Configurar ${nextPending.label}`,
          href: nextPending.href,
          icon: 'settings',
        });
      }
    }

    // Detect page references in content
    const pagePatterns = [
      { pattern: /configur(?:ar|e|ação de) email/i, label: 'Abrir Config Email', href: '/settings/email' },
      { pattern: /configur(?:ar|e|ação de) whatsapp/i, label: 'Abrir Config WhatsApp', href: '/settings/whatsapp' },
      { pattern: /fluxo de atendimento|workflow|template/i, label: 'Abrir Workflows', href: '/workflow' },
      { pattern: /cadastr(?:ar|o de) técnico/i, label: 'Abrir Técnicos', href: '/partners' },
      { pattern: /módulo fiscal|nfs-?e/i, label: 'Abrir Config Fiscal', href: '/settings/fiscal' },
      { pattern: /ordens? de serviço|lista de OS/i, label: 'Ver Ordens de Serviço', href: '/orders' },
      { pattern: /financeiro|lançamentos/i, label: 'Ver Financeiro', href: '/finance' },
    ];

    for (const { pattern, label, href } of pagePatterns) {
      if (pattern.test(content) && !buttons.some((b) => b.href === href)) {
        buttons.push({ label, href });
      }
    }

    return buttons.slice(0, 3); // Max 3 buttons
  }
}
