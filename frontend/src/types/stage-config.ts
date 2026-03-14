/* ═══════════════════════════════════════════════════════════════
   STAGE CONFIG — Formulário de etapas do fluxo de atendimento
   Cada status da OS = uma seção configurável com toggles.
   Compila para WorkflowDefV2 (version: 2) para salvar no backend.
   ═══════════════════════════════════════════════════════════════ */

/* ── Tipos ─────────────────────────────────────────────────── */

export interface StageConfig {
  id: string;
  status: string;
  label: string;
  icon: string;
  enabled: boolean;

  techActions: {
    step:      { enabled: boolean; description: string; requirePhoto: boolean; requireNote: boolean; requireGPS: boolean };
    photo:     { enabled: boolean; minPhotos: number; label: string; photoType: string };
    note:      { enabled: boolean; placeholder: string };
    gps:       { enabled: boolean; requireAccuracy: boolean };
    checklist: { enabled: boolean; items: string[] };
    form:      { enabled: boolean; fields: FormFieldDef[] };
    signature: { enabled: boolean; label: string };
    question:  { enabled: boolean; question: string; options: string[] };
    photoRequirements: { enabled: boolean; groups: PhotoRequirementGroup[] };
    materials: { enabled: boolean; label: string; requireQuantity: boolean; requireUnitCost: boolean };
  };

  autoActions: {
    notifyGestor:   { enabled: boolean; channel: string; message: string };
    notifyTecnico:  { enabled: boolean; channel: string; message: string; includeLink: boolean };
    notifyCliente:  { enabled: boolean; channel: string; message: string };
    financialEntry: {
      enabled: boolean;
      entries: FinancialEntryConfig[];    // múltiplos lançamentos configuráveis
    };
    alert:          { enabled: boolean; message: string; severity: string };
    webhook:        { enabled: boolean; url: string };
    assignTech:     { enabled: boolean; strategy: string };
    duplicateOS:    { enabled: boolean };
    gestorApproval: {
      enabled: boolean;
      reviewChecklist: string[];                    // itens que o gestor confere antes de aprovar
      onApprove: {
        notifyTecnico: { enabled: boolean; channel: string; message: string };
        notifyCliente: { enabled: boolean; channel: string; message: string };
      };
      onApproveWithReservations: {
        enabled: boolean;                           // se false, botão "Aprovar com ressalvas" não aparece
        requireNote: boolean;                       // gestor deve descrever as ressalvas
        commissionAdjustment: {
          enabled: boolean;
          type: string;                             // 'reduce_percent' | 'reduce_fixed'
          value: number;                            // % ou valor fixo a reduzir
        };
        flagOS: boolean;                            // marca a OS com flag de qualidade
        notifyTecnico: { enabled: boolean; channel: string; message: string };
        notifyCliente: { enabled: boolean; channel: string; message: string };
      };
      onReject: {
        action: string;          // 'reopen_execution' | 'return_assigned' | 'notify_only'
        requireReason: boolean;
        notifyTecnico: { enabled: boolean; channel: string; message: string };
        notifyCliente: { enabled: boolean; channel: string; message: string };
      };
    };

    /* ── Campos ricos (stage-specific) ─────────────────── */
    techSelection: {
      enabled: boolean;
      method: string;          // BY_SPECIALIZATION | DIRECTED | BEST_RATING | LEAST_BUSY | NEAREST
      maxTechnicians: number;
      acceptTimeout: {
        mode: 'fixed' | 'from_os';    // fixo ou definido na OS
        value: number;                  // valor numérico (quando mode=fixed)
        unit: 'minutes' | 'hours';     // unidade (quando mode=fixed)
      };
      enRouteTimeout: {
        mode: 'fixed' | 'from_os';    // fixo ou definido na OS
        value: number;
        unit: 'minutes' | 'hours';
      };
      onTimeout: string;       // notify_gestor | reassign | cancel
      filterBySpecialization: boolean;
      discardBusyTechnicians: boolean;  // descartar técnicos que estão em atendimento no prazo de aceitar
    };
    techReviewScreen: {
      enabled: boolean;              // Exibir tela de revisão dos técnicos selecionados antes do disparo
      allowEdit: boolean;            // Permitir que o despacho inclua/exclua técnicos na tela de revisão
    };
    messageDispatch: {
      enabled: boolean;
      toTechnicians: {
        enabled: boolean; channel: string; message: string;
        link: {
          enabled: boolean;
          validityHours: number;
          acceptOS: boolean;
          gpsNavigation: boolean;
          pageLayout: LinkPageBlock[];
        };
      };
      toGestor:  { enabled: boolean; channel: string; message: string };
      toCliente: { enabled: boolean; channel: string; message: string };
    };
    techQuestion: {
      enabled: boolean;
      question: string;
      options: TechQuestionOption[];
      required: boolean;          // obriga responder antes de aceitar
      showOnLinkPage: boolean;    // exibir na página do link
    };
    arrivalQuestion: {
      enabled: boolean;
      question: string;
      options: ArrivalTimeOption[];
      useAsDynamicTimeout: boolean;  // tempo escolhido substitui o enRouteTimeout
      notifyCliente: boolean;        // notificar cliente sobre ETA
      notifyGestor: boolean;         // notificar gestor sobre ETA
      onDecline: string;             // notify_gestor | reassign | return_offered | cancel
    };
    proximityTrigger: {
      enabled: boolean;
      radiusMeters: number;                // raio para disparar eventos (50–5000m)
      trackingIntervalSeconds: number;     // frequência de envio de posição (10–120s)
      requireHighAccuracy: boolean;        // alta precisão GPS
      keepActiveUntil: string;             // 'radius' = desliga ao entrar no raio, 'execution_end' = mantém até concluir
      onEnterRadius: {
        notifyCliente:      { enabled: boolean; channel: string; message: string };
        notifyGestor:       { enabled: boolean; channel: string; message: string };
        autoStartExecution: boolean;       // auto-mudar status para EM_EXECUÇÃO ao chegar
        alert:              { enabled: boolean; message: string };
      };
    };

    // Regime de Agenda CLT (v1.01.72)
    scheduleConfig: {
      enabled: boolean;                    // Ativa regime de agenda (despacho manual com data/hora)
      defaultDurationMinutes: number;      // Duração padrão do serviço (ex: 60)
      workingHours: {
        start: string;                     // "08:00"
        end: string;                       // "18:00"
      };
      workingDays: number[];               // [1,2,3,4,5] = seg-sex (0=dom, 6=sab)
      notifyTechnician: {
        enabled: boolean;
        channel: string;                   // 'whatsapp' | 'email'
        message: string;                   // Suporta {nome}, {data_agendamento}, {titulo}, {cliente}
        minutesBefore: number;             // Notificar X minutos antes (0 = ao agendar)
      };
    };
  };

  timeControl: {
    sla:     { enabled: boolean; maxMinutes: number; alertOnExceed: boolean };
    waitFor: { enabled: boolean; timeoutMinutes: number; triggerConditions: string[]; targetStatus: string; timeoutAction: string };
    delay:   { enabled: boolean; minutes: number };
    executionTimer: { enabled: boolean; showToTech: boolean; pauseDiscountsFromSla: boolean };
    pauseSystem: {
      enabled: boolean;
      maxPauses: number;                   // 0 = ilimitado
      maxPauseDurationMinutes: number;     // 0 = ilimitado
      requireReason: boolean;
      allowedReasons: string[];            // categories habilitadas (subset de PAUSE_REASON_CATEGORIES)
      /* ── Notificações ricas (canal + mensagem por destinatário) ── */
      notifications: {
        onPause: {
          gestor:  { enabled: boolean; channel: string; message: string };
          cliente: { enabled: boolean; channel: string; message: string };
          tecnico: { enabled: boolean; channel: string; message: string };
        };
        onResume: {
          gestor:  { enabled: boolean; channel: string; message: string };
          cliente: { enabled: boolean; channel: string; message: string };
          tecnico: { enabled: boolean; channel: string; message: string };
        };
      };
      /* ── Fotos: controladas via photoRequirements (on_pause / on_resume) ── */
      /* Removido: requirePhotosOnPause/Resume e minPhotosOnPause/Resume */
      /* As fotos de pausa são configuradas em "Fotos por momento" (photoRequirements) com moment on_pause/on_resume */
    };
  };
}

export interface FormFieldDef {
  name: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
}

export interface PhotoRequirementGroup {
  id: string;
  moment: string;    // 'before_start' | 'after_completion' | 'on_pause' | 'on_resume' | 'general'
  minPhotos: number;
  maxPhotos: number; // 0 = ilimitado
  label: string;
  instructions: string;
  required: boolean;
}

export interface FinancialEntryConfig {
  id: string;
  type: string;           // 'contas_receber' | 'contas_pagar' | 'custo' | 'comissao' | 'taxa' | 'desconto' | 'custom'
  label: string;          // rótulo exibido (ex: "Comissão do técnico")
  valueSource: string;    // 'os_value' | 'os_commission' | 'fixed' | 'manual' | 'materials_total'
  fixedValue?: number;    // quando valueSource = 'fixed'
  percentOfOS?: number;   // quando valueSource = 'percent_os' (0-100)
  description: string;    // descrição do lançamento
  autoCreate: boolean;    // criar automaticamente ou apenas sugerir
}

export interface LinkPageBlock {
  id: string;
  type: 'info' | 'text';
  /** Para type='info': qual campo de dados exibir */
  field?: string;
  /** Label exibido na página */
  label: string;
  /** Para type='text': conteúdo livre com variáveis de template */
  content?: string;
  enabled: boolean;
}

export interface TechQuestionOption {
  label: string;
  action: string;   // 'accept' | 'reject' | 'reschedule' | 'notify_gestor' | 'none'
}

export interface ArrivalTimeOption {
  label: string;    // "15 minutos", "30 minutos", "1 hora"
  minutes: number;  // valor em minutos
}

export const QUESTION_ACTIONS = [
  { value: 'accept',        label: 'Aceitar a OS automaticamente' },
  { value: 'reject',        label: 'Descartar técnico e redistribuir' },
  { value: 'reschedule',    label: 'Agendar para depois (notifica gestor)' },
  { value: 'notify_gestor', label: 'Apenas notificar o gestor' },
  { value: 'none',          label: 'Nenhuma ação automática' },
];

export const LINK_PAGE_FIELDS = [
  { field: 'title',       label: 'Título da OS',       icon: '📋' },
  { field: 'address',     label: 'Endereço',           icon: '📍' },
  { field: 'commission',  label: 'Valor da comissão',  icon: '💰' },
  { field: 'value',       label: 'Valor total da OS',  icon: '💵' },
  { field: 'deadline',    label: 'Prazo de execução',  icon: '📅' },
  { field: 'clientName',  label: 'Nome do cliente',    icon: '👤' },
  { field: 'contact',     label: 'Contato no local',   icon: '📞' },
  { field: 'description', label: 'Descrição do serviço', icon: '📝' },
  { field: 'city',        label: 'Cidade',             icon: '🏙️' },
  { field: 'company',     label: 'Nome da empresa',    icon: '🏢' },
] as const;

/* ── Configuração de Onboarding de Técnico ──────────────────── */

export interface TechnicianOnboardingConfig {
  enabled: boolean;

  onNewTechnician: {
    enabled: boolean;        // Disparar quando parceiro é marcado como TÉCNICO
    sendContractLink: boolean;
    channel: string;         // WHATSAPP | EMAIL
    contractName: string;
    contractContent: string; // HTML/texto do contrato
    requireSignature: boolean;
    requireAcceptance: boolean;
    blockUntilAccepted: boolean;
    expirationDays: number;
    expirationUnit?: 'days' | 'months' | 'years' | 'indefinite';
    notifyMessage: string;   // Mensagem de notificação
    // CLT welcome message
    sendWelcomeMessage: boolean;
    welcomeChannel: string;       // WHATSAPP | EMAIL
    welcomeMessage: string;       // Texto da mensagem
    welcomeWaitForReply: boolean; // Aguardar confirmação do técnico
    welcomeConfirmVia: string;    // WHATSAPP | LINK — como o técnico confirma
    // Resposta do técnico CLT
    welcomeReplyMessage: string;          // Mensagem de retorno ao aceitar
    welcomeDeclineActions: string[];      // Ações na recusa: 'DEACTIVATE' | 'NOTIFY_GESTOR'
    welcomeDeclineMessage: string;        // Mensagem ao gestor quando técnico recusa
    welcomePositiveKeywords: string[];    // Palavras que indicam aceite (ex: 'sim', 'aceito')
    welcomeNegativeKeywords: string[];    // Palavras que indicam recusa (ex: 'nao', 'recuso')
  };

  onNewSpecialization: {
    enabled: boolean;        // Disparar quando nova especialização é atribuída
    sendContractLink: boolean;
    channel: string;
    contractName: string;
    contractContent: string;
    requireSignature: boolean;
    requireAcceptance: boolean;
    blockUntilAccepted: boolean;
    expirationDays: number;
    expirationUnit?: 'days' | 'months' | 'years' | 'indefinite';
    notifyMessage: string;
    // CLT welcome message
    sendWelcomeMessage: boolean;
    welcomeChannel: string;
    welcomeMessage: string;
    welcomeWaitForReply: boolean;
    welcomeConfirmVia: string;
    // Resposta do técnico CLT
    welcomeReplyMessage: string;
    welcomeDeclineActions: string[];
    welcomeDeclineMessage: string;
    welcomePositiveKeywords: string[];
    welcomeNegativeKeywords: string[];
  };

  // Resolução de conflito: técnico criado já com especialização
  conflictResolution: {
    behavior: 'send_both' | 'tech_only' | 'spec_only';
  };
}

/* ── Configuração de Onboarding de Cliente ──────────────────── */

export interface ClientOnboardingConfig {
  enabled: boolean;
  // Envio de contrato / termos de serviço
  sendContractLink: boolean;
  channel: string;         // WHATSAPP | EMAIL
  contractName: string;
  contractContent: string;
  requireSignature: boolean;
  requireAcceptance: boolean;
  blockUntilAccepted: boolean;
  expirationDays: number;
  expirationUnit?: 'days' | 'months' | 'years' | 'indefinite';
  notifyMessage: string;
  // Mensagem de boas-vindas
  sendWelcomeMessage: boolean;
  welcomeChannel: string;
  welcomeMessage: string;
  welcomeWaitForReply: boolean;
  welcomeConfirmVia: string;
  // Resposta do cliente
  welcomeReplyMessage: string;
  welcomeDeclineActions: string[];
  welcomeDeclineMessage: string;
  welcomePositiveKeywords: string[];
  welcomeNegativeKeywords: string[];
}

