"use client";

import { type Block, genBlockId } from "@/types/workflow-blocks";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  blocks: Block[];
}

function wire(blocks: Block[]): Block[] {
  // Auto-wire next pointers in sequence
  for (let i = 0; i < blocks.length - 1; i++) {
    if (blocks[i].type !== "CONDITION") {
      blocks[i].next = blocks[i + 1].id;
    }
  }
  return blocks;
}

function makeTemplate(name: string, description: string, icon: string, color: string, middleBlocks: Omit<Block, "id" | "next">[]): WorkflowTemplate {
  const startId = genBlockId();
  const endId = genBlockId();
  const blocks: Block[] = [
    { id: startId, type: "START", name: "Inicio", icon: "\u25b6\ufe0f", config: {}, next: null },
    ...middleBlocks.map((b) => ({
      ...b,
      id: genBlockId(),
      next: null,
    })) as Block[],
    { id: endId, type: "END", name: "Fim", icon: "\u23f9\ufe0f", config: {}, next: null },
  ];
  return { id: name, name, description, icon, color, blocks: wire(blocks) };
}

export const TEMPLATES: WorkflowTemplate[] = [
  makeTemplate(
    "Instalacao Completa",
    "Fluxo completo para instalacao de equipamentos com checklist, fotos antes/depois, assinatura e notificacoes",
    "\ud83d\udd27",
    "bg-blue-500",
    [
      { type: "STATUS", name: "Atribuir ao Tecnico", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Avisar Tecnico da OS", icon: "\ud83d\udcac", config: { recipients: [{ type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {tecnico}, voce foi designado para a OS {titulo} no endereco {endereco}. Data agendada: {data_agendamento}. Acesse o app para ver os detalhes e iniciar o deslocamento.", includeLink: true }] } },
      { type: "NOTIFY", name: "Avisar Cliente", icon: "\ud83d\udcac", config: { recipients: [{ type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, sua instalacao ({titulo}) foi agendada. Nosso tecnico {tecnico} ira ate o local no dia {data_agendamento}. Qualquer duvida entre em contato." }] } },
      { type: "STATUS", name: "Tecnico a Caminho", icon: "\ud83d\udd04", config: { targetStatus: "A_CAMINHO" } },
      { type: "GPS", name: "Registrar Chegada no Local", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "PHOTO", name: "Fotos Antes da Instalacao", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Registrar o local e equipamento antes de iniciar a instalacao", photoType: "ANTES" } },
      { type: "STATUS", name: "Iniciar Execucao", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "CHECKLIST", name: "Checklist de Instalacao", icon: "\u2611\ufe0f", config: { items: ["Verificar rede eletrica e disjuntores", "Conferir voltagem compativel", "Posicionar e nivelar equipamento", "Fixar suportes e parafusos", "Conectar tubulacao/fiacao", "Testar funcionamento completo", "Limpar area de trabalho", "Orientar cliente sobre uso basico"] } },
      { type: "NOTE", name: "Observacoes da Instalacao", icon: "\ud83d\udcdd", config: { placeholder: "Descreva as condicoes encontradas no local, materiais utilizados, dificuldades e orientacoes passadas ao cliente...", required: true } },
      { type: "PHOTO", name: "Fotos Apos Instalacao", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Registrar o equipamento instalado e funcionando", photoType: "DEPOIS" } },
      { type: "SIGNATURE", name: "Assinatura do Cliente", icon: "\u270d\ufe0f", config: { label: "Assinatura do cliente confirmando que a instalacao foi realizada e o equipamento esta funcionando" } },
      { type: "STATUS", name: "Concluir OS", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
      { type: "NOTIFY", name: "Confirmacao ao Cliente", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a instalacao ({titulo}) foi concluida com sucesso pelo tecnico {tecnico}. Caso tenha alguma duvida sobre o equipamento, entre em contato conosco. Obrigado pela preferencia!" },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "OS {titulo} concluida. Tecnico: {tecnico}. Cliente: {nome}. Instalacao finalizada com sucesso." },
      ] } },
    ]
  ),
  makeTemplate(
    "Manutencao Preventiva",
    "Fluxo para manutencao programada com inspecao detalhada, checklist tecnico e relatorio ao gestor",
    "\ud83d\udee0\ufe0f",
    "bg-green-500",
    [
      { type: "STATUS", name: "Atribuir ao Tecnico", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Avisar Tecnico", icon: "\ud83d\udcac", config: { recipients: [{ type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {tecnico}, manutencao preventiva agendada: {titulo}. Endereco: {endereco}. Data: {data_agendamento}. Verifique os materiais necessarios antes de sair.", includeLink: true }] } },
      { type: "NOTIFY", name: "Lembrete ao Cliente", icon: "\ud83d\udcac", config: { recipients: [{ type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, lembramos que a manutencao preventiva ({titulo}) esta agendada para {data_agendamento}. Nosso tecnico {tecnico} ira ate o local. Por favor, garanta o acesso ao equipamento." }] } },
      { type: "GPS", name: "Registrar Chegada", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "STATUS", name: "Iniciar Manutencao", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "CHECKLIST", name: "Inspecao Completa", icon: "\ud83d\udccb", config: { items: ["Inspecao visual externa", "Verificar nivel de oleo/fluido", "Checar filtros e substituir se necessario", "Verificar correias e tensionamento", "Medir temperatura de operacao", "Testar pressao do sistema", "Verificar conexoes eletricas", "Lubrificar partes moveis", "Checar vibracoes anormais", "Registrar leitura do horímetro"] } },
      { type: "NOTE", name: "Relatorio Tecnico", icon: "\ud83d\udcdd", config: { placeholder: "Descreva detalhadamente as condicoes encontradas em cada item inspecionado, pecas substituidas, medicoes realizadas e recomendacoes para proxima manutencao...", required: true } },
      { type: "PHOTO", name: "Evidencias do Servico", icon: "\ud83d\udcf8", config: { minPhotos: 3, label: "Fotos das condicoes encontradas, pecas substituidas e estado final do equipamento", photoType: "GERAL" } },
      { type: "QUESTION", name: "Precisa de Reparo?", icon: "\u2753", config: { question: "O equipamento necessita de reparo corretivo alem da manutencao preventiva?", options: ["Nao, tudo em ordem", "Sim, agendar reparo"] } },
      { type: "SIGNATURE", name: "Assinatura do Responsavel", icon: "\u270d\ufe0f", config: { label: "Assinatura do responsavel no local confirmando a realizacao da manutencao preventiva" } },
      { type: "STATUS", name: "Concluir OS", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
      { type: "NOTIFY", name: "Relatorio ao Gestor", icon: "\ud83d\udcac", config: { recipients: [
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Manutencao preventiva concluida: {titulo}. Tecnico: {tecnico}. Cliente: {nome}. Verifique o relatorio completo no sistema." },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a manutencao preventiva ({titulo}) foi concluida. Proximo atendimento programado conforme contrato. Obrigado!" },
      ] } },
    ]
  ),
  makeTemplate(
    "Vistoria e Laudo",
    "Fluxo para vistoria tecnica com formulario de laudo, fotos de evidencia e assinatura do responsavel",
    "\ud83d\udd0d",
    "bg-amber-500",
    [
      { type: "STATUS", name: "Atribuir Vistoriador", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Avisar Tecnico", icon: "\ud83d\udcac", config: { recipients: [{ type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {tecnico}, vistoria tecnica agendada: {titulo}. Endereco: {endereco}. Data: {data_agendamento}. Leve os instrumentos de medicao necessarios.", includeLink: true }] } },
      { type: "GPS", name: "Chegada no Local", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "STATUS", name: "Iniciar Vistoria", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "PHOTO", name: "Panorama do Local", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Fotos panoramicas do local e acesso", photoType: "ANTES" } },
      { type: "CHECKLIST", name: "Pontos de Inspecao", icon: "\u2611\ufe0f", config: { items: ["Verificar estrutura externa", "Inspecionar instalacoes eletricas", "Checar instalacoes hidraulicas", "Avaliar condicoes de seguranca", "Verificar documentacao tecnica"] } },
      { type: "PHOTO", name: "Fotos de Evidencia", icon: "\ud83d\udcf8", config: { minPhotos: 3, label: "Registrar todos os pontos inspecionados, irregularidades e condicoes relevantes", photoType: "EVIDENCIA" } },
      { type: "FORM", name: "Laudo Tecnico", icon: "\ud83d\udccb", config: { fields: [
        { name: "Condicao geral do local/equipamento", type: "select", required: true, options: ["Excelente", "Bom", "Regular", "Ruim", "Critico"] },
        { name: "Descricao das condicoes encontradas", type: "text", required: true },
        { name: "Irregularidades identificadas", type: "text", required: false },
        { name: "Recomendacoes tecnicas", type: "text", required: true },
        { name: "Prazo sugerido para intervencao (dias)", type: "number", required: false },
        { name: "Necessita interdição?", type: "select", required: true, options: ["Nao", "Sim - Parcial", "Sim - Total"] },
      ] } },
      { type: "NOTE", name: "Parecer Tecnico", icon: "\ud83d\udcdd", config: { placeholder: "Descreva seu parecer tecnico final sobre as condicoes encontradas, riscos identificados e acoes recomendadas com prioridade e prazos...", required: true } },
      { type: "SIGNATURE", name: "Assinatura do Responsavel", icon: "\u270d\ufe0f", config: { label: "Assinatura do responsavel pelo local atestando que acompanhou a vistoria" } },
      { type: "STATUS", name: "Concluir Vistoria", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
      { type: "NOTIFY", name: "Enviar Laudo", icon: "\ud83d\udcac", config: { recipients: [
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Vistoria concluida: {titulo}. Tecnico: {tecnico}. Laudo disponivel no sistema. Verifique as recomendacoes tecnicas." },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a vistoria tecnica ({titulo}) foi concluida. O laudo tecnico sera encaminhado em breve. Obrigado!" },
      ] } },
    ]
  ),
  makeTemplate(
    "Reparo Emergencial",
    "Fluxo para chamados urgentes com prioridade alta, diagnostico rapido e notificacoes em tempo real",
    "\u26a1",
    "bg-red-500",
    [
      { type: "STATUS", name: "Atribuir Urgente", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Chamado Urgente", icon: "\ud83d\udcac", config: { recipients: [
        { type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "URGENTE {tecnico}! Chamado de emergencia: {titulo}. Endereco: {endereco}. Cliente: {nome}. Dirija-se ao local o mais rapido possivel e inicie o atendimento.", includeLink: true },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, recebemos seu chamado urgente ({titulo}). Nosso tecnico {tecnico} esta sendo acionado e ira ao local o mais breve possivel. Acompanhe pelo app." },
      ] } },
      { type: "STATUS", name: "Tecnico a Caminho", icon: "\ud83d\udd04", config: { targetStatus: "A_CAMINHO" } },
      { type: "NOTIFY", name: "Tecnico Saiu", icon: "\ud83d\udcac", config: { recipients: [{ type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, o tecnico {tecnico} esta a caminho do seu endereco para atender o chamado {titulo}." }] } },
      { type: "GPS", name: "Chegada no Local", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "PHOTO", name: "Diagnostico Visual", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Registrar o problema encontrado, danos visiveis e condicoes do local", photoType: "ANTES" } },
      { type: "STATUS", name: "Iniciar Reparo", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "CHECKLIST", name: "Diagnostico Rapido", icon: "\ud83d\udccb", config: { items: ["Identificar causa raiz do problema", "Verificar se ha risco de seguranca", "Isolar area se necessario", "Verificar materiais disponiveis", "Executar reparo emergencial", "Testar funcionamento apos reparo"] } },
      { type: "STEP", name: "Executar Reparo", icon: "\u2699\ufe0f", config: { description: "Realizar o reparo emergencial. Documentar materiais utilizados e procedimentos executados.", requirePhoto: true, requireNote: true, requireGps: false } },
      { type: "PHOTO", name: "Resultado do Reparo", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Fotos do equipamento/local apos o reparo concluido e funcionando", photoType: "DEPOIS" } },
      { type: "NOTE", name: "Relatorio do Reparo", icon: "\ud83d\udcdd", config: { placeholder: "Descreva a causa do problema, procedimento de reparo realizado, pecas/materiais utilizados e recomendacoes para evitar reincidencia...", required: true } },
      { type: "SIGNATURE", name: "Aceite do Cliente", icon: "\u270d\ufe0f", config: { label: "Assinatura do cliente confirmando que o reparo foi realizado e o equipamento esta funcionando normalmente" } },
      { type: "STATUS", name: "Concluir OS", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
      { type: "NOTIFY", name: "Encerramento", icon: "\ud83d\udcac", config: { recipients: [
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Chamado urgente resolvido: {titulo}. Tecnico: {tecnico}. Cliente: {nome}. Verifique o relatorio no sistema para avaliar necessidade de acompanhamento." },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, o reparo emergencial ({titulo}) foi concluido com sucesso pelo tecnico {tecnico}. Caso o problema volte a ocorrer, entre em contato imediatamente. Obrigado pela confianca!" },
      ] } },
    ]
  ),
  makeTemplate(
    "Onboarding Tecnico",
    "Mensagem de boas-vindas automatica para novos tecnicos com dados de acesso ao app",
    "\ud83d\udc4b",
    "bg-purple-500",
    [
      { type: "NOTIFY", name: "Boas-vindas ao Tecnico", icon: "\ud83d\udcac", config: { recipients: [{ type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, bem-vindo a equipe {empresa}! Estamos muito felizes em te-lo conosco.\n\nPara acessar suas ordens de servico, baixe nosso app:\n{link_app}\n\nSeu login: {login}\nSua senha: {senha}\n\nNo app voce podera:\n- Ver suas OS atribuidas\n- Navegar ate o endereco do cliente\n- Registrar fotos e assinaturas\n- Acompanhar seu historico\n\nQualquer duvida, fale com seu gestor. Bom trabalho!" }] } },
    ]
  ),
  makeTemplate(
    "Onboarding Empresa",
    "Fluxo de boas-vindas para novos clientes corporativos com apresentacao dos servicos e canais de atendimento",
    "\ud83c\udfe2",
    "bg-indigo-500",
    [
      { type: "NOTIFY", name: "Boas-vindas ao Cliente", icon: "\ud83d\udcac", config: { recipients: [{ type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, seja bem-vindo(a) a {empresa}! Agradecemos por escolher nossos servicos.\n\nA partir de agora voce pode contar com nossa equipe para:\n- Instalacoes e manutencoes preventivas\n- Atendimentos emergenciais\n- Vistorias e laudos tecnicos\n\nPara solicitar um servico ou tirar duvidas, entre em contato:\nWhatsApp: {telefone}\nEmail: {email}\n\nSeu gestor de conta entrara em contato em breve para alinhar os detalhes do seu contrato. Obrigado pela confianca!" }] } },
      { type: "NOTIFY", name: "Aviso ao Gestor", icon: "\ud83d\udcac", config: { recipients: [{ type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Novo cliente cadastrado: {nome} ({documento}). Entre em contato para apresentar os servicos e alinhar o contrato de atendimento." }] } },
    ]
  ),
  makeTemplate(
    "Atendimento ao Cliente",
    "Fluxo padrao de atendimento com notificacoes em cada etapa para manter o cliente informado",
    "\ud83c\udf1f",
    "bg-teal-500",
    [
      { type: "STATUS", name: "Atribuir Tecnico", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Confirmacao ao Cliente", icon: "\ud83d\udcac", config: { recipients: [{ type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, sua solicitacao ({titulo}) foi recebida e o tecnico {tecnico} foi designado para o atendimento. Data prevista: {data_agendamento}. Voce sera notificado quando o tecnico estiver a caminho." }] } },
      { type: "NOTIFY", name: "Despacho do Tecnico", icon: "\ud83d\udcac", config: { recipients: [{ type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {tecnico}, novo atendimento: {titulo}. Cliente: {nome}. Endereco: {endereco}. Data: {data_agendamento}. Confira os detalhes no app e se prepare para o atendimento.", includeLink: true }] } },
      { type: "STATUS", name: "Tecnico a Caminho", icon: "\ud83d\udd04", config: { targetStatus: "A_CAMINHO" } },
      { type: "NOTIFY", name: "Tecnico Saindo", icon: "\ud83d\udcac", config: { recipients: [{ type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, o tecnico {tecnico} esta a caminho para atender sua solicitacao ({titulo}). Previsao de chegada em breve." }] } },
      { type: "GPS", name: "Chegada no Local", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "STATUS", name: "Iniciar Atendimento", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "CHECKLIST", name: "Procedimento Padrao", icon: "\u2611\ufe0f", config: { items: ["Apresentar-se ao cliente", "Confirmar o servico solicitado", "Avaliar as condicoes do local", "Executar o servico", "Testar e validar resultado", "Orientar o cliente sobre o servico realizado", "Limpar e organizar o local"] } },
      { type: "PHOTO", name: "Registro do Servico", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Fotos antes e depois do servico realizado", photoType: "GERAL" } },
      { type: "NOTE", name: "Observacoes", icon: "\ud83d\udcdd", config: { placeholder: "Descreva o servico realizado, condicoes encontradas, materiais utilizados e recomendacoes ao cliente...", required: true } },
      { type: "SIGNATURE", name: "Assinatura do Cliente", icon: "\u270d\ufe0f", config: { label: "Assinatura do cliente confirmando a realizacao e satisfacao com o servico" } },
      { type: "STATUS", name: "Concluir Atendimento", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
      { type: "NOTIFY", name: "Agradecimento", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, seu atendimento ({titulo}) foi concluido com sucesso! Esperamos que tenha ficado satisfeito(a) com o servico do tecnico {tecnico}. Para avaliar o atendimento, acesse o link que enviaremos em seguida. Obrigado pela preferencia!" },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Atendimento concluido: {titulo}. Tecnico: {tecnico}. Cliente: {nome}. Tudo finalizado com sucesso." },
      ] } },
    ]
  ),
  makeTemplate(
    "Entrega e Comissionamento",
    "Fluxo para entrega de equipamentos com testes de funcionamento, treinamento e termo de aceite",
    "\ud83d\udce6",
    "bg-cyan-500",
    [
      { type: "STATUS", name: "Agendar Entrega", icon: "\ud83d\udd04", config: { targetStatus: "ATRIBUIDA" } },
      { type: "NOTIFY", name: "Confirmar com Cliente", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a entrega e comissionamento do equipamento ({titulo}) esta agendada para {data_agendamento}. Nosso tecnico {tecnico} realizara a instalacao, testes e treinamento de operacao. Por favor, garanta que o local esteja preparado conforme orientacoes previas." },
        { type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {tecnico}, entrega e comissionamento agendado: {titulo}. Cliente: {nome}. Endereco: {endereco}. Data: {data_agendamento}. Verifique se todos os itens e manuais estao separados.", includeLink: true },
      ] } },
      { type: "STATUS", name: "Tecnico a Caminho", icon: "\ud83d\udd04", config: { targetStatus: "A_CAMINHO" } },
      { type: "GPS", name: "Chegada no Local", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "PHOTO", name: "Local Preparado", icon: "\ud83d\udcf8", config: { minPhotos: 1, label: "Registrar as condicoes do local antes da instalacao do equipamento", photoType: "ANTES" } },
      { type: "STATUS", name: "Iniciar Comissionamento", icon: "\ud83d\udd04", config: { targetStatus: "EM_EXECUCAO" } },
      { type: "CHECKLIST", name: "Checklist de Entrega", icon: "\u2611\ufe0f", config: { items: ["Conferir equipamento e acessorios", "Verificar integridade da embalagem", "Posicionar e instalar equipamento", "Conectar alimentacao eletrica/hidraulica", "Executar testes de funcionamento", "Calibrar parametros operacionais", "Entregar manuais e documentacao", "Realizar treinamento com operador", "Demonstrar procedimentos de seguranca", "Registrar numero de serie e garantia"] } },
      { type: "PHOTO", name: "Equipamento Instalado", icon: "\ud83d\udcf8", config: { minPhotos: 3, label: "Fotos do equipamento instalado, funcionando e com placa de identificacao visivel", photoType: "DEPOIS" } },
      { type: "FORM", name: "Dados do Comissionamento", icon: "\ud83d\udccb", config: { fields: [
        { name: "Numero de serie", type: "text", required: true },
        { name: "Voltagem configurada", type: "select", required: true, options: ["110V", "220V", "380V", "Bivolt"] },
        { name: "Resultado dos testes", type: "select", required: true, options: ["Todos aprovados", "Aprovado com ressalvas", "Reprovado"] },
        { name: "Treinamento realizado com", type: "text", required: true },
        { name: "Observacoes da entrega", type: "text", required: false },
      ] } },
      { type: "SIGNATURE", name: "Termo de Aceite", icon: "\u270d\ufe0f", config: { label: "Assinatura do cliente confirmando o recebimento do equipamento em perfeitas condicoes, testes realizados e treinamento concluido" } },
      { type: "STATUS", name: "Concluir Entrega", icon: "\ud83d\udd04", config: { targetStatus: "CONCLUIDA" } },
      { type: "NOTIFY", name: "Confirmacao Final", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a entrega e comissionamento ({titulo}) foram concluidos com sucesso! O equipamento esta instalado e funcionando. Em caso de duvidas sobre a operacao, consulte o manual entregue ou entre em contato conosco. Obrigado!" },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Entrega concluida: {titulo}. Tecnico: {tecnico}. Cliente: {nome}. Equipamento instalado, testado e treinamento realizado. Termo de aceite assinado." },
      ] } },
    ]
  ),
  makeTemplate(
    "Fluxo em Branco",
    "Comece do zero e monte seu proprio fluxo personalizado",
    "\u2795",
    "bg-slate-500",
    []
  ),
];

interface Props {
  onSelect: (blocks: Block[]) => void;
  onClose: () => void;
}

export default function WorkflowTemplates({ onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Escolha um modelo</h2>
            <p className="text-xs text-slate-400">Selecione um template para comecar ou crie do zero — todos os textos ja vem preenchidos</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 p-6 overflow-y-auto">
          {TEMPLATES.map((t) => {
            const blockCount = t.blocks.filter(b => b.type !== "START" && b.type !== "END").length;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t.blocks)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30"
              >
                <div className="flex items-center gap-2.5 w-full">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-base shadow-sm ${t.color}`}>
                    {t.icon}
                  </span>
                  <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700 leading-tight">{t.name}</p>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{t.description}</p>
                {blockCount > 0 && (
                  <span className="text-[10px] text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded">{blockCount} blocos</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
