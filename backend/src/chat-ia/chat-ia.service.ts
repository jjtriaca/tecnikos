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

ONBOARDING (quando o sistema está sendo configurado pela primeira vez):
- Se o usuário está no onboarding, guie-o passo a passo pelas configurações
- Explique de forma simples o que cada configuração faz e por que é importante
- Quando uma configuração for concluída, parabenize e sugira a próxima
- Itens opcionais podem ser pulados — pergunte se quer configurar depois ou pular
- Use as action_buttons para direcionar o usuário às páginas corretas

ASSISTENTE DO DIA A DIA:
- Ajude com consultas sobre ordens de serviço, clientes, financeiro, técnicos
- Sugira ações baseadas nos dados (ex: "Você tem 3 OS atrasadas, quer ver quais são?")
- Explique funcionalidades do sistema quando perguntado
- Para dúvidas sobre como fazer algo no sistema, dê instruções passo a passo

IMPORTANTE:
- Os dados da empresa (CNPJ, razão social, endereço) vêm da Receita Federal e não podem ser editados manualmente. Para atualizar, o gestor deve usar a função de consulta por CNPJ.
- Nunca sugira editar manualmente dados que vêm do CNPJ.`;

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

  async getWelcomeMessage(companyId: string, tenantSchema?: string): Promise<MessageResult> {
    const onboardingStatus = await this.onboarding.getStatus(companyId, tenantSchema);
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;
    const company = await db.company.findFirst({ select: { tradeName: true, name: true } });
    const companyName = company?.tradeName || company?.name || 'sua empresa';

    if (!onboardingStatus.requiredDone) {
      // New company — onboarding mode
      const pending = onboardingStatus.items.filter((i) => !i.done && !i.optional);
      const optional = onboardingStatus.items.filter((i) => !i.done && i.optional);

      let content = `Olá! 👋 Bem-vindo ao **Tecnikos**!\n\nSou seu assistente e vou te ajudar a configurar o sistema para a **${companyName}**.\n\n`;
      content += `**Configurações necessárias** (${pending.length} pendentes):\n`;
      pending.forEach((item, i) => {
        content += `${i + 1}. ${item.done ? '✅' : '⬜'} **${item.label}** — ${item.description}\n`;
      });

      if (optional.length > 0) {
        content += `\n**Opcionais** (podem ser configurados depois):\n`;
        optional.forEach((item) => {
          content += `- ⬜ ${item.label} — ${item.description}\n`;
        });
      }

      content += `\nVamos começar? Clique no botão abaixo para configurar o primeiro item, ou me pergunte qualquer dúvida!`;

      const firstPending = pending[0];
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

  // ── Private ────────────────────────────────────────────

  private buildContextPrefix(onboarding: OnboardingStatus, usage: { used: number; limit: number }): string {
    let ctx = `[Contexto atual: ${usage.used}/${usage.limit} mensagens usadas este mês]\n`;

    if (!onboarding.requiredDone) {
      const pending = onboarding.items.filter((i) => !i.done && !i.optional);
      ctx += `[ONBOARDING: ${onboarding.completedCount}/${onboarding.items.length} configurações feitas. `;
      ctx += `Pendentes obrigatórias: ${pending.map((i) => i.label).join(', ')}]\n`;
      ctx += `[Guie o usuário para configurar as pendências. Use action_buttons para direcionar às páginas.]\n`;
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
