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
- **Configurações**: Email SMTP, WhatsApp Business API (Meta Cloud API), módulo fiscal/NFS-e, dispositivos.
- **Especialização de técnicos**: Categorias de habilidades dos técnicos.
- **Produtos/Serviços**: Cadastro de produtos e serviços com preços.
- **Agenda**: Visualização de OS por data.
- **Relatórios**: Relatórios de OS, técnicos, financeiro.
- **Contratos**: Geração de contratos com templates e variáveis.
- **Notificações**: Sistema de notificações internas.
- **Orçamentos**: Módulo completo de orçamentos (cotações) com itens, PDF, envio ao cliente via link público, aprovação/rejeição online, criação de OS a partir do orçamento aprovado. Gatilho "Um orçamento é criado" disponível no Fluxo de Atendimento para disparar notificações automáticas.

FUNCIONALIDADES QUE NÃO EXISTEM AINDA:
- Chat com cliente pelo sistema
- App mobile nativo para técnicos (existe versão web responsiva)
- Integração com marketplace de peças
- Controle de estoque/inventário
- Gestão de frotas/veículos

Se o usuário perguntar sobre algo que não está na lista acima, use as ferramentas para verificar antes de responder, e se não existir, seja honesto.

CONHECIMENTO WHATSAPP BUSINESS API (use ao ajudar com configuração):
- O Tecnikos usa a Meta Cloud API (WhatsApp Business Platform) para enviar notificações
- Mensagens business-initiated (sistema notifica cliente/técnico) SEMPRE usam templates aprovados
- Templates devem ser categoria UTILITY para notificações transacionais
- NUNCA enviar texto livre fora da janela de 24h — viola a política e causa ban
- Exemplos de templates devem ser descritivos e humanos (NUNCA UUIDs, hashes ou códigos técnicos)
- Para configurar: o cliente precisa de conta Meta Business verificada, app no Meta for Developers, System User com token permanente
- Use as tools configurar_whatsapp e testar_conexao_whatsapp para ajudar na configuração
- Se a conta for restrita/desativada: orientar o cliente a contatar o suporte Meta imediatamente e PARAR todos os envios
- Templates obrigatórios: aviso_os (notificações de OS) e teste_conexao (teste de configuração)

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

WIZARDS (ativados por trigger ou detecção proativa):

SETUP WIZARD (wizard mestre de configuração inicial):
- Triggers: "como começar", "configurar sistema", "setup inicial", "primeiro acesso", "o que preciso configurar", "como usar o sistema"
- Use a tool verificar_configuracao para cada item e identifique o que falta
- Guie sequencialmente pelos items incompletos: Perfil > Email > WhatsApp > Workflow > Usuários > Técnicos > Push > Pagamento > Automação > Fiscal
- A cada step concluído, revalide com verificar_configuracao e passe ao próximo pendente
- Items opcionais (Push, Pagamento, Automação): pergunte se quer configurar ou pular
- Siga as instruções detalhadas do WIZARD para cada item

WIZARD NFS-e (configuração fiscal):
- Triggers: "Como configurar NFS-e?", "configurar nota fiscal", "emitir nota", "configuração fiscal"
- Use a tool verificar_fiscal_completo para saber o estado atual e guiar passo a passo
- O wizard tem 7 steps: Registro Focus NFe → Certificado → Dados Municipais → Serviços → Tributação → Validação → Teste
- Siga as instruções detalhadas do WIZARD quando ele estiver ativo

WIZARD PUSH NOTIFICATIONS:
- Triggers: "push", "notificações push", "alertas navegador", "notificação desktop", "ativar notificações"
- Use a tool verificar_push_notifications para checar o estado atual
- Siga as instruções do WIZARD pushNotifications

WIZARD IMPORTAÇÃO NFS-e:
- Triggers: "importar nfse", "importação automática", "pacotes nfse", "créditos importação", "notas recebidas"
- Use a tool verificar_nfse_imports para checar saldo e pacotes
- Siga as instruções do WIZARD nfseImports