const DEFAULT_CONTRACT_CONTENT = `CONTRATO DE PRESTACAO DE SERVICOS TECNICOS TERCEIRIZADOS

CONTRATANTE: {razao_social}, nome fantasia {empresa}, inscrita no CNPJ sob n. {cnpj_empresa}, com sede em {endereco_empresa}, neste ato representada por seus administradores legais.

CONTRATADO(A): {nome}, portador(a) do documento n. {documento}, doravante denominado(a) PRESTADOR(A).

As partes acima qualificadas celebram o presente Contrato de Prestacao de Servicos Terceirizados, que se regera pelas clausulas e condicoes a seguir.

--- CLAUSULA 1 — OBJETO ---

1.1. O presente contrato tem por objeto a prestacao de servicos tecnicos especializados pelo(a) PRESTADOR(A) em favor da CONTRATANTE, na qualidade de profissional autonomo terceirizado, sem vinculo empregaticio, conforme demandas encaminhadas por meio da plataforma Tecnikos.

1.2. Os servicos serao prestados conforme Ordens de Servico (OS) emitidas pela CONTRATANTE, contendo descricao, local, prazo e valor de cada atendimento.

1.3. O(A) PRESTADOR(A) possui liberdade para aceitar ou recusar as OS oferecidas, sem penalidade por recusa, desde que comunique em tempo habil.

--- CLAUSULA 2 — OBRIGACOES DO(A) PRESTADOR(A) ---

2.1. Executar os servicos com diligencia, qualidade tecnica e dentro dos prazos definidos em cada OS.
2.2. Comparecer aos locais de atendimento devidamente identificado(a), uniformizado(a) quando exigido, e portando ferramentas e EPIs adequados.
2.3. Registrar na plataforma Tecnikos todas as etapas do atendimento conforme exigido no fluxo de trabalho: check-in, fotos, anotacoes, checklist, materiais utilizados e finalizacao.
2.4. Manter sigilo absoluto sobre informacoes da CONTRATANTE, seus clientes, processos internos, dados tecnicos e comerciais, durante e apos a vigencia deste contrato.
2.5. Zelar pela boa imagem da CONTRATANTE perante clientes e terceiros durante os atendimentos.
2.6. Comunicar imediatamente qualquer impedimento, atraso ou impossibilidade na execucao dos servicos.
2.7. Manter seus dados cadastrais atualizados na plataforma, incluindo telefone, email e especializacoes.
2.8. Arcar com todos os custos de deslocamento, alimentacao, ferramentas proprias e demais despesas inerentes a execucao dos servicos, salvo quando expressamente previsto na OS.

--- CLAUSULA 3 — OBRIGACOES DA CONTRATANTE ---

3.1. Disponibilizar acesso a plataforma Tecnikos para recebimento e gestao das Ordens de Servico.
3.2. Fornecer informacoes claras e completas sobre cada servico a ser executado.
3.3. Efetuar os pagamentos nos valores e prazos acordados, conforme definido em cada OS aprovada.
3.4. Avaliar os servicos prestados de forma justa e transparente.
3.5. Fornecer materiais e pecas necessarios quando previsto na OS.

--- CLAUSULA 4 — REMUNERACAO E PAGAMENTO ---

4.1. O(A) PRESTADOR(A) sera remunerado(a) conforme os valores definidos em cada Ordem de Servico aceita e concluida.
4.2. O pagamento sera processado apos a conclusao do servico E aprovacao pelo gestor da CONTRATANTE.
4.3. Eventuais ajustes por retrabalho, atraso injustificado ou avaliacao insatisfatoria serao comunicados previamente e podera haver reducao proporcional nos valores.
4.4. Os pagamentos serao realizados por meio de transferencia bancaria, PIX ou outro meio acordado entre as partes.
4.5. O(A) PRESTADOR(A) e responsavel pela emissao de nota fiscal ou recibo quando aplicavel, conforme legislacao vigente.

--- CLAUSULA 5 — VIGENCIA E RENOVACAO ---

5.1. Este contrato tem vigencia por prazo indeterminado a partir da data do aceite digital.
5.2. Qualquer das partes podera rescindir o contrato mediante comunicacao previa de 30 (trinta) dias.
5.3. A rescisao nao desobriga o(a) PRESTADOR(A) de concluir as OS ja aceitas e em andamento.

--- CLAUSULA 6 — RESCISAO IMEDIATA ---

6.1. O presente contrato podera ser rescindido imediatamente, sem necessidade de aviso previo, em caso de:
  a) Descumprimento grave de qualquer clausula contratual;
  b) Conduta inadequada, desrespeitosa ou antiética durante os atendimentos;
  c) Danos dolosos ou por negligencia grave aos bens da CONTRATANTE ou de seus clientes;
  d) Violacao de sigilo ou uso indevido de informacoes confidenciais;
  e) Avaliacao media inferior a 3.0 (tres) estrelas em um periodo de 90 dias;
  f) Inatividade superior a 90 (noventa) dias sem justificativa;
  g) Fraude ou adulteracao de registros na plataforma.

--- CLAUSULA 7 — PROPRIEDADE INTELECTUAL E DADOS ---

7.1. Todos os registros, fotos, relatorios e dados inseridos na plataforma Tecnikos durante a execucao dos servicos sao de propriedade da CONTRATANTE.
7.2. O(A) PRESTADOR(A) nao podera utilizar, divulgar ou compartilhar dados de clientes da CONTRATANTE para qualquer finalidade alheia ao servico contratado.
7.3. O(A) PRESTADOR(A) autoriza o uso de suas avaliacoes e indicadores de desempenho pela CONTRATANTE para fins internos de gestao de qualidade.

--- CLAUSULA 8 — RESPONSABILIDADE CIVIL ---

8.1. O(A) PRESTADOR(A) assume total responsabilidade por danos causados a terceiros ou a bens do cliente durante a execucao dos servicos, quando comprovada sua culpa ou dolo.
8.2. A CONTRATANTE nao se responsabiliza por acidentes, furtos ou perdas ocorridos durante o deslocamento ou execucao dos servicos pelo(a) PRESTADOR(A).
8.3. O(A) PRESTADOR(A) devera manter seguro de responsabilidade civil profissional quando exigido pela natureza dos servicos.

--- CLAUSULA 9 — INEXISTENCIA DE VINCULO EMPREGATICIO ---

9.1. As partes declaram expressamente que o presente contrato nao gera vinculo empregaticio, nos termos dos artigos 593 a 609 do Codigo Civil e art. 442-B da CLT (incluido pela Lei 13.467/2017).
9.2. O(A) PRESTADOR(A) possui autonomia na execucao dos servicos, assumindo seus proprios riscos.
9.3. O(A) PRESTADOR(A) e exclusivamente responsavel por suas obrigacoes fiscais, previdenciarias e trabalhistas, incluindo contribuicao ao INSS como contribuinte individual.

--- CLAUSULA 10 — DISPOSICOES FINAIS ---

10.1. O aceite digital deste contrato tem plena validade juridica, conforme a Lei 14.063/2020 (assinaturas eletronicas) e o Marco Civil da Internet (Lei 12.965/2014).
10.2. Ao aceitar este contrato, serao registrados a data, hora, endereco IP e identificador do dispositivo utilizado, constituindo prova valida do consentimento.
10.3. Quaisquer alteracoes neste contrato deverao ser formalizadas por aditivo aceito por ambas as partes.
10.4. As partes elegem o foro da comarca da sede da CONTRATANTE para dirimir quaisquer controversias oriundas deste contrato.

{razao_social}, {data}

CONTRATANTE: {razao_social} ({empresa})
PRESTADOR(A): {nome} — Documento: {documento}`;

const DEFAULT_SPECIALIZATION_CONTRACT = `TERMO DE ACEITE — NOVA ESPECIALIZACAO

CONTRATANTE: {razao_social} — {empresa} (CNPJ: {cnpj_empresa})
PRESTADOR(A): {nome} (Documento: {documento})
ESPECIALIZACAO: {especializacao}

Pelo presente termo, o(a) prestador(a) acima identificado(a) declara estar ciente e de acordo com a atribuicao da nova especializacao indicada, assumindo os seguintes compromissos:

1. Executar os servicos relacionados a esta especializacao com competencia, diligencia e qualidade tecnica.
2. Manter-se atualizado(a) sobre as melhores praticas, normas tecnicas e procedimentos da area.
3. Participar de treinamentos ou capacitacoes solicitados pela empresa, quando aplicavel.
4. Declarar possuir conhecimento e habilidade tecnica para executar servicos desta especializacao.
5. Comunicar a empresa caso necessite de capacitacao adicional antes de aceitar ordens de servico.

Este termo entra em vigor na data do aceite digital e permanece valido enquanto a especializacao estiver ativa no cadastro do(a) prestador(a). O aceite digital tem validade juridica conforme Lei 14.063/2020.

{empresa}, {data}`;

export function createDefaultOnboarding(): TechnicianOnboardingConfig {
  return {
    enabled: false,
    onNewTechnician: {
      enabled: false,
      sendContractLink: false,
      channel: 'WHATSAPP',
      contractName: 'Contrato de Prestacao de Servicos Tecnicos',
      contractContent: DEFAULT_CONTRACT_CONTENT,
      requireSignature: false,
      requireAcceptance: true,
      blockUntilAccepted: true,
      expirationDays: 7,
      expirationUnit: 'days',
      notifyMessage: 'Ola {nome}! Voce foi cadastrado(a) como tecnico(a) na {empresa} ({razao_social}). Para formalizar sua participacao, preparamos um contrato de prestacao de servicos. Acesse o link abaixo para visualizar e aceitar o contrato.',
      sendWelcomeMessage: false,
      welcomeChannel: 'WHATSAPP',
      welcomeMessage: 'Ola {nome}, seja bem-vindo(a) a equipe da {empresa} ({razao_social})! Voce foi cadastrado(a) como tecnico(a) em nosso sistema de gestao de servicos - Teknikos. A partir de agora voce recebera ordens de servico diretamente por aqui. Para confirmar seu ingresso, por favor responda esta mensagem com: "Sim, aceito fazer parte".',
      welcomeWaitForReply: true,
      welcomeConfirmVia: 'WHATSAPP',
      welcomeReplyMessage: 'Perfeito {nome}! Sua participacao na equipe da {razao_social} esta confirmada. A partir de agora voce recebera ordens de servico pela plataforma. Qualquer duvida entre em contato pelo {telefone}. Bem-vindo(a)!',
      welcomeDeclineActions: ['DEACTIVATE', 'NOTIFY_GESTOR'],
      welcomeDeclineMessage: 'Atencao: o tecnico {nome} ({email}) recusou a participacao na equipe. Resposta recebida: "{resposta}". O cadastro foi mantido como inativo.',
      welcomePositiveKeywords: ['sim', 'aceito', 'confirmo', 'ok', 'pode ser', 'quero', 'topo', 'bora'],
      welcomeNegativeKeywords: ['nao', 'não', 'recuso', 'desisto', 'nao quero', 'não quero', 'cancela'],
    },
    onNewSpecialization: {
      enabled: false,
      sendContractLink: false,
      channel: 'WHATSAPP',
      contractName: 'Termo de Aceite — Nova Especializacao',
      contractContent: DEFAULT_SPECIALIZATION_CONTRACT,
      requireSignature: false,
      requireAcceptance: true,
      blockUntilAccepted: false,
      expirationDays: 7,
      expirationUnit: 'days',
      notifyMessage: 'Ola {nome}! A especializacao "{especializacao}" foi atribuida ao seu cadastro na {empresa} ({razao_social}). Para ativar esta especializacao, acesse o link abaixo e aceite o termo de responsabilidade.',
      sendWelcomeMessage: false,
      welcomeChannel: 'WHATSAPP',
      welcomeMessage: 'Ola {nome}! Voce recebeu uma nova especializacao na {empresa}: *{especializacao}*. A partir de agora voce podera receber ordens de servico desta area. Para confirmar, responda esta mensagem com "Sim, confirmo".',
      welcomeWaitForReply: false,
      welcomeConfirmVia: 'WHATSAPP',
      welcomeReplyMessage: 'Otimo {nome}! Sua especializacao em "{especializacao}" foi confirmada na {razao_social}. Voce ja pode receber ordens de servico desta area.',
      welcomeDeclineActions: ['NOTIFY_GESTOR'],
      welcomeDeclineMessage: 'Atencao: o tecnico {nome} ({email}) recusou a especializacao "{especializacao}". Resposta recebida: "{resposta}".',
      welcomePositiveKeywords: ['sim', 'aceito', 'confirmo', 'ok', 'pode ser', 'quero', 'topo', 'bora'],
      welcomeNegativeKeywords: ['nao', 'não', 'recuso', 'desisto', 'nao quero', 'não quero', 'cancela'],
    },
    conflictResolution: { behavior: 'send_both' },
  };
}

const DEFAULT_CLIENT_CONTRACT = `TERMOS DE PRESTACAO DE SERVICOS TECNICOS

PRESTADORA: {razao_social}, nome fantasia {empresa}, inscrita no CNPJ sob n. {cnpj_empresa}, com sede em {endereco_empresa}, neste ato representada por seus administradores legais.

CLIENTE: {nome}, portador(a) do documento n. {documento}, doravante denominado(a) CONTRATANTE.

As partes acima qualificadas celebram os presentes Termos de Prestacao de Servicos, regidos pelas clausulas a seguir.

--- CLAUSULA 1 — OBJETO ---

1.1. A PRESTADORA se compromete a executar servicos tecnicos especializados conforme solicitacoes do CONTRATANTE, mediante Ordens de Servico (OS) abertas pela plataforma Tecnikos.

1.2. Os servicos incluem, mas nao se limitam a: instalacao, manutencao preventiva e corretiva, reparo e assistencia tecnica de equipamentos e sistemas.

--- CLAUSULA 2 — SOLICITACAO E EXECUCAO ---

2.1. O CONTRATANTE solicitara os servicos por meio da plataforma Tecnikos ou canais indicados pela PRESTADORA, descrevendo a necessidade, local e urgencia.

2.2. A PRESTADORA designara profissional tecnico qualificado para cada atendimento, conforme disponibilidade e especializacao requerida.

2.3. O CONTRATANTE devera garantir acesso ao local de execucao do servico, bem como informar sobre condicoes especiais (riscos, restricoes de acesso, animais, etc.).

2.4. O CONTRATANTE devera designar responsavel presente no local durante a execucao dos servicos, quando aplicavel.

--- CLAUSULA 3 — VALORES E PAGAMENTO ---

3.1. Os valores serao definidos em cada Ordem de Servico, conforme tabela de precos vigente ou orcamento previo aprovado pelo CONTRATANTE.

3.2. O pagamento devera ser realizado conforme condicoes estabelecidas na OS ou conforme acordo comercial vigente entre as partes.

3.3. Em caso de atraso no pagamento, incidirao juros de 1% ao mes e multa de 2%, alem de correcao monetaria pelo IPCA.

3.4. O cancelamento de servico agendado com menos de 24 horas de antecedencia podera gerar cobranca de taxa de deslocamento.

--- CLAUSULA 4 — GARANTIA ---

4.1. Os servicos executados possuem garantia de 90 (noventa) dias, contados a partir da conclusao e aprovacao pelo CONTRATANTE.

4.2. A garantia cobre exclusivamente defeitos decorrentes da execucao do servico pela PRESTADORA.

4.3. A garantia nao cobre danos causados por mau uso, negligencia, alteracoes nao autorizadas ou intervencao de terceiros.

--- CLAUSULA 5 — OBRIGACOES DO CONTRATANTE ---

5.1. Fornecer informacoes precisas e completas sobre o servico necessario.
5.2. Garantir acesso seguro e adequado ao local de execucao.
5.3. Efetuar os pagamentos nos prazos e valores acordados.
5.4. Avaliar os servicos prestados pela plataforma Teknikos apos a conclusao.
5.5. Comunicar eventuais problemas ou insatisfacoes em ate 48 horas apos a conclusao do servico.

--- CLAUSULA 6 — OBRIGACOES DA PRESTADORA ---

6.1. Executar os servicos com qualidade, diligencia e dentro dos prazos acordados.
6.2. Designar profissionais qualificados e devidamente equipados.
6.3. Manter sigilo sobre informacoes do CONTRATANTE obtidas durante a prestacao dos servicos.
6.4. Fornecer relatorio de execucao com fotos e descricao dos servicos realizados.

--- CLAUSULA 7 — VIGENCIA ---

7.1. Estes termos tem vigencia por prazo indeterminado a partir do aceite digital.
7.2. Qualquer das partes podera rescindir mediante comunicacao previa de 15 (quinze) dias.
7.3. A rescisao nao exime o CONTRATANTE do pagamento de servicos ja executados ou em andamento.

--- CLAUSULA 8 — DISPOSICOES FINAIS ---

8.1. O aceite digital deste termo tem plena validade juridica, conforme a Lei 14.063/2020 (assinaturas eletronicas) e o Marco Civil da Internet (Lei 12.965/2014).
8.2. Ao aceitar este termo, serao registrados a data, hora, endereco IP e identificador do dispositivo utilizado.
8.3. Fica eleito o foro da comarca da sede da PRESTADORA para dirimir quaisquer controversias oriundas destes termos.

{razao_social}, {data}

PRESTADORA: {razao_social} ({empresa})
CLIENTE: {nome} — Documento: {documento}`;

