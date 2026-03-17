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
    "Checklist, fotos antes/depois, assinatura e avisos",
    "\ud83d\udd27",
    "bg-blue-500",
    [
      { type: "NOTIFY", name: "Despacho", icon: "\ud83d\udcac", config: { recipients: [
        { type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, voce foi designado para a OS {titulo}. Cliente: {nome_cliente}. Endereco: {endereco}. Data: {data_agendamento}. Acesse o app para detalhes: {link_app}", includeLink: true },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a {razao_social} informa que a instalacao ({titulo}) foi agendada para {data_agendamento}. O tecnico {tecnico} ira ate o local. Por favor, garanta o acesso ao equipamento." },
        { type: "FORNECEDOR", enabled: true, channel: "WHATSAPP", message: "Prezado {nome}, a {razao_social} (CNPJ {cnpj_empresa}) solicita a entrega dos materiais para a OS {titulo} no endereco {endereco} ate {data_agendamento}. Contato: {telefone_empresa}." },
      ] } },
      { type: "GPS", name: "Chegada no Local", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "PHOTO", name: "Fotos Antes", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Registrar local e equipamento antes da instalacao", photoType: "ANTES" } },
      { type: "CHECKLIST", name: "Checklist Instalacao", icon: "\u2611\ufe0f", config: { items: ["Verificar rede eletrica e disjuntores", "Conferir voltagem", "Posicionar e nivelar equipamento", "Fixar suportes", "Conectar tubulacao/fiacao", "Testar funcionamento", "Limpar area de trabalho", "Orientar cliente"] } },
      { type: "NOTE", name: "Observacoes", icon: "\ud83d\udcdd", config: { placeholder: "Descreva materiais utilizados, dificuldades encontradas e orientacoes passadas ao cliente...", required: true } },
      { type: "PHOTO", name: "Fotos Depois", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Equipamento instalado e funcionando", photoType: "DEPOIS" } },
      { type: "SIGNATURE", name: "Assinatura Cliente", icon: "\u270d\ufe0f", config: { label: "Cliente confirma que a instalacao foi realizada e o equipamento esta funcionando" } },
      { type: "NOTIFY", name: "Encerramento", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a instalacao ({titulo}) foi concluida pelo tecnico {tecnico}. A {razao_social} agradece a preferencia! Em caso de duvidas: {telefone_empresa}." },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "OS {titulo} concluida por {tecnico}. Cliente: {nome_cliente} ({endereco}). Fotos e assinatura registrados no sistema." },
      ] } },
    ]
  ),
  makeTemplate(
    "Manutencao Preventiva",
    "Inspecao detalhada, checklist tecnico e relatorio",
    "\ud83d\udee0\ufe0f",
    "bg-green-500",
    [
      { type: "NOTIFY", name: "Avisos", icon: "\ud83d\udcac", config: { recipients: [
        { type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, manutencao preventiva agendada: {titulo}. Endereco: {endereco}. Data: {data_agendamento}. Verifique os materiais necessarios antes de sair. App: {link_app}", includeLink: true },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a {razao_social} lembra que a manutencao preventiva ({titulo}) esta agendada para {data_agendamento}. Tecnico: {tecnico}. Por favor, garanta o acesso ao equipamento." },
      ] } },
      { type: "GPS", name: "Chegada", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "CHECKLIST", name: "Inspecao", icon: "\ud83d\udccb", config: { items: ["Inspecao visual externa", "Verificar nivel de oleo/fluido", "Checar filtros", "Verificar correias", "Medir temperatura", "Testar pressao", "Verificar conexoes eletricas", "Lubrificar partes moveis"] } },
      { type: "NOTE", name: "Relatorio Tecnico", icon: "\ud83d\udcdd", config: { placeholder: "Condicoes encontradas em cada item, pecas substituidas, medicoes e recomendacoes para proxima manutencao...", required: true } },
      { type: "PHOTO", name: "Evidencias", icon: "\ud83d\udcf8", config: { minPhotos: 3, label: "Condicoes encontradas, pecas substituidas e estado final", photoType: "GERAL" } },
      { type: "SIGNATURE", name: "Assinatura Responsavel", icon: "\u270d\ufe0f", config: { label: "Responsavel confirma a realizacao da manutencao preventiva" } },
      { type: "NOTIFY", name: "Encerramento", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a manutencao preventiva ({titulo}) foi concluida pela {razao_social}. Proximo atendimento conforme contrato. Obrigado pela confianca!" },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Preventiva concluida: {titulo}. Tecnico: {tecnico}. Cliente: {nome_cliente}. Relatorio e fotos disponiveis no sistema." },
      ] } },
    ]
  ),
  makeTemplate(
    "Vistoria e Laudo",
    "Formulario de laudo, fotos e parecer tecnico",
    "\ud83d\udd0d",
    "bg-amber-500",
    [
      { type: "NOTIFY", name: "Agendamento", icon: "\ud83d\udcac", config: { recipients: [
        { type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, vistoria agendada: {titulo}. Endereco: {endereco}. Data: {data_agendamento}. Leve instrumentos de medicao. App: {link_app}", includeLink: true },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a {razao_social} informa que a vistoria tecnica ({titulo}) esta agendada para {data_agendamento}. Tecnico: {tecnico}. Por favor, garanta o acesso ao local." },
      ] } },
      { type: "GPS", name: "Chegada", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "PHOTO", name: "Panorama", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Fotos panoramicas do local e acesso", photoType: "ANTES" } },
      { type: "CHECKLIST", name: "Pontos de Inspecao", icon: "\u2611\ufe0f", config: { items: ["Estrutura externa", "Instalacoes eletricas", "Instalacoes hidraulicas", "Condicoes de seguranca", "Documentacao tecnica"] } },
      { type: "PHOTO", name: "Evidencias", icon: "\ud83d\udcf8", config: { minPhotos: 3, label: "Pontos inspecionados, irregularidades e detalhes relevantes", photoType: "EVIDENCIA" } },
      { type: "FORM", name: "Laudo", icon: "\ud83d\udccb", config: { fields: [
        { name: "Condicao geral", type: "select", required: true, options: ["Excelente", "Bom", "Regular", "Ruim", "Critico"] },
        { name: "Descricao das condicoes", type: "text", required: true },
        { name: "Irregularidades", type: "text", required: false },
        { name: "Recomendacoes", type: "text", required: true },
        { name: "Prazo para intervencao (dias)", type: "number", required: false },
      ] } },
      { type: "NOTE", name: "Parecer Tecnico", icon: "\ud83d\udcdd", config: { placeholder: "Parecer final: condicoes, riscos, acoes recomendadas com prioridade e prazos...", required: true } },
      { type: "SIGNATURE", name: "Assinatura", icon: "\u270d\ufe0f", config: { label: "Responsavel pelo local atesta que acompanhou a vistoria" } },
      { type: "NOTIFY", name: "Laudo Pronto", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a vistoria ({titulo}) foi concluida pela {razao_social}. O laudo tecnico sera encaminhado em breve. Duvidas: {telefone_empresa}." },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Vistoria concluida: {titulo}. Tecnico: {tecnico}. Laudo e fotos no sistema. Verifique recomendacoes tecnicas." },
      ] } },
    ]
  ),
  makeTemplate(
    "Reparo Emergencial",
    "Chamado urgente com diagnostico rapido",
    "\u26a1",
    "bg-red-500",
    [
      { type: "NOTIFY", name: "Acionamento Urgente", icon: "\ud83d\udcac", config: { recipients: [
        { type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "URGENTE {nome}! Chamado emergencial: {titulo}. Endereco: {endereco}. Cliente: {nome_cliente}. Dirija-se ao local imediatamente. App: {link_app}", includeLink: true },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a {razao_social} recebeu seu chamado urgente ({titulo}). O tecnico {tecnico} foi acionado e esta indo ao local. Voce sera avisado quando ele estiver a caminho." },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Chamado URGENTE aberto: {titulo}. Cliente: {nome_cliente} ({endereco}). Tecnico acionado: {tecnico}." },
      ] } },
      { type: "GPS", name: "Chegada", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "PHOTO", name: "Diagnostico", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Problema encontrado e danos visiveis", photoType: "ANTES" } },
      { type: "CHECKLIST", name: "Diagnostico Rapido", icon: "\ud83d\udccb", config: { items: ["Identificar causa raiz", "Verificar risco de seguranca", "Isolar area se necessario", "Verificar materiais disponiveis", "Executar reparo", "Testar funcionamento"] } },
      { type: "PHOTO", name: "Resultado", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Equipamento apos reparo, funcionando", photoType: "DEPOIS" } },
      { type: "NOTE", name: "Relatorio", icon: "\ud83d\udcdd", config: { placeholder: "Causa do problema, procedimento realizado, pecas utilizadas e recomendacoes para evitar reincidencia...", required: true } },
      { type: "SIGNATURE", name: "Aceite Cliente", icon: "\u270d\ufe0f", config: { label: "Cliente confirma que o reparo foi realizado e o equipamento funciona" } },
      { type: "NOTIFY", name: "Encerramento", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, o reparo emergencial ({titulo}) foi concluido pelo tecnico {tecnico}. A {razao_social} agradece a confianca. Se o problema retornar, entre em contato: {telefone_empresa}." },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Emergencia resolvida: {titulo}. Tecnico: {tecnico}. Cliente: {nome_cliente}. Relatorio no sistema. Avalie se necessita acompanhamento." },
        { type: "FORNECEDOR", enabled: true, channel: "WHATSAPP", message: "Prezado {nome}, informamos que a {razao_social} utilizou pecas/materiais no reparo emergencial da OS {titulo}. Favor enviar reposicao para o estoque. Contato: {telefone_empresa}." },
      ] } },
    ]
  ),
  makeTemplate(
    "Onboarding Tecnico",
    "Boas-vindas com dados de acesso ao app",
    "\ud83d\udc4b",
    "bg-purple-500",
    [
      { type: "NOTIFY", name: "Boas-vindas", icon: "\ud83d\udcac", config: { recipients: [
        { type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, tudo bem? Seja muito bem-vindo(a) a equipe da {razao_social}! Estamos felizes em contar com voce.\n\nPreparamos um app exclusivo para facilitar seu dia a dia. Por ele voce recebe suas ordens de servico, navega ate o endereco do cliente e registra tudo pelo celular.\n\nAcesse aqui: {link_app}\n\nUse o email que voce cadastrou para entrar. Se tiver qualquer duvida, fale com seu gestor — estamos aqui para te ajudar.\n\nBom trabalho e conte com a gente!" },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Novo tecnico cadastrado: {nome}. Credenciais de acesso enviadas via WhatsApp. Acompanhe o onboarding pelo sistema." },
      ] } },
    ]
  ),
  makeTemplate(
    "Onboarding Cliente",
    "Boas-vindas para novos clientes com canais de contato",
    "\ud83c\udfe2",
    "bg-indigo-500",
    [
      { type: "NOTIFY", name: "Boas-vindas", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a {razao_social} (CNPJ {cnpj_empresa}) agradece por escolher nossos servicos!\n\nPara solicitar atendimento ou tirar duvidas:\nWhatsApp: {telefone_empresa}\n\nContamos com equipe especializada para instalacoes, manutencoes e vistorias. Seu gestor de conta entrara em contato para alinhar os detalhes. Obrigado pela confianca!" },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Novo cliente cadastrado: {nome}. Mensagem de boas-vindas enviada. Entre em contato para apresentar servicos e alinhar contrato." },
      ] } },
    ]
  ),
  makeTemplate(
    "Atendimento Padrao",
    "Notificacoes em cada etapa para cliente e tecnico",
    "\ud83c\udf1f",
    "bg-teal-500",
    [
      { type: "NOTIFY", name: "Despacho", icon: "\ud83d\udcac", config: { recipients: [
        { type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, novo atendimento: {titulo}. Cliente: {nome_cliente}. Endereco: {endereco}. Data: {data_agendamento}. Confira no app: {link_app}", includeLink: true },
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a {razao_social} informa que sua solicitacao ({titulo}) foi recebida. Tecnico designado: {tecnico}. Data prevista: {data_agendamento}. Voce sera avisado quando ele estiver a caminho." },
      ] } },
      { type: "GPS", name: "Chegada", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "CHECKLIST", name: "Procedimento", icon: "\u2611\ufe0f", config: { items: ["Apresentar-se ao cliente", "Confirmar servico solicitado", "Avaliar condicoes do local", "Executar servico", "Testar resultado", "Orientar cliente", "Limpar area"] } },
      { type: "PHOTO", name: "Registro", icon: "\ud83d\udcf8", config: { minPhotos: 2, label: "Fotos antes e depois do servico", photoType: "GERAL" } },
      { type: "NOTE", name: "Observacoes", icon: "\ud83d\udcdd", config: { placeholder: "Servico realizado, condicoes encontradas, materiais utilizados e recomendacoes...", required: true } },
      { type: "SIGNATURE", name: "Assinatura Cliente", icon: "\u270d\ufe0f", config: { label: "Cliente confirma a realizacao do servico" } },
      { type: "NOTIFY", name: "Encerramento", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, o atendimento ({titulo}) foi concluido pelo tecnico {tecnico}. A {razao_social} agradece a preferencia! Duvidas: {telefone_empresa}." },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Atendimento concluido: {titulo}. Tecnico: {tecnico}. Cliente: {nome_cliente}. Fotos e assinatura no sistema." },
      ] } },
    ]
  ),
  makeTemplate(
    "Entrega de Equipamento",
    "Entrega com testes, treinamento e termo de aceite",
    "\ud83d\udce6",
    "bg-cyan-500",
    [
      { type: "NOTIFY", name: "Confirmacao", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a {razao_social} informa que a entrega do equipamento ({titulo}) esta agendada para {data_agendamento}. O tecnico {tecnico} fara instalacao, testes e treinamento. Garanta que o local esteja preparado." },
        { type: "TECNICO", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, entrega agendada: {titulo}. Cliente: {nome_cliente}. Endereco: {endereco}. Data: {data_agendamento}. Verifique itens e manuais. App: {link_app}", includeLink: true },
        { type: "FORNECEDOR", enabled: true, channel: "WHATSAPP", message: "Prezado {nome}, a {razao_social} confirma a entrega do equipamento ({titulo}) agendada para {data_agendamento} no endereco {endereco}. Favor garantir que o transporte esteja programado. Contato: {telefone_empresa}." },
      ] } },
      { type: "GPS", name: "Chegada", icon: "\ud83d\udccd", config: { auto: true } },
      { type: "CHECKLIST", name: "Checklist Entrega", icon: "\u2611\ufe0f", config: { items: ["Conferir equipamento e acessorios", "Verificar integridade", "Posicionar e instalar", "Conectar alimentacao", "Executar testes", "Calibrar parametros", "Entregar manuais", "Treinamento com operador", "Procedimentos de seguranca", "Registrar numero de serie"] } },
      { type: "PHOTO", name: "Equipamento Instalado", icon: "\ud83d\udcf8", config: { minPhotos: 3, label: "Equipamento instalado, funcionando e com placa de identificacao", photoType: "DEPOIS" } },
      { type: "FORM", name: "Dados Comissionamento", icon: "\ud83d\udccb", config: { fields: [
        { name: "Numero de serie", type: "text", required: true },
        { name: "Voltagem", type: "select", required: true, options: ["110V", "220V", "380V", "Bivolt"] },
        { name: "Testes", type: "select", required: true, options: ["Todos aprovados", "Aprovado com ressalvas", "Reprovado"] },
        { name: "Treinamento com", type: "text", required: true },
      ] } },
      { type: "SIGNATURE", name: "Termo de Aceite", icon: "\u270d\ufe0f", config: { label: "Cliente confirma recebimento em perfeitas condicoes, testes realizados e treinamento concluido" } },
      { type: "NOTIFY", name: "Encerramento", icon: "\ud83d\udcac", config: { recipients: [
        { type: "CLIENTE", enabled: true, channel: "WHATSAPP", message: "Ola {nome}, a entrega ({titulo}) foi concluida! Equipamento instalado e funcionando. A {razao_social} agradece. Duvidas sobre operacao, consulte o manual ou ligue: {telefone_empresa}." },
        { type: "GESTOR", enabled: true, channel: "WHATSAPP", message: "Entrega concluida: {titulo}. Tecnico: {tecnico}. Cliente: {nome_cliente}. Equipamento testado, treinamento feito, termo assinado." },
      ] } },
    ]
  ),
  makeTemplate(
    "Fluxo em Branco",
    "Monte do zero",
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