WIZARD BILLING/PLANOS:
- Triggers: "meu plano", "upgrade", "mudar plano", "limites", "billing", "faturamento", "quanto pago", "add-on"
- Use a tool verificar_plano_billing para obter dados atualizados
- Siga as instruções do WIZARD billing

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

  whatsapp: `Guie o usuário para configurar WhatsApp Business API. A IA pode salvar a configuração e testar a conexão usando as tools configurar_whatsapp e testar_conexao_whatsapp.

IMPORTANTE — REGRAS DE SEGURANÇA DA API (seguir RIGOROSAMENTE para evitar BAN):
- O WhatsApp Business API tem regras rígidas. Violações causam DESATIVAÇÃO PERMANENTE da conta.
- NUNCA enviar mensagens de texto livre fora da janela de 24h (só templates aprovados).
- Templates devem ser auto-suficientes (toda informação no template, nunca complementar com texto).
- Exemplos de templates devem ser HUMANOS e DESCRITIVOS (nunca UUIDs, hashes ou códigos técnicos).
- URLs nos templates devem ser HTTPS válidas e publicamente acessíveis.
- Categoria correta: notificações de OS são UTILITY (não marketing).
- Não fazer múltiplas tentativas rápidas em caso de erro — investigar a causa primeiro.

PRÉ-REQUISITOS (o cliente precisa ter ANTES de configurar):
1. Conta Meta Business verificada (business.facebook.com) — criar se não tiver
2. App criado no Meta for Developers (developers.facebook.com/apps)
3. Produto "WhatsApp" adicionado ao app
4. Número de telefone dedicado registrado (NÃO pode estar no WhatsApp pessoal)
5. System User criado com permissão whatsapp_business_messaging

PASSO A PASSO DETALHADO (guiar o cliente por cada etapa):

ETAPA 1 — Criar App no Meta for Developers:
- Acessar developers.facebook.com → Meus Apps → "Criar aplicativo"
- Tipo: Business
- Empresa: selecionar a empresa verificada
- Dar um nome (ex: nome da empresa)

ETAPA 2 — Adicionar WhatsApp ao App:
- No painel do app: "Adicionar Produto" → WhatsApp → "Configurar"
- Em "API Setup": anotar o Phone Number ID e o WABA ID (ID da conta WhatsApp Business)

ETAPA 3 — Criar System User (RECOMENDADO para token permanente):
- Acessar business.facebook.com → Configurações → Usuários do Sistema
- "Adicionar" → Nome: "Tecnikos API" → Função: Admin
- "Atribuir ativos": adicionar o App + a conta WhatsApp Business (Full Control)
- "Gerar token": selecionar permissões:
  * whatsapp_business_messaging (obrigatória)
  * whatsapp_business_management (obrigatória)
- COPIAR o token (começa com EAA...) — ele só aparece UMA vez!
- Este token é PERMANENTE (não expira como o temporário)

ETAPA 4 — Configurar no Tecnikos:
- Ir em Configurações > WhatsApp (/settings/whatsapp)
- Colar o Access Token (EAA...)
- Colar o Phone Number ID
- Colar o WABA ID
- Colar o App ID (opcional, para sincronizar logo do perfil)
- Clicar "Testar Conexão" — deve mostrar o nome verificado e número
- Se OK, clicar "Salvar"
- A IA pode fazer isso automaticamente com a tool configurar_whatsapp se o cliente fornecer os dados

ETAPA 5 — Configurar Webhook no Meta:
- Após salvar no Tecnikos, copiar a URL do Webhook e o Token de Verificação exibidos
- No Meta for Developers: WhatsApp > Configuração > Webhook
- Colar a URL do Webhook
- Colar o Token de Verificação
- Campos assinados: selecionar "messages"
- Clicar "Verificar e salvar"

ETAPA 6 — Criar Templates de Mensagem:
- No WhatsApp Manager (business.facebook.com): Modelos de mensagem > Gerenciar modelos
- Criar template "aviso_os":
  * Categoria: UTILITY
  * Idioma: Português (BR)
  * Body: "{{1}}" (o sistema preenche automaticamente com a notificação)
  * Exemplo do body: "A OS Manutenção Preventiva - Piscina foi atribuída ao técnico João Silva. Acesse o link para mais detalhes."
  * NUNCA colocar UUIDs ou códigos técnicos nos exemplos
- Criar template "teste_conexao":
  * Categoria: UTILITY
  * Idioma: Português (BR)
  * Body: "Conexão com WhatsApp configurada com sucesso! Este é um teste automático do sistema Tecnikos."
  * Sem parâmetros
- Aguardar aprovação (pode levar de minutos a horas)

CUIDADOS CRÍTICOS (avisar o cliente):
- O número registrado NÃO pode estar em uso no WhatsApp pessoal
- Se o número já está no WhatsApp pessoal, precisa desvincular primeiro
- Mensagens são COBRADAS por template enviado (verificar preços na região)
- Manter qualidade alta: não enviar spam, respeitar opt-in do destinatário
- Se a conta for restrita/desativada: PARAR todos os envios e contatar suporte Meta imediatamente
- Token do System User é secreto — nunca compartilhar ou expor em código público`,

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

  fiscal: `WIZARD DE CONFIGURAÇÃO NFS-e — Guiar o usuário passo a passo.

AO INICIAR O WIZARD:
1. Use a tool verificar_fiscal_completo para obter o checklist atual
2. Mostre o progresso como checklist visual (✅ feito / ⬜ pendente)
3. Comece pelo PRIMEIRO item pendente — NÃO pule etapas
4. A cada step concluído, use verificar_fiscal_completo novamente para atualizar o checklist

STEP 1 — REGISTRO NA PLATAFORMA FISCAL (automático):
- O Tecnikos já possui integração própria com o provedor de notas fiscais
- O cliente NÃO precisa criar conta em nenhum site externo — o Tecnikos gerencia tudo automaticamente
- Explicar: "O Tecnikos já tem integração com o provedor de notas fiscais. Vou registrar sua empresa automaticamente."
- Usar a tool registrar_empresa_focus para registrar/atualizar a empresa automaticamente
- Se sucesso: "Empresa registrada com sucesso! Tokens de emissão configurados automaticamente."
- Se falhar: mostrar o erro e orientar a corrigir (geralmente CNPJ ou endereço incompleto)
- IMPORTANTE: O registro usa dados já cadastrados da empresa (CNPJ, endereço, regime tributário)

STEP 2 — CERTIFICADO DIGITAL (informativo):
- "Para emitir NFS-e em produção, sua empresa precisará de um certificado digital e-CNPJ modelo A1"
- "O certificado é um arquivo .pfx que você obtém com uma Autoridade Certificadora (ex: Serasa, Certisign, Soluti)"
- "Quando tiver o certificado, faremos o upload por aqui mesmo"
- "Em homologação (testes) o certificado não é necessário — podemos começar testando!"
- NÃO bloquear o wizard por causa disso — é necessário só para produção

STEP 3 — DADOS MUNICIPAIS (se código IBGE pendente):
- Perguntar: "Em qual cidade sua empresa está localizada?"
- Usar a tool buscar_municipio_ibge com o nome informado
- Se encontrar 1 resultado: confirmar com o usuário e salvar com salvar_codigo_ibge
- Se encontrar múltiplos: listar e perguntar qual é o correto
- Perguntar também: "Qual é sua Inscrição Municipal?" (número fornecido pela prefeitura)
  - Se o usuário não souber: "Sem problema! A Inscrição Municipal está no cadastro da prefeitura. Seu contador pode te informar. Podemos preencher depois."

STEP 4 — SERVIÇOS HABILITADOS (se nenhum cadastrado):
- Perguntar: "Quais serviços sua empresa presta? (ex: manutenção elétrica, instalação, etc.)"
- Mostrar botão: "Cadastrar Serviço" → /settings/fiscal (aba Serviços Habilitados)
- Explicar: "Na página de configuração fiscal, você encontra uma busca com 335 códigos tributários nacionais. Procure pelo tipo de serviço e ative."
- Se o usuário informar o tipo de serviço, sugerir códigos comuns:
  - Manutenção/reparo: 14.01, 14.06, 14.13
  - Instalação elétrica: 7.02, 7.05
  - TI/Suporte: 1.07, 1.08
  - Limpeza: 7.10
- Usar listar_servicos_nfse para confirmar que foram cadastrados

STEP 5 — ALÍQUOTA ISS E TRIBUTAÇÃO:
- Se alíquota não definida: "Qual a alíquota ISS da sua empresa? (geralmente entre 2% e 5%)"
- Se não souber: "Consulte seu contador ou a prefeitura da sua cidade. A alíquota varia por município e tipo de serviço."
- Regime tributário: "Sua empresa é do Simples Nacional, Lucro Presumido ou Lucro Real?"
- Esses dados podem ser preenchidos diretamente em /settings/fiscal

STEP 6 — VALIDAÇÃO FINAL:
- Usar verificar_fiscal_completo para checar tudo
- Mostrar checklist final com ✅ para cada item
- Se tudo OK: "Configuração fiscal completa! 🎉"
- Sugerir: "Quer emitir uma nota de teste em homologação para verificar se está tudo certo?"
- Mostrar botão: "Abrir Financeiro" → /finance (para testar emissão)

STEP 7 — TESTE DE EMISSÃO (opcional):
- "Para testar, vá ao Financeiro, selecione um lançamento a receber e clique em 'Emitir NFS-e'"
- "Como está em homologação, a nota será de teste e não terá valor fiscal"
- "Quando estiver satisfeito, troque para Produção em Configurações > Fiscal"

REGRAS DO WIZARD:
- Ser paciente e amigável — o usuário pode não entender termos fiscais
- NUNCA pular etapas — seguir a ordem
- Se o usuário não souber uma informação, sugerir que consulte o contador e oferecer para continuar depois
- A cada step concluído, comemorar brevemente e passar ao próximo
- Se o usuário perguntar "Como configurar NFS-e?" ou similar, iniciar o wizard do STEP 1
- Mostrar action_buttons relevantes a cada passo
- IMPORTANTE: O contador da empresa é fundamental para os códigos tributários`,

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

  pushNotifications: `Guie o usuário para ativar notificações push em /notifications:

O QUE SÃO:
- Notificações push chegam diretamente no navegador/dispositivo, mesmo com o sistema minimizado
- Alertam sobre: novas OS atribuídas, mudanças de status, notificações do sistema
- Funcionam no Chrome, Edge, Firefox e Safari (desktop e Android)

COMO ATIVAR:
1. Acessar a página de Notificações (botão no menu ou /notifications)
2. Na seção "Notificações Push", clicar "Ativar Push"
3. O navegador vai solicitar permissão — clicar "Permitir"
4. Pronto! Um teste será enviado para confirmar

VERIFICAÇÃO:
- Usar a tool verificar_push_notifications para checar o status
- Se o navegador bloqueou: orientar a desbloquear nas configurações do navegador (Configurações > Privacidade > Notificações > Permitir para o site)
- Se não aparece o botão: verificar se o navegador suporta (Safari iOS não suporta em versões antigas)

DICAS:
- Cada dispositivo/navegador precisa ativar separadamente
- A ativação é por usuário — cada membro da equipe precisa ativar no seu navegador
- Desativar: mesma página, botão "Desativar"`,

  nfseImports: `Guie o usuário sobre importação de NFS-e em /nfe/entrada:

CONCEITO:
- O Tecnikos pode importar NFS-e recebidas (notas de serviços tomados) automaticamente via provedor fiscal
- A importação MANUAL (digitar dados) é sempre gratuita e ilimitada
- A importação AUTOMÁTICA (buscar via API do provedor) consome créditos

COMO FUNCIONA:
- Créditos de importação são comprados como pacotes (add-ons)
- Cada importação automática consome 1 crédito
- Créditos valem para o ciclo de faturamento atual (não acumulam)

VERIFICAÇÃO:
- Usar a tool verificar_nfse_imports para checar saldo e pacotes disponíveis

COMO COMPRAR:
1. Ir em Configurações > Faturamento (/settings/billing)
2. Filtrar por "NFS-e" para ver os pacotes
3. Escolher o pacote desejado e clicar "Comprar"
4. Após confirmação do pagamento, os créditos são liberados automaticamente

COMO IMPORTAR:
1. Ir em Fiscal > NFS-e Entrada (/nfe/entrada)
2. Clicar "Importar NFS-e" (o botão só aparece se tiver créditos)
3. O sistema busca automaticamente as notas do provedor fiscal
4. Revisar as notas importadas

PACOTES DISPONÍVEIS: (usar tool para listar com preços atualizados)`,

  billing: `Guie o usuário sobre plano e faturamento em /settings/billing:

VERIFICAÇÃO:
- Usar a tool verificar_plano_billing para obter dados atualizados do plano, limites e uso

PLANO ATUAL:
- Mostrar: nome do plano, preço, ciclo (mensal/anual), próxima cobrança
- Mostrar limites vs uso atual (OS, usuários, técnicos, mensagens IA)

LIMITES:
- OS/mês: total de ordens de serviço que podem ser criadas no ciclo
- Usuários: gestores que podem acessar o sistema
- Técnicos: técnicos cadastrados (campo)
- Mensagens IA: interações com este assistente por mês
- Importações NFS-e: créditos para importação automática (add-on separado)

UPGRADE:
- Se o cliente está próximo do limite, sugerir upgrade
- "Para aumentar seus limites, acesse Configurações > Faturamento e clique em 'Alterar Plano'"
- O upgrade gera cobrança pro-rata (paga a diferença do ciclo restante)
- Os novos limites são aplicados IMEDIATAMENTE após confirmação do pagamento

ADD-ONS:
- Para necessidades pontuais, existem pacotes extras (add-ons)
- Tipos: OS extras, usuários extras, técnicos extras, mensagens IA extras, importações NFS-e
- Add-ons valem para o ciclo atual (não acumulam entre meses)
- Comprar em /settings/billing

DOWNGRADE:
- Redução de plano é agendada para o próximo ciclo
- Não há cobrança adicional — aplica no próximo vencimento

PROMOÇÕES:
- Se houver promoção ativa, mostrar desconto e meses restantes
- Promoções são aplicadas automaticamente no signup ou por código

DÚVIDAS COMUNS:
- "Posso mudar de mensal para anual?": Sim, em /settings/billing
- "O que acontece se atingir o limite?": O sistema bloqueia a criação de novos itens até o próximo ciclo ou compra de add-on
- "Posso cancelar?": Sim, mas orientar a entrar em contato com o suporte`,
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

  /** Check if chatIAMonthReset is outside current billing period and needs reset */
  private async needsBillingReset(db: any, resetDate: Date | null): Promise<boolean> {
    if (!resetDate) return true;
    // Try to get billing cycle from subscription
    const tenant = await db.tenant.findFirst({ select: { id: true } }).catch(() => null);
    if (tenant) {
      const sub = await db.subscription.findFirst({
        where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'PAST_DUE'] } },
        select: { currentPeriodStart: true },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null);
      if (sub) {
        // Reset if the stored resetDate is before the current billing period start
        return resetDate < sub.currentPeriodStart;
      }
    }
    // Fallback: calendar month reset
    const now = new Date();
    return resetDate.getMonth() !== now.getMonth() || resetDate.getFullYear() !== now.getFullYear();
  }

  async checkAndIncrementUsage(companyId: string, tenantSchema?: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
  }> {
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;
    const company = await db.company.findFirst({
      select: { chatIAMonthlyMsgs: true, chatIAMonthReset: true, maxAiMessages: true },
    });

    if (!company) return { allowed: false, used: 0, limit: 0 };

    // Use real maxAiMessages from plan snapshot (0 = unlimited)
    const limit = company.maxAiMessages || 0;
    const needsReset = await this.needsBillingReset(db, company.chatIAMonthReset);

    if (limit === 0) {
      // Unlimited — just increment and allow
      let used = company.chatIAMonthlyMsgs;
      if (needsReset) {
        await db.company.updateMany({ data: { chatIAMonthlyMsgs: 0, chatIAMonthReset: new Date() } });
        used = 0;
      }
      await db.company.updateMany({ data: { chatIAMonthlyMsgs: used + 1 } });
      return { allowed: true, used: used + 1, limit: 0 };
    }

    let used = company.chatIAMonthlyMsgs;
    if (needsReset) {
      await db.company.updateMany({
        data: { chatIAMonthlyMsgs: 0, chatIAMonthReset: new Date() },
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
      select: { chatIAMonthlyMsgs: true, chatIAMonthReset: true, maxAiMessages: true },
    });

    if (!company) return { used: 0, limit: 0 };

    const limit = company.maxAiMessages || 0;
    const needsReset = await this.needsBillingReset(db, company.chatIAMonthReset);

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

  /** Check if user has access to Chat IA (ADMIN always, others need chatIAEnabled) */
  private async checkChatAccess(userId: string, userRoles: string[], tenantSchema?: string): Promise<void> {
    if (userRoles.includes('ADMIN')) return; // ADMIN always has access
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { chatIAEnabled: true },
    });
    if (!user?.chatIAEnabled) {
      throw new ForbiddenException('Acesso ao Chat IA não habilitado para este usuário. Solicite ao administrador.');
    }
  }

  async sendMessage(
    companyId: string,
    userId: string,
    content: string,
    conversationId?: string,
    tenantSchema?: string,
    userRoles: string[] = [],
  ): Promise<{ conversationId: string; message: MessageResult }> {
    if (!this.anthropic) {
      throw new ForbiddenException('Assistente IA não configurado (ANTHROPIC_API_KEY)');
    }

    // Check chatIAEnabled access
    await this.checkChatAccess(userId, userRoles, tenantSchema);

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
    const result = await this.callClaude(messages, contextPrefix, db, userRoles);

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

  async getWelcomeMessage(companyId: string, tenantSchema?: string, tenantId?: string): Promise<MessageResult> {
    const onboardingStatus = await this.onboarding.getStatus(companyId, tenantSchema);
    const db = tenantSchema ? this.tenantConnection.getClient(tenantSchema) : this.prisma;
    const company = await db.company.findFirst({ select: { tradeName: true, name: true } });
    const companyName = company?.tradeName || company?.name || 'sua empresa';

    // Check verification status from VerificationSession
    let verificationPending = false;
    if (tenantId) {
      const session = await this.prisma.verificationSession.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { reviewStatus: true },
      });
      verificationPending = !!session && session.reviewStatus !== 'APPROVED';
    }

    if (!onboardingStatus.requiredDone) {
      // New company — onboarding mode
      const done = onboardingStatus.items.filter((i) => i.done);
      const pending = onboardingStatus.items.filter((i) => !i.done && !i.optional);
      const optional = onboardingStatus.items.filter((i) => !i.done && i.optional);
      const total = onboardingStatus.items.length;
      const pct = Math.round((done.length / total) * 100);

      let content = `Olá! 👋 Bem-vindo ao **Tecnikos**!\n\n`;
      content += `Sou seu assistente e vou te guiar na configuração do sistema para a **${companyName}**.\n\n`;

      // Show verification status notice if documents not yet approved
      if (verificationPending) {
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
    let normalContent = `Olá! 👋 Como posso ajudar a **${companyName}** hoje?\n\n`;
    if (verificationPending) {
      normalContent += `⏳ **Seus documentos ainda estão em análise.** Funcionalidades como Ordens de Serviço, Financeiro e Orçamentos estarão disponíveis assim que a validação for concluída.\n\n`;
    }
    normalContent += `Posso consultar suas ordens de serviço, clientes, financeiro, ou ajudar com qualquer dúvida sobre o sistema.`;
    return { content: normalContent };
  }

  // ── Stream Message ────────────────────────────────────

  async sendMessageStream(
    companyId: string,
    userId: string,
    content: string,
    conversationId: string | undefined,
    tenantSchema: string | undefined,
    emit: (event: string, data: any) => void,
    userRoles: string[] = [],
  ): Promise<void> {
    if (!this.anthropic) {
      emit('error', { message: 'Assistente IA não configurado' });
      return;
    }

    // Check chatIAEnabled access
    await this.checkChatAccess(userId, userRoles, tenantSchema);

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
      result = await this.streamClaude(messages, contextPrefix, db, emit, userRoles);
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
    userRoles: string[] = [],
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
        const result = await executeTool(db, block.name, block.input, userRoles);
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
    let ctx = `[Contexto atual: ${usage.used}/${usage.limit === 0 ? 'ilimitado' : usage.limit} mensagens usadas este mês]\n`;

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
    } else {
      // Even after onboarding is done, check if fiscal is enabled but incomplete
      const fiscalItem = onboarding.items.find((i) => i.key === 'fiscal');
      if (fiscalItem && !fiscalItem.optional && !fiscalItem.done) {
        // Fiscal is required (enabled) but not yet fully configured
        const wizardInstructions = WIZARD_INSTRUCTIONS['fiscal'];
        if (wizardInstructions) {
          ctx += `\n[FISCAL INCOMPLETO: O módulo fiscal está habilitado mas faltam configurações. Se o usuário mencionar NFS-e, nota fiscal ou configuração fiscal, ative o wizard.]\n`;
          ctx += `${wizardInstructions}\n`;
        }
      }

      // Inject all wizard instructions so the AI can trigger them by keyword detection
      ctx += `\n[WIZARDS DISPONÍVEIS: Se o usuário perguntar sobre configuração de push, importação NFS-e, planos/billing, ou setup geral, ative o wizard correspondente usando as instruções abaixo.]\n`;
      for (const key of ['pushNotifications', 'nfseImports', 'billing']) {
        const wi = WIZARD_INSTRUCTIONS[key];
        if (wi) ctx += `\n[WIZARD ${key}]\n${wi}\n`;
      }
    }

    return ctx;
  }

  private async callClaude(
    messages: Anthropic.MessageParam[],
    contextPrefix: string,
    db: any,
    userRoles: string[] = [],
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

        const result = await executeTool(db, block.name, block.input as Record<string, any>, userRoles);
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
      { pattern: /módulo fiscal|configura(?:r|ção) (?:fiscal|nfs)|token.*focus|código ibge|inscrição municipal/i, label: 'Abrir Config Fiscal', href: '/settings/fiscal' },
      { pattern: /emitir.*n(?:fs|ota)|nota.*(?:fiscal|serviço)/i, label: 'Abrir Financeiro', href: '/finance' },
      { pattern: /serviços? (?:habilitad|cadastrad|nfs)/i, label: 'Cadastrar Serviço', href: '/settings/fiscal' },
      { pattern: /ordens? de serviço|lista de OS/i, label: 'Ver Ordens de Serviço', href: '/orders' },
      { pattern: /financeiro|lançamentos/i, label: 'Ver Financeiro', href: '/finance' },
      { pattern: /certificado digital|e-?cnpj|modelo a1/i, label: 'Abrir Config Fiscal', href: '/settings/fiscal' },
    ];

    for (const { pattern, label, href } of pagePatterns) {
      if (pattern.test(content) && !buttons.some((b) => b.href === href)) {
        buttons.push({ label, href });
      }
    }

    return buttons.slice(0, 3); // Max 3 buttons
  }
}