/* ── Configuração de Onboarding de Fornecedor ────────────────── */

export interface SupplierOnboardingConfig {
  enabled: boolean;
  // Envio de contrato / termos de fornecimento
  sendContractLink: boolean;
  channel: string;         // WHATSAPP | EMAIL
  contractName: string;
  contractContent: string;
  requireSignature: boolean;
  requireAcceptance: boolean;
  blockUntilAccepted: boolean;
  expirationDays: number;
  expirationUnit?: 'days' | 'months' | 'years' | 'indefinite';
  notifyMessage: string;
  // Mensagem de boas-vindas
  sendWelcomeMessage: boolean;
  welcomeChannel: string;
  welcomeMessage: string;
  welcomeWaitForReply: boolean;
  welcomeConfirmVia: string;
  // Resposta do fornecedor
  welcomeReplyMessage: string;
  welcomeDeclineActions: string[];
  welcomeDeclineMessage: string;
  welcomePositiveKeywords: string[];
  welcomeNegativeKeywords: string[];
}

const DEFAULT_SUPPLIER_CONTRACT = `CONTRATO DE FORNECIMENTO DE MATERIAIS E SERVICOS

CONTRATANTE: {razao_social}, nome fantasia {empresa}, inscrita no CNPJ sob n. {cnpj_empresa}, com sede em {endereco_empresa}, neste ato representada por seus administradores legais.

FORNECEDOR(A): {nome}, portador(a) do documento n. {documento}, doravante denominado(a) FORNECEDOR(A).

As partes acima qualificadas celebram o presente Contrato de Fornecimento, que se regera pelas clausulas e condicoes a seguir.

--- CLAUSULA 1 — OBJETO ---

1.1. O presente contrato tem por objeto o fornecimento de materiais, pecas, equipamentos e/ou servicos pelo(a) FORNECEDOR(A) em favor da CONTRATANTE, conforme pedidos de compra emitidos pela plataforma Tecnikos.

1.2. Os pedidos serao formalizados por meio de Ordens de Compra (OC) contendo descricao dos itens, quantidades, valores unitarios, prazo de entrega e local de entrega.

1.3. O(A) FORNECEDOR(A) podera aceitar ou recusar pedidos, devendo comunicar a decisao em ate 24 horas apos o recebimento da OC.

--- CLAUSULA 2 — OBRIGACOES DO(A) FORNECEDOR(A) ---

2.1. Fornecer materiais e pecas originais, de qualidade comprovada e em conformidade com as especificacoes tecnicas solicitadas.
2.2. Cumprir os prazos de entrega estipulados em cada Ordem de Compra.
2.3. Emitir nota fiscal para cada fornecimento, conforme legislacao vigente.
2.4. Garantir a procedencia e a qualidade dos produtos fornecidos, substituindo itens defeituosos sem custo adicional.
2.5. Manter sigilo sobre informacoes comerciais da CONTRATANTE, incluindo precos, volumes e dados de clientes.
2.6. Comunicar imediatamente qualquer impedimento ou atraso na entrega dos materiais solicitados.
2.7. Disponibilizar catalogo atualizado de produtos e precos quando solicitado.
2.8. Aceitar devolucoes de materiais com defeito em ate 30 dias apos o recebimento, sem custo para a CONTRATANTE.

--- CLAUSULA 3 — OBRIGACOES DA CONTRATANTE ---

3.1. Emitir pedidos de compra claros e detalhados, com especificacoes tecnicas adequadas.
3.2. Efetuar os pagamentos nos prazos e valores acordados em cada Ordem de Compra.
3.3. Conferir os materiais no ato do recebimento e comunicar divergencias em ate 48 horas.
3.4. Fornecer previsao de demanda quando possivel, facilitando o planejamento do(a) FORNECEDOR(A).

--- CLAUSULA 4 — PRECOS E PAGAMENTO ---

4.1. Os precos serao os constantes na tabela vigente do(a) FORNECEDOR(A), podendo ser negociados caso a caso em cada Ordem de Compra.
4.2. O pagamento sera realizado conforme condicoes definidas em cada OC (a vista, 15, 30 ou 60 dias).
4.3. Os pagamentos serao efetuados via transferencia bancaria, PIX ou boleto bancario.
4.4. Reajustes de precos deverao ser comunicados com antecedencia minima de 30 dias.

--- CLAUSULA 5 — GARANTIA DOS PRODUTOS ---

5.1. Os produtos fornecidos terao garantia minima conforme legislacao do consumidor e especificacoes do fabricante.
5.2. Produtos com defeito de fabricacao serao substituidos sem custo adicional em ate 15 dias uteis.
5.3. A garantia nao cobre danos causados por mau uso, instalacao incorreta ou modificacoes nao autorizadas.

--- CLAUSULA 6 — VIGENCIA ---

6.1. Este contrato tem vigencia por prazo indeterminado a partir do aceite digital.
6.2. Qualquer das partes podera rescindir mediante comunicacao previa de 30 (trinta) dias.
6.3. A rescisao nao exime as partes do cumprimento de obrigacoes ja assumidas (pedidos em andamento, pagamentos pendentes).

--- CLAUSULA 7 — DISPOSICOES FINAIS ---

7.1. O aceite digital deste termo tem plena validade juridica, conforme a Lei 14.063/2020 (assinaturas eletronicas) e o Marco Civil da Internet (Lei 12.965/2014).
7.2. Ao aceitar este termo, serao registrados a data, hora, endereco IP e identificador do dispositivo utilizado.
7.3. Fica eleito o foro da comarca da sede da CONTRATANTE para dirimir quaisquer controversias oriundas deste contrato.

{razao_social}, {data}

CONTRATANTE: {razao_social} ({empresa})
FORNECEDOR(A): {nome} — Documento: {documento}`;

export function createDefaultSupplierOnboarding(): SupplierOnboardingConfig {
  return {
    enabled: false,
    sendContractLink: false,
    channel: 'WHATSAPP',
    contractName: 'Contrato de Fornecimento',
    contractContent: DEFAULT_SUPPLIER_CONTRACT,
    requireSignature: false,
    requireAcceptance: true,
    blockUntilAccepted: false,
    expirationDays: 30,
    expirationUnit: 'days',
    notifyMessage: 'Ola {nome}! Voce foi cadastrado(a) como fornecedor da {empresa} ({razao_social}). Para formalizar nossa parceria, preparamos um contrato de fornecimento. Acesse o link abaixo para visualizar e aceitar os termos.',
    sendWelcomeMessage: false,
    welcomeChannel: 'WHATSAPP',
    welcomeMessage: 'Ola {nome}, seja bem-vindo(a) como fornecedor parceiro da {empresa} ({razao_social})! A partir de agora voce podera receber pedidos de materiais e pecas pela nossa plataforma Teknikos. Estamos felizes em contar com voce como parceiro. Para confirmar seu cadastro, responda com "Sim, confirmo".',
    welcomeWaitForReply: true,
    welcomeConfirmVia: 'WHATSAPP',
    welcomeReplyMessage: 'Perfeito {nome}! Seu cadastro como fornecedor da {razao_social} esta confirmado. A partir de agora voce podera receber pedidos pela plataforma. Qualquer duvida entre em contato pelo {telefone}. Seja bem-vindo(a)!',
    welcomeDeclineActions: ['NOTIFY_GESTOR'],
    welcomeDeclineMessage: 'Atencao: o fornecedor {nome} ({email}) recusou o cadastro. Resposta recebida: "{resposta}". O cadastro foi mantido como pendente.',
    welcomePositiveKeywords: ['sim', 'aceito', 'confirmo', 'ok', 'pode ser', 'quero', 'topo', 'bora'],
    welcomeNegativeKeywords: ['nao', 'não', 'recuso', 'desisto', 'nao quero', 'não quero', 'cancela'],
  };
}

export function createDefaultClientOnboarding(): ClientOnboardingConfig {
  return {
    enabled: false,
    sendContractLink: false,
    channel: 'WHATSAPP',
    contractName: 'Termos de Prestacao de Servicos',
    contractContent: DEFAULT_CLIENT_CONTRACT,
    requireSignature: false,
    requireAcceptance: true,
    blockUntilAccepted: false,
    expirationDays: 30,
    expirationUnit: 'days',
    notifyMessage: 'Ola {nome}! Voce foi cadastrado(a) como cliente da {empresa} ({razao_social}). Para formalizar nossa relacao, preparamos os termos de prestacao de servicos. Acesse o link abaixo para visualizar e aceitar os termos.',
    sendWelcomeMessage: false,
    welcomeChannel: 'WHATSAPP',
    welcomeMessage: 'Ola {nome}, seja bem-vindo(a) como cliente da {empresa} ({razao_social})! A partir de agora voce podera solicitar servicos tecnicos pela nossa plataforma Teknikos. Estamos a disposicao para atende-lo(a) com qualidade e agilidade. Para confirmar seu cadastro, responda com "Sim, confirmo".',
    welcomeWaitForReply: true,
    welcomeConfirmVia: 'WHATSAPP',
    welcomeReplyMessage: 'Perfeito {nome}! Seu cadastro como cliente da {razao_social} esta confirmado. A partir de agora voce podera solicitar servicos tecnicos pela plataforma. Qualquer duvida entre em contato pelo {telefone}. Seja bem-vindo(a)!',
    welcomeDeclineActions: ['NOTIFY_GESTOR'],
    welcomeDeclineMessage: 'Atencao: o cliente {nome} ({email}) recusou o cadastro. Resposta recebida: "{resposta}". O cadastro foi mantido como pendente.',
    welcomePositiveKeywords: ['sim', 'aceito', 'confirmo', 'ok', 'pode ser', 'quero', 'topo', 'bora'],
    welcomeNegativeKeywords: ['nao', 'não', 'recuso', 'desisto', 'nao quero', 'não quero', 'cancela'],
  };
}

export interface WorkflowFormConfig {
  name: string;
  isDefault: boolean;
  trigger: TriggerDefinition;
  stages: StageConfig[];
  technicianOnboarding: TechnicianOnboardingConfig;
  clientOnboarding: ClientOnboardingConfig;
  supplierOnboarding: SupplierOnboardingConfig;
}

/* ── Gatilho (Trigger) ─────────────────────────────────────── */

export interface TriggerDefinition {
  id: string;
  entity: string;    // SERVICE_ORDER | QUOTE | PARTNER
  event: string;
  label: string;
  icon: string;
  description: string;
}

export const TRIGGER_OPTIONS: TriggerDefinition[] = [
  { id: 'os_created',               entity: 'SERVICE_ORDER', event: 'created',          icon: '📋', label: 'Uma OS é criada',                      description: 'Quando uma nova ordem de serviço é aberta' },
  { id: 'os_return_created',        entity: 'SERVICE_ORDER', event: 'return_created',   icon: '🔄', label: 'Uma OS de retorno é criada',             description: 'Quando uma OS de retorno/revisita é criada' },
  { id: 'os_urgent_created',        entity: 'SERVICE_ORDER', event: 'urgent_created',   icon: '🚨', label: 'Uma OS urgente é criada',                description: 'Quando uma OS marcada como urgente é criada' },
  { id: 'quote_request_created',    entity: 'QUOTE',         event: 'request_created',  icon: '📩', label: 'Uma solicitação de orçamento é criada', description: 'Quando o cliente solicita um orçamento' },
  { id: 'quote_created',            entity: 'QUOTE',         event: 'created',          icon: '📝', label: 'Um orçamento é criado',                 description: 'Quando um orçamento é gerado/salvo' },
  { id: 'partner_client_created',   entity: 'PARTNER',       event: 'client_created',   icon: '👤', label: 'Um cliente é criado',                   description: 'Quando um parceiro tipo cliente é cadastrado' },
  { id: 'partner_tech_created',     entity: 'PARTNER',       event: 'tech_created',     icon: '👷', label: 'Um técnico é criado',                   description: 'Quando um parceiro tipo técnico é cadastrado' },
  { id: 'partner_spec_added',      entity: 'PARTNER',       event: 'spec_added',       icon: '🔧', label: 'Um técnico recebe nova especialização', description: 'Quando uma nova especialização é atribuída ao técnico' },
  { id: 'partner_supplier_created', entity: 'PARTNER',       event: 'supplier_created', icon: '🏭', label: 'Um fornecedor é criado',                description: 'Quando um parceiro tipo fornecedor é cadastrado' },
];

/* ── Constantes ────────────────────────────────────────────── */

export const OS_STATUSES = [
  { status: 'ABERTA',      label: 'Aberta',       icon: '📋' },
  { status: 'OFERTADA',    label: 'Ofertada',     icon: '📤' },
  { status: 'ATRIBUIDA',   label: 'Atribuída',    icon: '👤' },
  { status: 'A_CAMINHO',   label: 'A Caminho',    icon: '🚗' },
  { status: 'EM_EXECUCAO', label: 'Em Execução',  icon: '🔧' },
  { status: 'CONCLUIDA',   label: 'Concluída',    icon: '✅' },
  { status: 'APROVADA',    label: 'Aprovada',     icon: '⭐' },
] as const;

export const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms',      label: 'SMS' },
  { value: 'email',    label: 'E-mail' },
  { value: 'push',     label: 'Push' },
];

export const SEVERITY_OPTIONS = [
  { value: 'info',    label: 'Informação' },
  { value: 'warning', label: 'Aviso' },
  { value: 'error',   label: 'Urgente' },
];

export const STRATEGY_OPTIONS = [
  { value: 'BEST_RATING', label: 'Melhor avaliado' },
  { value: 'LEAST_BUSY',  label: 'Menos ocupado' },
];

export const TECH_SELECTION_METHODS = [
  { value: 'BY_SPECIALIZATION', label: 'Todos com a especialização da OS', hint: 'Oferta para técnicos que tenham a especialização requerida' },
  { value: 'DIRECTED',          label: 'Técnicos direcionados',            hint: 'Seleciona manualmente na OS quais técnicos receberão' },
  { value: 'BEST_RATING',       label: 'Melhor avaliado',                  hint: 'Atribui ao técnico com melhor avaliação disponível' },
  { value: 'LEAST_BUSY',        label: 'Menos ocupado',                    hint: 'Atribui ao técnico com menos OS em andamento' },
  { value: 'NEAREST',           label: 'Mais próximo (GPS)',               hint: 'Atribui ao técnico mais perto do endereço da OS' },
];

export const ON_TIMEOUT_OPTIONS = [
  { value: 'notify_gestor', label: 'Notificar o gestor' },
  { value: 'reassign',      label: 'Redistribuir para outros técnicos' },
  { value: 'cancel',        label: 'Cancelar a OS' },
];

export const ON_DECLINE_OPTIONS = [
  { value: 'notify_gestor',  label: 'Notificar o gestor' },
  { value: 'reassign',       label: 'Redistribuir para outros técnicos' },
  { value: 'return_offered', label: 'Voltar para fila (status Ofertada)' },
  { value: 'cancel',         label: 'Cancelar a OS' },
];

export const KEEP_ACTIVE_OPTIONS = [
  { value: 'radius',        label: 'Até entrar no raio de proximidade', hint: 'GPS desliga quando o técnico chega perto do endereço' },
  { value: 'execution_end', label: 'Até o final do atendimento',        hint: 'GPS fica ativo durante todo o atendimento (A Caminho + Em Execução + Concluída)' },
];

export const PHOTO_TYPE_OPTIONS = [
  { value: 'before',  label: 'Antes' },
  { value: 'during',  label: 'Durante' },
  { value: 'after',   label: 'Depois' },
  { value: 'general', label: 'Geral' },
];

export const PHOTO_MOMENT_OPTIONS = [
  { value: 'before_start',    label: 'Antes de iniciar',   hint: 'Fotos obrigatórias antes de começar o serviço' },
  { value: 'after_completion', label: 'Após concluir',     hint: 'Fotos obrigatórias depois de finalizar o serviço' },
  { value: 'on_pause',        label: 'Ao pausar',          hint: 'Fotos do estado ao pausar (requer sistema de pausas)' },
  { value: 'on_resume',       label: 'Ao retomar',         hint: 'Fotos do estado ao retomar (requer sistema de pausas)' },
  { value: 'general',         label: 'A qualquer momento', hint: 'Fotos sem momento específico — técnico envia quando quiser' },
];

export const FINANCIAL_ENTRY_TYPES = [
  { value: 'contas_receber',  label: 'Contas a Receber',    icon: '💰', hint: 'Valor a receber do cliente' },
  { value: 'contas_pagar',    label: 'Contas a Pagar',      icon: '💸', hint: 'Valor a pagar (fornecedor, serviço terceiro)' },
  { value: 'comissao',        label: 'Comissão do Técnico',  icon: '👷', hint: 'Comissão do técnico pela execução' },
  { value: 'custo',           label: 'Custo Operacional',    icon: '📊', hint: 'Custo de materiais, deslocamento, etc.' },
  { value: 'taxa',            label: 'Taxa/Imposto',         icon: '🏛️', hint: 'Taxas, impostos ou retenções' },
  { value: 'desconto',        label: 'Desconto',             icon: '🏷️', hint: 'Desconto aplicado ao cliente' },
  { value: 'custom',          label: 'Personalizado',        icon: '📝', hint: 'Lançamento com tipo livre' },
];

export const FINANCIAL_VALUE_SOURCES = [
  { value: 'os_value',        label: 'Valor total da OS',       hint: 'Usa o valor total registrado na OS' },
  { value: 'os_commission',   label: 'Valor da comissão da OS', hint: 'Usa a comissão configurada na OS' },
  { value: 'materials_total', label: 'Total de materiais',      hint: 'Soma dos materiais registrados pelo técnico' },
  { value: 'percent_os',      label: 'Percentual do valor da OS', hint: 'Calcula % sobre o valor total da OS' },
  { value: 'fixed',           label: 'Valor fixo',              hint: 'Valor predefinido no workflow' },
  { value: 'manual',          label: 'Manual (gestor define)',   hint: 'Gestor informa o valor na aprovação' },
];

export const PAUSE_REASON_CATEGORIES = [
  { value: 'meal_break',             label: 'Intervalo para refeição',       icon: '🍽️', hint: 'Almoço, lanche, janta' },
  { value: 'end_of_day',             label: 'Encerramento do expediente',    icon: '🌙', hint: 'Final do dia, retorna amanhã' },
  { value: 'fetch_materials',        label: 'Buscar material/peças',         icon: '🔧', hint: 'Precisa sair para buscar suprimentos' },
  { value: 'weather',                label: 'Condições climáticas',          icon: '🌧️', hint: 'Chuva, tempestade, calor extremo' },
  { value: 'waiting_client',         label: 'Aguardando cliente',            icon: '⏳', hint: 'Cliente ausente, retorna em horário marcado' },
  { value: 'waiting_utilities',      label: 'Aguardando energia/utilidades', icon: '🔌', hint: 'Sem luz, sem água, sem internet' },
  { value: 'waiting_access',         label: 'Aguardando liberação de acesso', icon: '🚧', hint: 'Área restrita, segurança, permissão' },
  { value: 'waiting_other_service',  label: 'Aguardando outro serviço',      icon: '🛠️', hint: 'Outra equipe precisa terminar primeiro' },
  { value: 'personal',               label: 'Motivo pessoal',               icon: '🏥', hint: 'Necessidade pessoal do técnico' },
  { value: 'other',                  label: 'Outro',                         icon: '📝', hint: 'Motivo livre (texto obrigatório)' },
];

export const COMMISSION_ADJUSTMENT_TYPES = [
  { value: 'reduce_percent', label: 'Reduzir em percentual (%)',  hint: 'Desconta X% da comissão original' },
  { value: 'reduce_fixed',   label: 'Reduzir valor fixo (R$)',    hint: 'Desconta um valor fixo da comissão' },
];

export const GESTOR_REJECT_ACTIONS = [
  { value: 'reopen_execution', label: 'Retornar para Execução',       hint: 'Técnico refaz o serviço (volta para EM_EXECUÇÃO)' },
  { value: 'return_assigned',  label: 'Retornar para Atribuída',       hint: 'Volta o técnico ao início (recomeça deslocamento)' },
  { value: 'notify_only',      label: 'Apenas notificar (manter aqui)', hint: 'Mantém na CONCLUÍDA e notifica técnico para resolver' },
];

export const TRIGGER_CONDITIONS = [
  { value: 'os_assigned',       label: 'Técnico aceitar a OS' },
  { value: 'os_status_changed', label: 'Status da OS mudar' },
  { value: 'os_completed',      label: 'OS ser concluída' },
  { value: 'os_approved',       label: 'OS ser aprovada' },
];

export const TIMEOUT_ACTIONS = [
  { value: 'continue', label: 'Continuar fluxo' },
  { value: 'cancel',   label: 'Encerrar fluxo' },
];

/* ── Notify template variables ─────────────────────────────── */

export const NOTIFY_VARS = [
  { var: '{titulo}',           label: 'Título da OS' },
  { var: '{status}',           label: 'Status atual' },
  { var: '{valor}',            label: 'Valor total' },
  { var: '{comissao}',         label: 'Valor comissão' },
  { var: '{endereco}',         label: 'Endereço completo' },
  { var: '{cidade}',           label: 'Cidade' },
  { var: '{prazo}',            label: 'Prazo' },
  { var: '{cliente}',          label: 'Nome do cliente' },
  { var: '{tecnico}',          label: 'Nome do técnico' },
  { var: '{contato_local}',    label: 'Contato no local' },
  { var: '{empresa}',          label: 'Nome da empresa' },
  { var: '{tempo_aceitar}',    label: 'Tempo para aceitar' },
  { var: '{tempo_a_caminho}',  label: 'Tempo para clicar a caminho' },
  { var: '{tempo_estimado_chegada}', label: 'Tempo estimado de chegada (técnico)' },
  { var: '{distancia_tecnico}',      label: 'Distância atual do técnico' },
  { var: '{pausas}',                 label: 'Número de pausas realizadas' },
  { var: '{tempo_pausado}',          label: 'Tempo total pausado' },
  { var: '{motivo_pausa}',           label: 'Motivo da última pausa' },
  { var: '{motivo_rejeicao}',       label: 'Motivo da rejeição do gestor' },
  { var: '{ressalvas}',             label: 'Ressalvas do gestor na aprovação' },
];

/* ── Labels de ações (PT-BR) ──────────────────────────────── */

export const TECH_ACTION_LABELS: Record<string, { label: string; icon: string; hint: string }> = {
  step:      { label: 'Registrar atividade',      icon: '⚙️', hint: 'Etapa genérica com foto/nota/GPS opcionais' },
  photo:     { label: 'Tirar fotos obrigatórias',  icon: '📸', hint: 'Exige fotos do técnico (antes, depois, etc.)' },
  note:      { label: 'Escrever observação',       icon: '📝', hint: 'Campo de texto para observações' },
  gps:       { label: 'Capturar localização GPS',  icon: '📍', hint: 'Registra coordenadas do técnico' },
  checklist: { label: 'Preencher checklist',       icon: '☑️', hint: 'Lista de itens para verificar' },
  form:      { label: 'Preencher formulário',      icon: '📋', hint: 'Campos personalizados (texto, número, seleção)' },
  signature:         { label: 'Coletar assinatura',            icon: '✍️', hint: 'Assinatura digital do cliente ou técnico' },
  question:          { label: 'Responder pergunta',            icon: '❓', hint: 'Pergunta com opções de resposta' },
  photoRequirements: { label: 'Fotos por momento',             icon: '📷', hint: 'Múltiplos grupos de fotos (antes, depois, pausa, retorno)' },
  materials:         { label: 'Registrar materiais utilizados', icon: '🔩', hint: 'Técnico informa materiais/peças usados no serviço' },
};

export const AUTO_ACTION_LABELS: Record<string, { label: string; icon: string; hint: string }> = {
  notifyGestor:   { label: 'Notificar gestor',                 icon: '👔', hint: 'Envia mensagem para o gestor/admin' },
  notifyTecnico:  { label: 'Notificar técnico',                icon: '👷', hint: 'Envia mensagem para o técnico atribuído' },
  notifyCliente:  { label: 'Notificar cliente',                icon: '👤', hint: 'Envia mensagem para o cliente da OS' },
  financialEntry: { label: 'Lançar financeiro',                icon: '💰', hint: 'Cria lançamento financeiro automático' },
  alert:          { label: 'Enviar alerta',                    icon: '🔔', hint: 'Cria uma notificação visual no painel do gestor (ex: "OS urgente criada")' },
  webhook:        { label: 'Webhook externo',                  icon: '🔗', hint: 'Envia os dados da OS para outro sistema via URL (integração com ERP, BI, etc.)' },
  assignTech:     { label: 'Atribuir técnico automaticamente', icon: '🎯', hint: 'Auto-atribui técnico por avaliação ou disponibilidade' },
  duplicateOS:    { label: 'Duplicar OS',                      icon: '📑', hint: 'Cria cópia da ordem de serviço' },
  scheduleConfig:    { label: 'Regime de agenda',                 icon: '📅', hint: 'Despacho manual com data/hora agendada' },
  techReviewScreen:  { label: 'Revisão de técnicos',              icon: '👁️', hint: 'Tela de revisão dos técnicos antes do disparo' },
  gestorApproval: { label: 'Aprovação do gestor',              icon: '👔', hint: 'Gestor analisa e aprova/reprova a conclusão' },
};

export const TIME_CONTROL_LABELS: Record<string, { label: string; icon: string; hint: string }> = {
  sla:            { label: 'Tempo máximo nesta etapa (SLA)', icon: '⏱️', hint: 'Define prazo máximo para completar esta etapa' },
  waitFor:        { label: 'Aguardar evento',                icon: '⏸️', hint: 'Pausa o fluxo até evento ou timeout' },
  delay:          { label: 'Atraso entre etapas',            icon: '⏳', hint: 'Aguarda X minutos antes de prosseguir' },
  executionTimer: { label: 'Cronômetro de execução',         icon: '⏲️', hint: 'Mede tempo efetivo de execução (descontando pausas futuras)' },
};

/* ── Factory ───────────────────────────────────────────────── */

function createEmptyStage(status: string, label: string, icon: string): StageConfig {
  return {
    id: `stage_${status.toLowerCase()}`,
    status,
    label,
    icon,
    enabled: false,
    techActions: {
      step:      { enabled: false, description: '', requirePhoto: false, requireNote: false, requireGPS: false },
      photo:     { enabled: false, minPhotos: 1, label: 'Foto', photoType: 'general' },
      note:      { enabled: false, placeholder: 'Observações...' },
      gps:       { enabled: false, requireAccuracy: false },
      checklist: { enabled: false, items: [] },
      form:      { enabled: false, fields: [] },
      signature: { enabled: false, label: 'Assinatura do cliente' },
      question:  { enabled: false, question: '', options: [] },
      photoRequirements: { enabled: false, groups: [] },
      materials: { enabled: false, label: 'Materiais utilizados', requireQuantity: true, requireUnitCost: false },
    },
    autoActions: {
      notifyGestor:   { enabled: false, channel: 'whatsapp', message: '' },
      notifyTecnico:  { enabled: false, channel: 'whatsapp', message: '', includeLink: false },
      notifyCliente:  { enabled: false, channel: 'sms', message: '' },
      financialEntry: { enabled: false, entries: [] },
      alert:          { enabled: false, message: '', severity: 'info' },
      webhook:        { enabled: false, url: '' },
      assignTech:     { enabled: false, strategy: 'BEST_RATING' },
      duplicateOS:    { enabled: false },
      gestorApproval: {
        enabled: false,
        reviewChecklist: ['Verificar fotos do serviço', 'Conferir checklist do técnico', 'Revisar materiais utilizados'],
        onApprove: {
          notifyTecnico: { enabled: true,  channel: 'push',     message: '✅ Seu serviço "{titulo}" foi aprovado pelo gestor!' },
          notifyCliente: { enabled: false, channel: 'sms',      message: 'Seu serviço "{titulo}" foi finalizado com sucesso. Obrigado!' },
        },
        onApproveWithReservations: {
          enabled: true,
          requireNote: true,
          commissionAdjustment: { enabled: false, type: 'reduce_percent', value: 10 },
          flagOS: true,
          notifyTecnico: { enabled: true,  channel: 'whatsapp', message: '⚠️ Serviço "{titulo}" aprovado com ressalvas: {ressalvas}. Atenção para os próximos atendimentos.' },
          notifyCliente: { enabled: false, channel: 'sms',      message: '' },
        },
        onReject: {
          action: 'reopen_execution',
          requireReason: true,
          notifyTecnico: { enabled: true,  channel: 'whatsapp', message: '❌ Serviço "{titulo}" reprovado. Motivo: {motivo_rejeicao}. Retorne ao local para corrigir.' },
          notifyCliente: { enabled: false, channel: 'sms',      message: '' },
        },
      },
      techSelection: {
        enabled: false, method: 'BY_SPECIALIZATION', maxTechnicians: 5,
        acceptTimeout: { mode: 'fixed', value: 60, unit: 'minutes' },
        enRouteTimeout: { mode: 'fixed', value: 30, unit: 'minutes' },
        onTimeout: 'notify_gestor', filterBySpecialization: true,
        discardBusyTechnicians: true,
      },
      techReviewScreen: {
        enabled: false,
        allowEdit: false,
      },
      messageDispatch: {
        enabled: false,
        toTechnicians: {
          enabled: true, channel: 'whatsapp',
          message: 'Nova OS disponível: {titulo}. Endereço: {endereco}. Valor comissão: {comissao}',
          link: {
            enabled: true,
            validityHours: 24,
            acceptOS: true,
            gpsNavigation: false,
            pageLayout: [
              { id: 'bl_01', type: 'info', field: 'title',       label: 'Título da OS',        enabled: true },
              { id: 'bl_02', type: 'info', field: 'address',     label: 'Endereço',            enabled: true },
              { id: 'bl_03', type: 'info', field: 'commission',  label: 'Valor da comissão',   enabled: true },
              { id: 'bl_04', type: 'info', field: 'value',       label: 'Valor total da OS',   enabled: false },
              { id: 'bl_05', type: 'info', field: 'deadline',    label: 'Prazo de execução',   enabled: true },
              { id: 'bl_06', type: 'info', field: 'clientName',  label: 'Nome do cliente',     enabled: false },
              { id: 'bl_07', type: 'info', field: 'contact',     label: 'Contato no local',    enabled: false },
              { id: 'bl_08', type: 'info', field: 'description', label: 'Descrição do serviço',enabled: false },
              { id: 'bl_09', type: 'info', field: 'city',        label: 'Cidade',              enabled: false },
              { id: 'bl_10', type: 'info', field: 'company',     label: 'Nome da empresa',     enabled: false },
              { id: 'bl_11', type: 'text', label: 'Texto livre 1', content: '', enabled: false },
              { id: 'bl_12', type: 'text', label: 'Texto livre 2', content: '', enabled: false },
              { id: 'bl_13', type: 'text', label: 'Texto livre 3', content: '', enabled: false },
            ],
          },
        },
        toGestor:  { enabled: false, channel: 'whatsapp', message: 'OS {titulo} foi aberta e enviada para técnicos' },
        toCliente: { enabled: false, channel: 'sms', message: 'Sua solicitação {titulo} foi recebida. Em breve um técnico será designado.' },
      },
      techQuestion: {
        enabled: false,
        question: 'Você tem disponibilidade para atender esta OS?',
        options: [
          { label: 'Sim, aceito', action: 'accept' },
          { label: 'Não posso atender', action: 'reject' },
          { label: 'Posso em outro horário', action: 'notify_gestor' },
        ],
        required: true,
        showOnLinkPage: true,
      },
      arrivalQuestion: {
        enabled: false,
        question: 'Quanto tempo até você estar a caminho?',
        options: [
          { label: '15 minutos', minutes: 15 },
          { label: '30 minutos', minutes: 30 },
          { label: '1 hora', minutes: 60 },
          { label: '2 horas', minutes: 120 },
        ],
        useAsDynamicTimeout: false,
        notifyCliente: false,
        notifyGestor: false,
        onDecline: 'notify_gestor',
      },
      proximityTrigger: {
        enabled: false,
        radiusMeters: 200,
        trackingIntervalSeconds: 30,
        requireHighAccuracy: true,
        keepActiveUntil: 'radius',
        onEnterRadius: {
          notifyCliente:      { enabled: true,  channel: 'whatsapp', message: 'O técnico {tecnico} está chegando! OS: {titulo}' },
          notifyGestor:       { enabled: false, channel: 'push',     message: '' },
          autoStartExecution: false,
          alert:              { enabled: false, message: '' },
        },
      },
      scheduleConfig: {
        enabled: false,
        defaultDurationMinutes: 60,
        workingHours: { start: '08:00', end: '18:00' },
        workingDays: [1, 2, 3, 4, 5],
        notifyTechnician: {
          enabled: true,
          channel: 'whatsapp',
          message: 'Ola {nome}, voce tem um servico agendado para {data_agendamento} — {titulo} ({cliente}). Endereco: {endereco}',
          minutesBefore: 30,
        },
      },
    },
    timeControl: {
      sla:     { enabled: false, maxMinutes: 120, alertOnExceed: true },
      waitFor: { enabled: false, timeoutMinutes: 60, triggerConditions: [], targetStatus: '', timeoutAction: 'continue' },
      delay:   { enabled: false, minutes: 30 },
      executionTimer: { enabled: false, showToTech: true, pauseDiscountsFromSla: true },
      pauseSystem: {
        enabled: false,
        maxPauses: 0,
        maxPauseDurationMinutes: 0,
        requireReason: true,
        allowedReasons: PAUSE_REASON_CATEGORIES.map(c => c.value),
        notifications: {
          onPause: {
            gestor:  { enabled: true,  channel: 'whatsapp', message: 'O técnico {tecnico} pausou a OS "{titulo}". Motivo: {motivo_pausa}. Pausas: {pausas}.' },
            cliente: { enabled: false, channel: 'sms',      message: '' },
            tecnico: { enabled: false, channel: 'push',     message: '' },
          },
          onResume: {
            gestor:  { enabled: false, channel: 'whatsapp', message: 'O técnico {tecnico} retomou a OS "{titulo}". Tempo pausado: {tempo_pausado}.' },
            cliente: { enabled: false, channel: 'sms',      message: '' },
            tecnico: { enabled: false, channel: 'push',     message: '' },
          },
        },
      },
    },
  };
}

export function createDefaultConfig(): WorkflowFormConfig {
  return {
    name: '',
    isDefault: false,
    trigger: TRIGGER_OPTIONS[0],
    stages: OS_STATUSES.map(s => createEmptyStage(s.status, s.label, s.icon)),
    technicianOnboarding: createDefaultOnboarding(),
    clientOnboarding: createDefaultClientOnboarding(),
    supplierOnboarding: createDefaultSupplierOnboarding(),
  };
}

/* ── Presets (modelos prontos) ─────────────────────────────── */

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply: (config: WorkflowFormConfig) => WorkflowFormConfig;
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'blank',
    name: 'Começar do Zero',
    description: 'Todas as etapas desativadas',
    icon: '📄',
    apply: () => createDefaultConfig(),
  },
  {
    id: 'instalacao',
    name: 'Instalação Padrão',
    description: 'Fluxo completo com foto antes/depois, checklist e assinatura',
    icon: '🔌',
    apply: (cfg) => {
      const c = createDefaultConfig();
      c.name = cfg.name;
      c.trigger = TRIGGER_OPTIONS[0];
      // ATRIBUIDA
      const atrib = c.stages.find(s => s.status === 'ATRIBUIDA')!;
      atrib.enabled = true;
      atrib.autoActions.notifyTecnico = { enabled: true, channel: 'whatsapp', message: 'Você foi atribuído à OS {titulo}. Endereço: {endereco}', includeLink: true };
      // A_CAMINHO
      const caminho = c.stages.find(s => s.status === 'A_CAMINHO')!;
      caminho.enabled = true;
      caminho.techActions.gps = { enabled: true, requireAccuracy: false };
      caminho.autoActions.notifyCliente = { enabled: true, channel: 'sms', message: 'O técnico está a caminho. OS: {titulo}' };
      caminho.autoActions.proximityTrigger = {
        ...caminho.autoActions.proximityTrigger,
        enabled: true, radiusMeters: 200, keepActiveUntil: 'radius',
        onEnterRadius: { ...caminho.autoActions.proximityTrigger.onEnterRadius, notifyCliente: { enabled: true, channel: 'whatsapp', message: 'O técnico {tecnico} está chegando! OS: {titulo}' } },
      };
      // EM_EXECUCAO
      const exec = c.stages.find(s => s.status === 'EM_EXECUCAO')!;
      exec.enabled = true;
      exec.techActions.photoRequirements = { enabled: true, groups: [
        { id: 'pr_before', moment: 'before_start', minPhotos: 1, maxPhotos: 0, label: 'Foto antes da instalação', instructions: 'Registre o local antes de iniciar', required: true },
        { id: 'pr_after', moment: 'after_completion', minPhotos: 2, maxPhotos: 0, label: 'Fotos após instalação', instructions: 'Registre o equipamento instalado e área limpa', required: true },
      ]};
      exec.techActions.checklist = { enabled: true, items: ['Material conferido', 'Área limpa', 'Equipamento instalado', 'Teste realizado'] };
      exec.techActions.step = { enabled: true, description: 'Realizar a instalação conforme procedimento', requirePhoto: true, requireNote: true, requireGPS: false };
      exec.techActions.materials = { enabled: true, label: 'Materiais utilizados na instalação', requireQuantity: true, requireUnitCost: false };
      exec.techActions.signature = { enabled: true, label: 'Assinatura do cliente' };
      exec.timeControl.sla = { enabled: true, maxMinutes: 240, alertOnExceed: true };
      exec.timeControl.executionTimer = { enabled: true, showToTech: true, pauseDiscountsFromSla: true };
      exec.timeControl.pauseSystem = {
        ...exec.timeControl.pauseSystem,
        enabled: true, requireReason: true,
        notifications: {
          onPause: {
            gestor:  { enabled: true,  channel: 'whatsapp', message: 'O técnico {tecnico} pausou a OS "{titulo}". Motivo: {motivo_pausa}. Pausas: {pausas}.' },
            cliente: { enabled: false, channel: 'sms',      message: '' },
            tecnico: { enabled: false, channel: 'push',     message: '' },
          },
          onResume: {
            gestor:  { enabled: true,  channel: 'whatsapp', message: 'O técnico {tecnico} retomou a OS "{titulo}". Tempo pausado: {tempo_pausado}.' },
            cliente: { enabled: false, channel: 'sms',      message: '' },
            tecnico: { enabled: false, channel: 'push',     message: '' },
          },
        },
      };
      // Fotos de pausa configuradas via photoRequirements
      exec.techActions.photoRequirements.groups.push(
        { id: 'pr_pause', moment: 'on_pause', minPhotos: 1, maxPhotos: 0, label: 'Fotos ao pausar', instructions: 'Registre o estado do serviço antes de pausar', required: true },
        { id: 'pr_resume', moment: 'on_resume', minPhotos: 1, maxPhotos: 0, label: 'Fotos ao retomar', instructions: 'Registre o estado antes de retomar o serviço', required: true },
      );
      // CONCLUIDA
      const conc = c.stages.find(s => s.status === 'CONCLUIDA')!;
      conc.enabled = true;
      conc.autoActions.notifyGestor = { enabled: true, channel: 'whatsapp', message: 'OS {titulo} foi concluída pelo técnico {tecnico}. Aguardando sua aprovação.' };
      conc.autoActions.gestorApproval = {
        enabled: true,
        reviewChecklist: ['Verificar fotos antes/depois', 'Conferir checklist de instalação', 'Revisar materiais utilizados', 'Verificar assinatura do cliente'],
        onApprove: {
          notifyTecnico: { enabled: true, channel: 'push', message: '✅ Instalação "{titulo}" aprovada! Comissão: {comissao}' },
          notifyCliente: { enabled: true, channel: 'sms', message: 'Sua instalação "{titulo}" foi concluída e aprovada. Obrigado por escolher {empresa}!' },
        },
        onApproveWithReservations: {
          enabled: true,
          requireNote: true,
          commissionAdjustment: { enabled: true, type: 'reduce_percent', value: 10 },
          flagOS: true,
          notifyTecnico: { enabled: true, channel: 'whatsapp', message: '⚠️ Instalação "{titulo}" aprovada com ressalvas: {ressalvas}. Comissão reduzida em 10%.' },
          notifyCliente: { enabled: false, channel: 'sms', message: '' },
        },
        onReject: {
          action: 'reopen_execution',
          requireReason: true,
          notifyTecnico: { enabled: true, channel: 'whatsapp', message: '❌ Instalação "{titulo}" reprovada. Motivo: {motivo_rejeicao}. Retorne ao local para corrigir.' },
          notifyCliente: { enabled: false, channel: 'sms', message: '' },
        },
      };
      conc.autoActions.financialEntry = { enabled: true, entries: [
        { id: 'fe_receber', type: 'contas_receber', label: 'Valor a receber do cliente', valueSource: 'os_value', description: 'Faturamento pela execução do serviço', autoCreate: true },
        { id: 'fe_comissao', type: 'comissao', label: 'Comissão do técnico', valueSource: 'os_commission', description: 'Comissão pela execução', autoCreate: true },
      ]};
      return c;
    },
  },
  {
    id: 'manutencao',
    name: 'Manutenção Corretiva',
    description: 'Diagnóstico, reparo e fotos do serviço',
    icon: '🔧',
    apply: (cfg) => {
      const c = createDefaultConfig();
      c.name = cfg.name;
      c.trigger = TRIGGER_OPTIONS[0];
      // ATRIBUIDA
      const atrib = c.stages.find(s => s.status === 'ATRIBUIDA')!;
      atrib.enabled = true;
      atrib.autoActions.notifyTecnico = { enabled: true, channel: 'whatsapp', message: 'Nova manutenção: {titulo}. Local: {endereco}', includeLink: true };
      // A_CAMINHO
      const caminho = c.stages.find(s => s.status === 'A_CAMINHO')!;
      caminho.enabled = true;
      caminho.techActions.gps = { enabled: true, requireAccuracy: false };
      // EM_EXECUCAO
      const exec = c.stages.find(s => s.status === 'EM_EXECUCAO')!;
      exec.enabled = true;
      exec.techActions.photoRequirements = { enabled: true, groups: [
        { id: 'pr_before', moment: 'before_start', minPhotos: 2, maxPhotos: 0, label: 'Fotos do problema', instructions: 'Registre o estado atual do problema antes do reparo', required: true },
        { id: 'pr_after', moment: 'after_completion', minPhotos: 1, maxPhotos: 0, label: 'Foto após reparo', instructions: 'Registre o resultado do reparo', required: true },
      ]};
      exec.techActions.note = { enabled: true, placeholder: 'Descreva o diagnóstico...' };
      exec.techActions.step = { enabled: true, description: 'Executar o reparo', requirePhoto: true, requireNote: true, requireGPS: false };
      exec.techActions.materials = { enabled: true, label: 'Peças e materiais usados no reparo', requireQuantity: true, requireUnitCost: true };
      exec.timeControl.sla = { enabled: true, maxMinutes: 180, alertOnExceed: true };
      exec.timeControl.executionTimer = { enabled: true, showToTech: true, pauseDiscountsFromSla: true };
      exec.timeControl.pauseSystem = {
        ...exec.timeControl.pauseSystem,
        enabled: true, requireReason: true,
        notifications: {
          onPause: {
            gestor:  { enabled: true,  channel: 'whatsapp', message: 'Técnico pausou manutenção "{titulo}". Motivo: {motivo_pausa}. Pausas: {pausas}.' },
            cliente: { enabled: false, channel: 'sms',      message: '' },
            tecnico: { enabled: false, channel: 'push',     message: '' },
          },
          onResume: {
            gestor:  { enabled: false, channel: 'whatsapp', message: '' },
            cliente: { enabled: false, channel: 'sms',      message: '' },
            tecnico: { enabled: false, channel: 'push',     message: '' },
          },
        },
      };
      // Fotos de pausa via photoRequirements
      exec.techActions.photoRequirements.groups.push(
        { id: 'pr_pause', moment: 'on_pause', minPhotos: 1, maxPhotos: 0, label: 'Fotos ao pausar', instructions: 'Registre o estado do reparo antes de pausar', required: true },
      );
      // CONCLUIDA
      const conc = c.stages.find(s => s.status === 'CONCLUIDA')!;
      conc.enabled = true;
      conc.autoActions.notifyGestor = { enabled: true, channel: 'whatsapp', message: 'Manutenção concluída: {titulo}. Aguardando sua aprovação.' };
      conc.autoActions.gestorApproval = {
        enabled: true,
        reviewChecklist: ['Verificar fotos do problema (antes)', 'Verificar foto do reparo (depois)', 'Conferir diagnóstico e materiais', 'Revisar custos'],
        onApprove: {
          notifyTecnico: { enabled: true, channel: 'push', message: '✅ Manutenção "{titulo}" aprovada!' },
          notifyCliente: { enabled: false, channel: 'sms', message: '' },
        },
        onApproveWithReservations: {
          enabled: true,
          requireNote: true,
          commissionAdjustment: { enabled: true, type: 'reduce_percent', value: 15 },
          flagOS: true,
          notifyTecnico: { enabled: true, channel: 'whatsapp', message: '⚠️ Manutenção "{titulo}" aprovada com ressalvas: {ressalvas}. Comissão reduzida em 15%.' },
          notifyCliente: { enabled: false, channel: 'sms', message: '' },
        },
        onReject: {
          action: 'reopen_execution',
          requireReason: true,
          notifyTecnico: { enabled: true, channel: 'whatsapp', message: '❌ Manutenção "{titulo}" reprovada. Motivo: {motivo_rejeicao}.' },
          notifyCliente: { enabled: false, channel: 'sms', message: '' },
        },
      };
      conc.autoActions.financialEntry = { enabled: true, entries: [
        { id: 'fe_receber', type: 'contas_receber', label: 'Valor a receber', valueSource: 'os_value', description: 'Faturamento do reparo', autoCreate: true },
        { id: 'fe_custo', type: 'custo', label: 'Custo de materiais', valueSource: 'materials_total', description: 'Total de peças/materiais usados', autoCreate: true },
        { id: 'fe_comissao', type: 'comissao', label: 'Comissão do técnico', valueSource: 'os_commission', description: 'Comissão pela manutenção', autoCreate: true },
      ]};
      return c;
    },
  },
  {
    id: 'vistoria',
    name: 'Vistoria Técnica',
    description: 'Checklist de vistoria com formulário e GPS',
    icon: '🔍',
    apply: (cfg) => {
      const c = createDefaultConfig();
      c.name = cfg.name;
      c.trigger = TRIGGER_OPTIONS[0];
      // ATRIBUIDA
      const atrib = c.stages.find(s => s.status === 'ATRIBUIDA')!;
      atrib.enabled = true;
      atrib.autoActions.notifyTecnico = { enabled: true, channel: 'whatsapp', message: 'Vistoria agendada: {titulo}. Endereço: {endereco}', includeLink: true };
      // A_CAMINHO
      const caminho = c.stages.find(s => s.status === 'A_CAMINHO')!;
      caminho.enabled = true;
      caminho.techActions.gps = { enabled: true, requireAccuracy: true };
      caminho.autoActions.proximityTrigger = {
        ...caminho.autoActions.proximityTrigger,
        enabled: true, radiusMeters: 100, requireHighAccuracy: true, keepActiveUntil: 'execution_end',
        onEnterRadius: { ...caminho.autoActions.proximityTrigger.onEnterRadius, autoStartExecution: true, notifyCliente: { enabled: true, channel: 'whatsapp', message: 'O técnico {tecnico} está chegando para a vistoria! OS: {titulo}' } },
      };
      // EM_EXECUCAO
      const exec = c.stages.find(s => s.status === 'EM_EXECUCAO')!;
      exec.enabled = true;
      exec.techActions.checklist = { enabled: true, items: ['Estrutura', 'Elétrica', 'Hidráulica', 'Acabamento', 'Segurança'] };
      exec.techActions.photoRequirements = { enabled: true, groups: [
        { id: 'pr_vistoria', moment: 'general', minPhotos: 3, maxPhotos: 20, label: 'Fotos da vistoria', instructions: 'Registre cada item vistoriado com fotos', required: true },
        { id: 'pr_problems', moment: 'general', minPhotos: 0, maxPhotos: 0, label: 'Fotos de problemas encontrados', instructions: 'Se encontrar problemas, registre com fotos', required: false },
      ]};
      exec.techActions.form = { enabled: true, fields: [
        { name: 'Parecer técnico', type: 'text', required: true },
        { name: 'Nota geral (1-10)', type: 'number', required: true },
      ]};
      // CONCLUIDA
      const conc = c.stages.find(s => s.status === 'CONCLUIDA')!;
      conc.enabled = true;
      conc.autoActions.notifyGestor = { enabled: true, channel: 'whatsapp', message: 'Vistoria concluída: {titulo}' };
      return c;
    },
  },
  {
    id: 'urgente',
    name: 'Atendimento Urgente',
    description: 'SLA curto, auto-atribuição, notificações rápidas',
    icon: '🚨',
    apply: (cfg) => {
      const c = createDefaultConfig();
      c.name = cfg.name;
      c.trigger = TRIGGER_OPTIONS[0];
      // ABERTA
      const aberta = c.stages.find(s => s.status === 'ABERTA')!;
      aberta.enabled = true;
      aberta.autoActions.assignTech = { enabled: true, strategy: 'LEAST_BUSY' };
      aberta.autoActions.notifyGestor = { enabled: true, channel: 'whatsapp', message: '⚠️ OS URGENTE criada: {titulo}' };
      // ATRIBUIDA
      const atrib = c.stages.find(s => s.status === 'ATRIBUIDA')!;
      atrib.enabled = true;
      atrib.autoActions.notifyTecnico = { enabled: true, channel: 'whatsapp', message: '🚨 URGENTE: {titulo}. Comparecer imediatamente em {endereco}', includeLink: true };
      atrib.timeControl.waitFor = { enabled: true, timeoutMinutes: 15, triggerConditions: ['os_assigned'], targetStatus: '', timeoutAction: 'continue' };
      // EM_EXECUCAO
      const exec = c.stages.find(s => s.status === 'EM_EXECUCAO')!;
      exec.enabled = true;
      exec.techActions.step = { enabled: true, description: 'Resolver o problema urgente', requirePhoto: true, requireNote: true, requireGPS: false };
      exec.techActions.photoRequirements = { enabled: true, groups: [
        { id: 'pr_before', moment: 'before_start', minPhotos: 1, maxPhotos: 0, label: 'Foto do problema', instructions: 'Registre o problema antes de iniciar', required: true },
        { id: 'pr_after', moment: 'after_completion', minPhotos: 1, maxPhotos: 0, label: 'Foto após resolução', instructions: 'Registre que o problema foi resolvido', required: true },
      ]};
      exec.timeControl.sla = { enabled: true, maxMinutes: 120, alertOnExceed: true };
      exec.timeControl.executionTimer = { enabled: true, showToTech: true, pauseDiscountsFromSla: false };
      // CONCLUIDA
      const conc = c.stages.find(s => s.status === 'CONCLUIDA')!;
      conc.enabled = true;
      conc.autoActions.notifyGestor = { enabled: true, channel: 'whatsapp', message: '✅ OS urgente concluída: {titulo}' };
      conc.autoActions.notifyCliente = { enabled: true, channel: 'sms', message: 'Seu chamado urgente foi resolvido. OS: {titulo}' };
      conc.autoActions.financialEntry = { enabled: true, entries: [
        { id: 'fe_receber', type: 'contas_receber', label: 'Valor a receber', valueSource: 'os_value', description: 'Faturamento do atendimento urgente', autoCreate: true },
      ]};
      return c;
    },
  },
  {
    id: 'simples',
    name: 'Fluxo Simples',
    description: 'Mínimo: execução e conclusão apenas',
    icon: '✨',
    apply: (cfg) => {
      const c = createDefaultConfig();
      c.name = cfg.name;
      c.trigger = TRIGGER_OPTIONS[0];
      // EM_EXECUCAO
      const exec = c.stages.find(s => s.status === 'EM_EXECUCAO')!;
      exec.enabled = true;
      exec.techActions.step = { enabled: true, description: 'Executar o serviço', requirePhoto: false, requireNote: true, requireGPS: false };
      // CONCLUIDA
      const conc = c.stages.find(s => s.status === 'CONCLUIDA')!;
      conc.enabled = true;
      conc.autoActions.financialEntry = { enabled: true, entries: [
        { id: 'fe_receber', type: 'contas_receber', label: 'Valor a receber', valueSource: 'os_value', description: 'Faturamento do serviço', autoCreate: true },
      ]};
      return c;
    },
  },
];

/* ── Compilador: StageConfig[] → V2 Blocks ─────────────────── */

let _blockCounter = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(++_blockCounter).toString(36)}`;
}

interface V2Block {
  id: string;
  type: string;
  name: string;
  icon: string;
  config: Record<string, any>;
  next: string | null;
}

export function compileToV2(config: WorkflowFormConfig): { version: 2; blocks: V2Block[] } {
  _blockCounter = 0;
  const blocks: V2Block[] = [];

  const startId = '_start';
  const endId = '_end';

  blocks.push({ id: startId, type: 'START', name: 'Início', icon: '▶️', config: {}, next: null });
  blocks.push({ id: endId, type: 'END', name: 'Fim', icon: '⏹️', config: {}, next: null });

  const enabledStages = config.stages.filter(s => s.enabled);
  if (enabledStages.length === 0) {
    blocks[0].next = endId;
    const earlyResult: any = { version: 2, blocks };
    // Persist trigger definition (same as normal return path)
    if (config.trigger) {
      earlyResult.trigger = {
        entity: config.trigger.entity,
        event: config.trigger.event,
        triggerId: config.trigger.id,
      };
    }
    if (config.technicianOnboarding?.enabled) {
      earlyResult.technicianOnboarding = config.technicianOnboarding;
    }
    if (config.clientOnboarding?.enabled) {
      earlyResult.clientOnboarding = config.clientOnboarding;
    }
    if (config.supplierOnboarding?.enabled) {
      earlyResult.supplierOnboarding = config.supplierOnboarding;
    }
    return earlyResult;
  }

  // For each enabled stage, collect blocks
  const allStageBlocks: V2Block[][] = [];

  for (const stage of enabledStages) {
    const stageBlocks: V2Block[] = [];

    // 1. STATUS block (change to this stage's status)
    stageBlocks.push({
      id: genId('status'),
      type: 'STATUS',
      name: `Mudar para ${stage.label}`,
      icon: stage.icon,
      config: { targetStatus: stage.status },
      next: null,
    });

    // 2a. Rich tech selection (overrides simple assignTech if enabled)
    //     Cross-stage: ABERTA=método/max, OFERTADA=aceite/timeout, ATRIBUÍDA=a_caminho
    if (stage.autoActions.techSelection.enabled) {
      const ofertadaStage = config.stages.find(s => s.status === 'OFERTADA')!;
      const atribuidaStage = config.stages.find(s => s.status === 'ATRIBUIDA')!;
      const oSel = ofertadaStage.autoActions.techSelection;
      const aSel = atribuidaStage.autoActions.techSelection;
      stageBlocks.push({
        id: genId('assign'), type: 'ASSIGN_TECH', name: 'Seleção de técnicos', icon: '🎯',
        config: {
          strategy: stage.autoActions.techSelection.method,
          maxTechnicians: stage.autoActions.techSelection.maxTechnicians,
          // Accept timeout — dados da OFERTADA
          acceptTimeoutMinutes: oSel.acceptTimeout.mode === 'from_os'
            ? 'from_os'
            : oSel.acceptTimeout.value * (oSel.acceptTimeout.unit === 'hours' ? 60 : 1),
          acceptTimeoutUnit: oSel.acceptTimeout.unit,
          acceptTimeoutMode: oSel.acceptTimeout.mode,
          // En route timeout — dados da ATRIBUÍDA
          enRouteTimeoutMinutes: aSel.enRouteTimeout.mode === 'from_os'
            ? 'from_os'
            : aSel.enRouteTimeout.value * (aSel.enRouteTimeout.unit === 'hours' ? 60 : 1),
          enRouteTimeoutUnit: aSel.enRouteTimeout.unit,
          enRouteTimeoutMode: aSel.enRouteTimeout.mode,
          // Timeout behavior — dados da OFERTADA
          onTimeout: oSel.onTimeout,
          filterBySpecialization: stage.autoActions.techSelection.filterBySpecialization,
          // discardBusy = critério de seleção, fica na ABERTA
          discardBusyTechnicians: stage.autoActions.techSelection.discardBusyTechnicians,
        },
        next: null,
      });
    } else if (stage.autoActions.assignTech.enabled) {
      stageBlocks.push({
        id: genId('assign'), type: 'ASSIGN_TECH', name: 'Atribuir técnico', icon: '🎯',
        config: { strategy: stage.autoActions.assignTech.strategy },
        next: null,
      });
    }

    // 2a-bis. Tech review screen (ABERTA — tela de revisão dos técnicos selecionados)
    if (stage.autoActions.techReviewScreen?.enabled && stage.status === 'ABERTA') {
      stageBlocks.push({
        id: genId('review'), type: 'TECH_REVIEW_SCREEN', name: 'Revisão de técnicos', icon: '👁️',
        config: {
          allowEdit: stage.autoActions.techReviewScreen.allowEdit,
        },
        next: null,
      });
    }

    // 2b. Rich message dispatch (overrides individual notify if enabled)
    if (stage.autoActions.messageDispatch.enabled) {
      const recipients: any[] = [];
      const md = stage.autoActions.messageDispatch;
      if (md.toTechnicians.enabled) {
        const techLink = md.toTechnicians.link;
        recipients.push({
          type: 'TECNICO', enabled: true,
          channel: md.toTechnicians.channel, message: md.toTechnicians.message,
          includeLink: techLink.enabled,
          linkConfig: techLink.enabled ? {
            validityHours: techLink.validityHours,
            acceptOS: techLink.acceptOS,
            gpsNavigation: techLink.gpsNavigation,
            pageLayout: techLink.pageLayout,  // save ALL blocks (enabled flag preserved for round-trip)
          } : undefined,
        });
      }
      if (md.toGestor.enabled) {
        recipients.push({ type: 'GESTOR', enabled: true, channel: md.toGestor.channel, message: md.toGestor.message });
      }
      if (md.toCliente.enabled) {
        recipients.push({ type: 'CLIENTE', enabled: true, channel: md.toCliente.channel, message: md.toCliente.message });
      }
      if (recipients.length > 0) {
        stageBlocks.push({
          id: genId('notify'), type: 'NOTIFY', name: 'Disparo de mensagens', icon: '💬',
          config: { recipients },
          next: null,
        });
      }
    } else {
      // Fallback to simple notify fields
      if (stage.autoActions.notifyGestor.enabled) {
        stageBlocks.push({
          id: genId('notify'), type: 'NOTIFY', name: 'Notificar gestor', icon: '👔',
          config: { recipients: [{ type: 'GESTOR', enabled: true, channel: stage.autoActions.notifyGestor.channel, message: stage.autoActions.notifyGestor.message }] },
          next: null,
        });
      }
      if (stage.autoActions.notifyTecnico.enabled) {
        stageBlocks.push({
          id: genId('notify'), type: 'NOTIFY', name: 'Notificar técnico', icon: '👷',
          config: { recipients: [{ type: 'TECNICO', enabled: true, channel: stage.autoActions.notifyTecnico.channel, message: stage.autoActions.notifyTecnico.message, includeLink: stage.autoActions.notifyTecnico.includeLink }] },
          next: null,
        });
      }
      if (stage.autoActions.notifyCliente.enabled) {
        stageBlocks.push({
          id: genId('notify'), type: 'NOTIFY', name: 'Notificar cliente', icon: '👤',
          config: { recipients: [{ type: 'CLIENTE', enabled: true, channel: stage.autoActions.notifyCliente.channel, message: stage.autoActions.notifyCliente.message }] },
          next: null,
        });
      }
    }
    // 2c. Tech question (auto-syncs with techActions.question)
    if (stage.autoActions.techQuestion.enabled && stage.autoActions.techQuestion.question) {
      stageBlocks.push({
        id: genId('quest'), type: 'QUESTION', name: stage.autoActions.techQuestion.question, icon: '❓',
        config: {
          question: stage.autoActions.techQuestion.question,
          options: stage.autoActions.techQuestion.options.map(o => o.label),
          optionActions: stage.autoActions.techQuestion.options,
          required: stage.autoActions.techQuestion.required,
          showOnLinkPage: stage.autoActions.techQuestion.showOnLinkPage,
        },
        next: null,
      });
    }

    // 2d. Arrival question (ATRIBUÍDA — pergunta pós-aceite de tempo estimado)
    if (stage.autoActions.arrivalQuestion?.enabled && stage.status === 'ATRIBUIDA') {
      stageBlocks.push({
        id: genId('arrival'), type: 'ARRIVAL_QUESTION', name: 'Pergunta de tempo estimado', icon: '🕐',
        config: {
          question: stage.autoActions.arrivalQuestion.question,
          options: stage.autoActions.arrivalQuestion.options,
          useAsDynamicTimeout: stage.autoActions.arrivalQuestion.useAsDynamicTimeout,
          notifyCliente: stage.autoActions.arrivalQuestion.notifyCliente,
          notifyGestor: stage.autoActions.arrivalQuestion.notifyGestor,
          onDecline: stage.autoActions.arrivalQuestion.onDecline,
        },
        next: null,
      });
    }

    // 2e-bis. Schedule config (ABERTA — regime de agenda CLT)
    if (stage.autoActions.scheduleConfig?.enabled && stage.status === 'ABERTA') {
      stageBlocks.push({
        id: genId('sched'), type: 'SCHEDULE_CONFIG', name: 'Regime de Agenda', icon: '📅',
        config: {
          defaultDurationMinutes: stage.autoActions.scheduleConfig.defaultDurationMinutes,
          workingHours: stage.autoActions.scheduleConfig.workingHours,
          workingDays: stage.autoActions.scheduleConfig.workingDays,
          notifyTechnician: stage.autoActions.scheduleConfig.notifyTechnician,
        },
        next: null,
      });
    }

    // 2e. Proximity trigger (A_CAMINHO — rastreamento GPS por proximidade)
    if (stage.autoActions.proximityTrigger?.enabled && stage.status === 'A_CAMINHO') {
      stageBlocks.push({
        id: genId('prox'), type: 'PROXIMITY_TRIGGER', name: 'Rastreamento por Proximidade', icon: '📡',
        config: {
          radiusMeters: stage.autoActions.proximityTrigger.radiusMeters,
          trackingIntervalSeconds: stage.autoActions.proximityTrigger.trackingIntervalSeconds,
          requireHighAccuracy: stage.autoActions.proximityTrigger.requireHighAccuracy,
          keepActiveUntil: stage.autoActions.proximityTrigger.keepActiveUntil,
          onEnterRadius: stage.autoActions.proximityTrigger.onEnterRadius,
        },
        next: null,
      });
    }

    if (stage.autoActions.alert.enabled) {
      stageBlocks.push({
        id: genId('alert'), type: 'ALERT', name: 'Enviar alerta', icon: '🔔',
        config: { message: stage.autoActions.alert.message, severity: stage.autoActions.alert.severity },
        next: null,
      });
    }

    // 3. WAIT_FOR (pause workflow)
    if (stage.timeControl.waitFor.enabled) {
      stageBlocks.push({
        id: genId('wait'), type: 'WAIT_FOR', name: 'Aguardar evento', icon: '⏸️',
        config: {
          timeoutMinutes: stage.timeControl.waitFor.timeoutMinutes,
          triggerConditions: stage.timeControl.waitFor.triggerConditions,
          targetStatus: stage.timeControl.waitFor.targetStatus,
          timeoutAction: stage.timeControl.waitFor.timeoutAction,
        },
        next: null,
      });
    }

    // 4. DELAY
    if (stage.timeControl.delay.enabled) {
      stageBlocks.push({
        id: genId('delay'), type: 'DELAY', name: 'Aguardar', icon: '⏳',
        config: { minutes: stage.timeControl.delay.minutes },
        next: null,
      });
    }

    // 5. SLA
    if (stage.timeControl.sla.enabled) {
      stageBlocks.push({
        id: genId('sla'), type: 'SLA', name: 'Controle SLA', icon: '⏱️',
        config: { maxMinutes: stage.timeControl.sla.maxMinutes, alertOnExceed: stage.timeControl.sla.alertOnExceed },
        next: null,
      });
    }

    // 5b. PAUSE_SYSTEM
    if (stage.timeControl.pauseSystem?.enabled) {
      stageBlocks.push({
        id: genId('pause'), type: 'PAUSE_SYSTEM', name: 'Sistema de pausas', icon: '⏸️',
        config: {
          maxPauses: stage.timeControl.pauseSystem.maxPauses,
          maxPauseDurationMinutes: stage.timeControl.pauseSystem.maxPauseDurationMinutes,
          requireReason: stage.timeControl.pauseSystem.requireReason,
          allowedReasons: stage.timeControl.pauseSystem.allowedReasons,
          notifications: stage.timeControl.pauseSystem.notifications,
        },
        next: null,
      });
    }

    // 5c. EXECUTION_TIMER
    if (stage.timeControl.executionTimer.enabled) {
      stageBlocks.push({
        id: genId('timer'), type: 'EXECUTION_TIMER', name: 'Cronômetro de execução', icon: '⏲️',
        config: { showToTech: stage.timeControl.executionTimer.showToTech, pauseDiscountsFromSla: stage.timeControl.executionTimer.pauseDiscountsFromSla },
        next: null,
      });
    }

    // 6. Tech actions (interactive — technician must complete)
    if (stage.techActions.step.enabled) {
      stageBlocks.push({
        id: genId('step'), type: 'STEP', name: stage.techActions.step.description || 'Executar etapa', icon: '⚙️',
        config: { description: stage.techActions.step.description, requirePhoto: stage.techActions.step.requirePhoto, requireNote: stage.techActions.step.requireNote, requireGPS: stage.techActions.step.requireGPS },
        next: null,
      });
    }
    // 6a. PHOTO_REQUIREMENTS (multiple groups — replaces single PHOTO for EM_EXECUCAO)
    if (stage.techActions.photoRequirements.enabled && stage.techActions.photoRequirements.groups.length > 0) {
      stageBlocks.push({
        id: genId('photoreq'), type: 'PHOTO_REQUIREMENTS', name: 'Fotos por momento', icon: '📷',
        config: { groups: stage.techActions.photoRequirements.groups },
        next: null,
      });
    }
    // 6b. Legacy single PHOTO (only if photoRequirements is NOT enabled — backward compat)
    if (stage.techActions.photo.enabled && !stage.techActions.photoRequirements.enabled) {
      stageBlocks.push({
        id: genId('photo'), type: 'PHOTO', name: stage.techActions.photo.label || 'Tirar foto', icon: '📸',
        config: { minPhotos: stage.techActions.photo.minPhotos, label: stage.techActions.photo.label, photoType: stage.techActions.photo.photoType },
        next: null,
      });
    }
    if (stage.techActions.note.enabled) {
      stageBlocks.push({
        id: genId('note'), type: 'NOTE', name: 'Observação', icon: '📝',
        config: { placeholder: stage.techActions.note.placeholder },
        next: null,
      });
    }
    if (stage.techActions.gps.enabled) {
      stageBlocks.push({
        id: genId('gps'), type: 'GPS', name: 'Capturar GPS', icon: '📍',
        config: { requireAccuracy: stage.techActions.gps.requireAccuracy },
        next: null,
      });
    }
    if (stage.techActions.checklist.enabled && stage.techActions.checklist.items.length > 0) {
      stageBlocks.push({
        id: genId('check'), type: 'CHECKLIST', name: 'Checklist', icon: '☑️',
        config: { items: stage.techActions.checklist.items },
        next: null,
      });
    }
    if (stage.techActions.form.enabled && stage.techActions.form.fields.length > 0) {
      stageBlocks.push({
        id: genId('form'), type: 'FORM', name: 'Formulário', icon: '📋',
        config: { fields: stage.techActions.form.fields },
        next: null,
      });
    }
    // 6c. MATERIALS
    if (stage.techActions.materials.enabled) {
      stageBlocks.push({
        id: genId('mat'), type: 'MATERIALS', name: stage.techActions.materials.label || 'Materiais', icon: '🔩',
        config: { label: stage.techActions.materials.label, requireQuantity: stage.techActions.materials.requireQuantity, requireUnitCost: stage.techActions.materials.requireUnitCost },
        next: null,
      });
    }
    if (stage.techActions.signature.enabled) {
      stageBlocks.push({
        id: genId('sig'), type: 'SIGNATURE', name: stage.techActions.signature.label || 'Assinatura', icon: '✍️',
        config: { label: stage.techActions.signature.label },
        next: null,
      });
    }
    // Skip simple question if rich techQuestion already emitted (avoids duplicate QUESTION blocks)
    if (stage.techActions.question.enabled && stage.techActions.question.question && !stage.autoActions.techQuestion.enabled) {
      stageBlocks.push({
        id: genId('quest'), type: 'QUESTION', name: stage.techActions.question.question, icon: '❓',
        config: { question: stage.techActions.question.question, options: stage.techActions.question.options },
        next: null,
      });
    }

    // 6d. GESTOR_APPROVAL (CONCLUÍDA — portão de aprovação)
    if (stage.autoActions.gestorApproval?.enabled) {
      stageBlocks.push({
        id: genId('approval'), type: 'GESTOR_APPROVAL', name: 'Aprovação do gestor', icon: '👔',
        config: {
          reviewChecklist: stage.autoActions.gestorApproval.reviewChecklist,
          onApprove: stage.autoActions.gestorApproval.onApprove,
          onApproveWithReservations: stage.autoActions.gestorApproval.onApproveWithReservations,
          onReject: stage.autoActions.gestorApproval.onReject,
        },
        next: null,
      });
    }

    // 7. On-exit auto actions
    if (stage.autoActions.financialEntry.enabled) {
      stageBlocks.push({
        id: genId('fin'), type: 'FINANCIAL_ENTRY', name: 'Lançar financeiro', icon: '💰',
        config: {
          entries: stage.autoActions.financialEntry.entries || [],
        },
        next: null,
      });
    }
    if (stage.autoActions.webhook.enabled && stage.autoActions.webhook.url) {
      stageBlocks.push({
        id: genId('hook'), type: 'WEBHOOK', name: 'Webhook', icon: '🔗',
        config: { url: stage.autoActions.webhook.url },
        next: null,
      });
    }
    if (stage.autoActions.duplicateOS.enabled) {
      stageBlocks.push({
        id: genId('dup'), type: 'DUPLICATE_OS', name: 'Duplicar OS', icon: '📑',
        config: {},
        next: null,
      });
    }

    allStageBlocks.push(stageBlocks);
  }

  // Wire everything together via next pointers
  const flatBlocks = allStageBlocks.flat();
  for (let i = 0; i < flatBlocks.length - 1; i++) {
    flatBlocks[i].next = flatBlocks[i + 1].id;
  }
  if (flatBlocks.length > 0) {
    blocks[0].next = flatBlocks[0].id; // START → first block
    flatBlocks[flatBlocks.length - 1].next = endId; // last block → END
  } else {
    blocks[0].next = endId;
  }

  const result: any = { version: 2, blocks: [...blocks.slice(0, 1), ...flatBlocks, ...blocks.slice(1)] };

  // Persist trigger definition
  if (config.trigger) {
    result.trigger = {
      entity: config.trigger.entity,
      event: config.trigger.event,
      triggerId: config.trigger.id,
    };
  }

  // Persist technician onboarding config alongside blocks
  if (config.technicianOnboarding?.enabled) {
    result.technicianOnboarding = config.technicianOnboarding;
  }

  // Persist client onboarding config alongside blocks
  if (config.clientOnboarding?.enabled) {
    result.clientOnboarding = config.clientOnboarding;
  }

  // Persist supplier onboarding config alongside blocks
  if (config.supplierOnboarding?.enabled) {
    result.supplierOnboarding = config.supplierOnboarding;
  }

  return result;
}

/* ── Decompilador: V2/V1 → WorkflowFormConfig ──────────────── */

const TECH_TYPES = new Set(['STEP', 'PHOTO', 'NOTE', 'GPS', 'CHECKLIST', 'FORM', 'SIGNATURE', 'QUESTION', 'PHOTO_REQUIREMENTS', 'MATERIALS']);

export function decompileFromV2(steps: any): WorkflowFormConfig | null {
  const config = createDefaultConfig();

  // Restore trigger if present
  if (steps?.trigger?.triggerId) {
    const found = TRIGGER_OPTIONS.find(t => t.id === steps.trigger.triggerId);
    if (found) config.trigger = found;
  } else if (steps?.trigger?.entity && steps?.trigger?.event) {
    // Fallback: match by entity+event
    const found = TRIGGER_OPTIONS.find(t => t.entity === steps.trigger.entity && t.event === steps.trigger.event);
    if (found) config.trigger = found;
  }

  // Restore technician onboarding config if present
  if (steps?.technicianOnboarding) {
    config.technicianOnboarding = {
      ...createDefaultOnboarding(),
      ...steps.technicianOnboarding,
    };
  }

  // Restore client onboarding config if present
  if (steps?.clientOnboarding) {
    config.clientOnboarding = {
      ...createDefaultClientOnboarding(),
      ...steps.clientOnboarding,
    };
  }

  // Restore supplier onboarding config if present
  if (steps?.supplierOnboarding) {
    config.supplierOnboarding = {
      ...createDefaultSupplierOnboarding(),
      ...steps.supplierOnboarding,
    };
  }

  // V1 format (array of steps)
  if (Array.isArray(steps)) {
    return decompileV1(steps, config);
  }

  // V2 format
  if (steps?.version === 2 && Array.isArray(steps.blocks)) {
    return decompileV2Blocks(steps.blocks, config);
  }

  // V3 format — try converting
  if (steps?.version === 3 && Array.isArray(steps.blocks)) {
    return decompileV3Blocks(steps.blocks, config);
  }

  return null;
}

function decompileV1(steps: any[], config: WorkflowFormConfig): WorkflowFormConfig {
  // V1 is just a flat list of STEP-like actions, no STATUS changes
  // Map them all to EM_EXECUCAO stage
  const exec = config.stages.find(s => s.status === 'EM_EXECUCAO')!;
  exec.enabled = true;

  for (const step of steps) {
    if (step.requirePhoto) {
      exec.techActions.photo.enabled = true;
    }
    if (step.requireNote) {
      exec.techActions.note.enabled = true;
    }
    // Each V1 step becomes a STEP action
    exec.techActions.step.enabled = true;
    exec.techActions.step.description = step.name || '';
  }

  return config;
}

function decompileV2Blocks(blocks: any[], config: WorkflowFormConfig): WorkflowFormConfig | null {
  // Check for CONDITION blocks — can't represent as toggles
  if (blocks.some((b: any) => b.type === 'CONDITION')) return null;

  // Walk linked list from START
  const blockMap = new Map<string, any>();
  for (const b of blocks) blockMap.set(b.id, b);

  const start = blocks.find((b: any) => b.type === 'START');
  if (!start) return null;

  // Walk and group by STATUS boundaries
  let currentStage: StageConfig | null = null;
  let cursor: any = start;

  while (cursor) {
    if (cursor.type === 'STATUS') {
      const targetStatus = cursor.config?.targetStatus;
      if (targetStatus) {
        currentStage = config.stages.find(s => s.status === targetStatus) || null;
        if (currentStage) currentStage.enabled = true;
      }
    } else if (cursor.type !== 'START' && cursor.type !== 'END' && currentStage) {
      mapBlockToStage(cursor, currentStage, config.stages);
    }

    cursor = cursor.next ? blockMap.get(cursor.next) : null;
  }

  return config;
}

function decompileV3Blocks(blocks: any[], config: WorkflowFormConfig): WorkflowFormConfig | null {
  // Check for CONDITION blocks
  if (blocks.some((b: any) => b.type === 'CONDITION')) return null;

  // V3 uses children[] arrays instead of next pointers
  // Find TRIGGER_START or first block
  const trigger = blocks.find((b: any) => b.type === 'TRIGGER_START') || blocks[0];
  if (!trigger) return null;

  const blockMap = new Map<string, any>();
  for (const b of blocks) blockMap.set(b.id, b);

  // Walk children chain
  let currentStage: StageConfig | null = null;

  function walkChildren(childIds: string[]) {
    for (const childId of childIds) {
      const block = blockMap.get(childId);
      if (!block) continue;

      if (block.type === 'STATUS_CHANGE' || block.type === 'STATUS') {
        const targetStatus = block.config?.targetStatus;
        if (targetStatus) {
          currentStage = config.stages.find(s => s.status === targetStatus) || null;
          if (currentStage) currentStage.enabled = true;
        }
      } else if (block.type !== 'TRIGGER_START' && block.type !== 'END' && currentStage) {
        mapBlockToStage(block, currentStage, config.stages);
      }

      if (block.children?.length) {
        walkChildren(block.children);
      }
    }
  }

  walkChildren(trigger.children || []);
  return config;
}

function mapBlockToStage(block: any, stage: StageConfig, allStages?: StageConfig[]) {
  const cfg = block.config || {};

  switch (block.type) {
    case 'STEP':
      stage.techActions.step.enabled = true;
      if (cfg.description) stage.techActions.step.description = cfg.description;
      if (cfg.requirePhoto) stage.techActions.step.requirePhoto = true;
      if (cfg.requireNote) stage.techActions.step.requireNote = true;
      if (cfg.requireGPS) stage.techActions.step.requireGPS = true;
      break;
    case 'PHOTO':
      stage.techActions.photo.enabled = true;
      if (cfg.minPhotos) stage.techActions.photo.minPhotos = cfg.minPhotos;
      if (cfg.label) stage.techActions.photo.label = cfg.label;
      if (cfg.photoType) stage.techActions.photo.photoType = cfg.photoType;
      break;
    case 'NOTE':
      stage.techActions.note.enabled = true;
      if (cfg.placeholder) stage.techActions.note.placeholder = cfg.placeholder;
      break;
    case 'GPS':
      stage.techActions.gps.enabled = true;
      if (cfg.requireAccuracy) stage.techActions.gps.requireAccuracy = true;
      break;
    case 'CHECKLIST':
      stage.techActions.checklist.enabled = true;
      if (cfg.items?.length) stage.techActions.checklist.items = cfg.items;
      break;
    case 'FORM':
      stage.techActions.form.enabled = true;
      if (cfg.fields?.length) stage.techActions.form.fields = cfg.fields;
      break;
    case 'SIGNATURE':
      stage.techActions.signature.enabled = true;
      if (cfg.label) stage.techActions.signature.label = cfg.label;
      break;
    case 'QUESTION':
      // If optionActions present → auto-action techQuestion (rich question)
      if (cfg.optionActions?.length) {
        stage.autoActions.techQuestion = {
          enabled: true,
          question: cfg.question || '',
          options: cfg.optionActions,
          required: cfg.required ?? true,
          showOnLinkPage: cfg.showOnLinkPage ?? true,
        };
        // Also sync to techActions.question (labels only)
        stage.techActions.question.enabled = true;
        stage.techActions.question.question = cfg.question || '';
        stage.techActions.question.options = cfg.optionActions.map((o: TechQuestionOption) => o.label);
      } else {
        // Simple tech action question
        stage.techActions.question.enabled = true;
        if (cfg.question) stage.techActions.question.question = cfg.question;
        if (cfg.options?.length) stage.techActions.question.options = cfg.options;
      }
      break;
    case 'NOTIFY': {
      const recipients = cfg.recipients || [];
      const legacy = cfg.recipient;
      if (recipients.length > 0) {
        for (const r of recipients) {
          if (r.type === 'GESTOR') {
            stage.autoActions.notifyGestor = { enabled: true, channel: r.channel || 'whatsapp', message: r.message || '' };
            // Also populate rich messageDispatch
            stage.autoActions.messageDispatch.toGestor = { enabled: true, channel: r.channel || 'whatsapp', message: r.message || '' };
          } else if (r.type === 'TECNICO') {
            stage.autoActions.notifyTecnico = { enabled: true, channel: r.channel || 'whatsapp', message: r.message || '', includeLink: !!r.includeLink };
            // Also populate rich messageDispatch with link config
            stage.autoActions.messageDispatch.toTechnicians.enabled = true;
            stage.autoActions.messageDispatch.toTechnicians.channel = r.channel || 'whatsapp';
            stage.autoActions.messageDispatch.toTechnicians.message = r.message || '';
            if (r.includeLink || r.linkConfig) {
              stage.autoActions.messageDispatch.toTechnicians.link.enabled = true;
              if (r.linkConfig) {
                stage.autoActions.messageDispatch.toTechnicians.link.validityHours = r.linkConfig.validityHours || 24;
                stage.autoActions.messageDispatch.toTechnicians.link.acceptOS = r.linkConfig.acceptOS ?? true;
                stage.autoActions.messageDispatch.toTechnicians.link.gpsNavigation = r.linkConfig.gpsNavigation ?? false;
                if (r.linkConfig.pageLayout?.length) {
                  // Merge saved layout with defaults (preserves blocks added in future versions)
                  const defaultLayout = stage.autoActions.messageDispatch.toTechnicians.link.pageLayout;
                  const savedMap = new Map(r.linkConfig.pageLayout.map((b: any) => [b.id, b]));
                  // Start with saved blocks in saved order, then append any new defaults
                  const merged = [
                    ...r.linkConfig.pageLayout,
                    ...defaultLayout.filter(d => !savedMap.has(d.id)),
                  ];
                  stage.autoActions.messageDispatch.toTechnicians.link.pageLayout = merged;
                }
              }
            }
          } else if (r.type === 'CLIENTE') {
            stage.autoActions.notifyCliente = { enabled: true, channel: r.channel || 'sms', message: r.message || '' };
            stage.autoActions.messageDispatch.toCliente = { enabled: true, channel: r.channel || 'sms', message: r.message || '' };
          }
        }
        // Enable the parent messageDispatch toggle so the UI shows the rich section
        stage.autoActions.messageDispatch.enabled = true;
      } else if (legacy) {
        stage.autoActions.notifyGestor = { enabled: true, channel: cfg.channel || 'whatsapp', message: cfg.message || '' };
      }
      break;
    }
    case 'FINANCIAL_ENTRY':
      stage.autoActions.financialEntry.enabled = true;
      if (cfg.entries?.length) {
        stage.autoActions.financialEntry.entries = cfg.entries;
      }
      break;
    case 'ALERT':
      stage.autoActions.alert = { enabled: true, message: cfg.message || '', severity: cfg.severity || 'info' };
      break;
    case 'WEBHOOK':
      stage.autoActions.webhook = { enabled: true, url: cfg.url || '' };
      break;
    case 'ASSIGN_TECH':
      // If rich config present, populate techSelection (distributed across stages)
      if (cfg.maxTechnicians || cfg.acceptTimeoutMinutes) {
        // ABERTA: método, maxTechnicians, filterBySpecialization, discardBusy
        stage.autoActions.techSelection = {
          enabled: true, method: cfg.strategy || 'BY_SPECIALIZATION',
          maxTechnicians: cfg.maxTechnicians || 5,
          acceptTimeout: stage.autoActions.techSelection.acceptTimeout,   // keep ABERTA defaults
          enRouteTimeout: stage.autoActions.techSelection.enRouteTimeout, // keep ABERTA defaults
          onTimeout: stage.autoActions.techSelection.onTimeout,           // keep ABERTA defaults
          filterBySpecialization: cfg.filterBySpecialization ?? true,
          discardBusyTechnicians: cfg.discardBusyTechnicians ?? true,     // critério de seleção
        };

        // OFERTADA: acceptTimeout, onTimeout, discardBusyTechnicians
        if (allStages) {
          const ofertada = allStages.find(s => s.status === 'OFERTADA');
          if (ofertada) {
            let acceptTimeout: { mode: 'fixed' | 'from_os'; value: number; unit: 'minutes' | 'hours' };
            if (cfg.acceptTimeoutMode === 'from_os' || cfg.acceptTimeoutMinutes === 'from_os') {
              acceptTimeout = { mode: 'from_os', value: 60, unit: 'minutes' };
            } else {
              const rawMinutes = typeof cfg.acceptTimeoutMinutes === 'number' ? cfg.acceptTimeoutMinutes : 60;
              const savedUnit = cfg.acceptTimeoutUnit;
              if (savedUnit === 'hours' || (!savedUnit && rawMinutes >= 60 && rawMinutes % 60 === 0)) {
                acceptTimeout = { mode: 'fixed', value: rawMinutes / 60, unit: 'hours' };
              } else {
                acceptTimeout = { mode: 'fixed', value: rawMinutes, unit: 'minutes' };
              }
            }
            ofertada.autoActions.techSelection.acceptTimeout = acceptTimeout;
            ofertada.autoActions.techSelection.onTimeout = cfg.onTimeout || 'notify_gestor';
          }

          // ATRIBUÍDA: enRouteTimeout
          const atribuida = allStages.find(s => s.status === 'ATRIBUIDA');
          if (atribuida) {
            let enRouteTimeout: { mode: 'fixed' | 'from_os'; value: number; unit: 'minutes' | 'hours' };
            if (cfg.enRouteTimeoutMode === 'from_os' || cfg.enRouteTimeoutMinutes === 'from_os') {
              enRouteTimeout = { mode: 'from_os', value: 30, unit: 'minutes' };
            } else {
              const rawMinutes = typeof cfg.enRouteTimeoutMinutes === 'number' ? cfg.enRouteTimeoutMinutes : 30;
              const savedUnit = cfg.enRouteTimeoutUnit;
              if (savedUnit === 'hours' || (!savedUnit && rawMinutes >= 60 && rawMinutes % 60 === 0)) {
                enRouteTimeout = { mode: 'fixed', value: rawMinutes / 60, unit: 'hours' };
              } else {
                enRouteTimeout = { mode: 'fixed', value: rawMinutes, unit: 'minutes' };
              }
            }
            atribuida.autoActions.techSelection.enRouteTimeout = enRouteTimeout;
          }
        }
      } else {
        stage.autoActions.assignTech = { enabled: true, strategy: cfg.strategy || 'BEST_RATING' };
      }
      break;
    case 'ARRIVAL_QUESTION':
      stage.autoActions.arrivalQuestion = {
        enabled: true,
        question: cfg.question || 'Quanto tempo até você estar a caminho?',
        options: cfg.options || [],
        useAsDynamicTimeout: cfg.useAsDynamicTimeout ?? false,
        notifyCliente: cfg.notifyCliente ?? false,
        notifyGestor: cfg.notifyGestor ?? false,
        onDecline: cfg.onDecline || 'notify_gestor',
      };
      break;
    case 'PROXIMITY_TRIGGER':
      stage.autoActions.proximityTrigger = {
        enabled: true,
        radiusMeters: cfg.radiusMeters ?? 200,
        trackingIntervalSeconds: cfg.trackingIntervalSeconds ?? 30,
        requireHighAccuracy: cfg.requireHighAccuracy ?? true,
        keepActiveUntil: cfg.keepActiveUntil || 'radius',
        onEnterRadius: cfg.onEnterRadius || {
          notifyCliente: { enabled: true, channel: 'whatsapp', message: '' },
          notifyGestor: { enabled: false, channel: 'push', message: '' },
          autoStartExecution: false,
          alert: { enabled: false, message: '' },
        },
      };
      break;
    case 'SCHEDULE_CONFIG':
      stage.autoActions.scheduleConfig = {
        enabled: true,
        defaultDurationMinutes: cfg.defaultDurationMinutes ?? 60,
        workingHours: cfg.workingHours || { start: '08:00', end: '18:00' },
        workingDays: cfg.workingDays || [1, 2, 3, 4, 5],
        notifyTechnician: cfg.notifyTechnician || {
          enabled: true,
          channel: 'whatsapp',
          message: 'Ola {nome}, voce tem um servico agendado para {data_agendamento} — {titulo} ({cliente}). Endereco: {endereco}',
          minutesBefore: 30,
        },
      };
      break;
    case 'TECH_REVIEW_SCREEN':
      stage.autoActions.techReviewScreen = {
        enabled: true,
        allowEdit: cfg.allowEdit ?? false,
      };
      break;
    case 'DUPLICATE_OS':
      stage.autoActions.duplicateOS.enabled = true;
      break;
    case 'WAIT_FOR':
      stage.timeControl.waitFor = {
        enabled: true,
        timeoutMinutes: cfg.timeoutMinutes || 60,
        triggerConditions: cfg.triggerConditions || [],
        targetStatus: cfg.targetStatus || '',
        timeoutAction: cfg.timeoutAction || 'continue',
      };
      break;
    case 'SLA':
      stage.timeControl.sla = { enabled: true, maxMinutes: cfg.maxMinutes || 120, alertOnExceed: cfg.alertOnExceed ?? true };
      break;
    case 'DELAY':
      stage.timeControl.delay = { enabled: true, minutes: cfg.minutes || 30 };
      break;
    case 'EXECUTION_TIMER':
      stage.timeControl.executionTimer = {
        enabled: true,
        showToTech: cfg.showToTech ?? true,
        pauseDiscountsFromSla: cfg.pauseDiscountsFromSla ?? true,
      };
      break;
    case 'PAUSE_SYSTEM': {
      const defaultNotifs = {
        onPause: {
          gestor:  { enabled: cfg.notifyGestorOnPause ?? true, channel: 'whatsapp', message: '' },
          cliente: { enabled: false, channel: 'sms', message: '' },
          tecnico: { enabled: false, channel: 'push', message: '' },
        },
        onResume: {
          gestor:  { enabled: cfg.notifyGestorOnResume ?? false, channel: 'whatsapp', message: '' },
          cliente: { enabled: false, channel: 'sms', message: '' },
          tecnico: { enabled: false, channel: 'push', message: '' },
        },
      };
      stage.timeControl.pauseSystem = {
        enabled: true,
        maxPauses: cfg.maxPauses ?? 0,
        maxPauseDurationMinutes: cfg.maxPauseDurationMinutes ?? 0,
        requireReason: cfg.requireReason ?? true,
        allowedReasons: cfg.allowedReasons ?? PAUSE_REASON_CATEGORIES.map(c => c.value),
        notifications: cfg.notifications ?? defaultNotifs,
      };
      break;
    }
    case 'PHOTO_REQUIREMENTS':
      stage.techActions.photoRequirements = {
        enabled: true,
        groups: cfg.groups || [],
      };
      break;
    case 'MATERIALS':
      stage.techActions.materials = {
        enabled: true,
        label: cfg.label || 'Materiais utilizados',
        requireQuantity: cfg.requireQuantity ?? true,
        requireUnitCost: cfg.requireUnitCost ?? false,
      };
      break;
    case 'GESTOR_APPROVAL':
      stage.autoActions.gestorApproval = {
        enabled: true,
        reviewChecklist: cfg.reviewChecklist || [],
        onApprove: cfg.onApprove || {
          notifyTecnico: { enabled: true, channel: 'push', message: '' },
          notifyCliente: { enabled: false, channel: 'sms', message: '' },
        },
        onApproveWithReservations: cfg.onApproveWithReservations || {
          enabled: true,
          requireNote: true,
          commissionAdjustment: { enabled: false, type: 'reduce_percent', value: 10 },
          flagOS: true,
          notifyTecnico: { enabled: true, channel: 'whatsapp', message: '' },
          notifyCliente: { enabled: false, channel: 'sms', message: '' },
        },
        onReject: cfg.onReject || {
          action: 'reopen_execution',
          requireReason: true,
          notifyTecnico: { enabled: true, channel: 'whatsapp', message: '' },
          notifyCliente: { enabled: false, channel: 'sms', message: '' },
        },
      };
      break;
  }
}
