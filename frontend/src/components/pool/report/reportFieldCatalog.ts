// CATALOGO DE CAMPOS/BLOCOS do EngineReporter (a "biblia").
//
// O relatorio e gerado a partir de UMA ORIGEM (um documento do sistema). TODOS os campos —
// inclusive CLIENTE/FORNECEDOR e EMPRESA — ficam ANINHADOS dentro da origem, porque e dela
// que o sistema sabe de onde puxar o dado (o cliente DAQUELE orcamento/OS/conta, etc.).
//
// Hierarquia: ORIGEM > SUBGRUPO > campos.  Ex.: "Orçamento de Obras > Cliente > {clientName}".
//
// Origens = documentos reais do modelo (Prisma):
//   - Orçamentos de Serviços  -> Quote
//   - Orçamentos de Obras     -> PoolBudget   (DADOS REAIS hoje; demais resolvem ao ligar a fonte)
//   - Ordem de Serviço        -> ServiceOrder
//   - Contas a Receber        -> FinancialEntry (type=RECEIVABLE)
//   - Contas a Pagar          -> FinancialEntry (type=PAYABLE)
//
// Tokens do DOCUMENTO sao especificos por origem (ex: {budgetCode} vs {quoteCode} vs {osCode}).
// Tokens das ENTIDADES compartilhadas (Cliente/Empresa) sao os mesmos em todas as origens
// (resolvem pela relacao do documento ligado ao relatorio). EXTENSIVEL: e so acrescentar aqui.

export type CatalogField = {
  label: string;
  kind: "text" | "block";
  token?: string;        // text: placeholder inserido (ex: "{clientName}")
  blockType?: string;    // block: tipo do bloco (ex: "PRODUCTS_BY_SECTION")
  icon?: string;
};
export type CatalogGroup = { label: string; icon?: string; fields: CatalogField[] };
export type CatalogSource = { id: string; label: string; icon: string; live?: boolean; groups: CatalogGroup[] };

const T = (token: string, label: string, icon?: string): CatalogField => ({ kind: "text", token, label, icon });
const B = (blockType: string, label: string, icon?: string): CatalogField => ({ kind: "block", blockType, label, icon });

// ── Subgrupos COMPARTILHADOS (Partner/Company) — mesmos tokens em toda origem ──
const CLIENTE = (label = "Cliente"): CatalogGroup => ({
  label, icon: "👤", fields: [
    T("{clientName}", "Nome / razão social", "👤"),
    T("{clientTradeName}", "Nome fantasia", "🏢"),
    T("{clientDocument}", "CPF / CNPJ", "🧾"),
    T("{clientPhone}", "Telefone", "📞"),
    T("{clientEmail}", "E-mail", "✉️"),
    T("{clientAddress}", "Endereço (rua, nº)", "📍"),
    T("{clientNeighborhood}", "Bairro", "📍"),
    T("{clientCity}", "Cidade", "📍"),
    T("{clientState}", "Estado (UF)", "📍"),
    T("{clientZip}", "CEP", "📮"),
  ],
});
const EMPRESA: CatalogGroup = {
  label: "Empresa (emissor)", icon: "🏢", fields: [
    T("{companyName}", "Razão social", "🏢"),
    T("{companyTradeName}", "Nome fantasia", "🏢"),
    T("{companyCnpj}", "CNPJ", "🧾"),
    T("{companyIe}", "Inscrição estadual", "🧾"),
    T("{companyPhone}", "Telefone", "📞"),
    T("{companyEmail}", "E-mail", "✉️"),
    T("{companyAddress}", "Endereço", "📍"),
    T("{companyCity}", "Cidade/UF", "📍"),
    T("{companyOwnerName}", "Responsável", "🧑"),
  ],
};
const GENERICOS: CatalogGroup = {
  label: "Genéricos", icon: "🔤", fields: [
    T("{date}", "Data de hoje", "📅"),
    T("{pageNumber}", "Número da página", "#️⃣"),
    T("{pageCount}", "Total de páginas", "#️⃣"),
  ],
};

export const REPORT_FIELD_CATALOG: CatalogSource[] = [
  // ── ORÇAMENTOS DE SERVIÇOS (Quote) ──
  {
    id: "orcamento_servicos", label: "Orçamentos de Serviços", icon: "🧰",
    groups: [
      { label: "Orçamento", icon: "📄", fields: [
        T("{quoteCode}", "Número do orçamento", "🔢"),
        T("{quoteTitle}", "Título", "🏷️"),
        T("{quoteDescription}", "Descrição", "📝"),
        T("{quoteDate}", "Data", "📅"),
        T("{quoteStatus}", "Status", "🚦"),
        T("{quoteValidityDays}", "Validade (dias)", "⏳"),
        T("{quoteSubtotal}", "Subtotal", "💰"),
        T("{quoteDiscount}", "Desconto", "💰"),
        T("{quoteTotal}", "Valor total", "💰"),
        T("{quoteTerms}", "Termos e condições", "📜"),
      ] },
      CLIENTE(), EMPRESA,
      { label: "Blocos prontos", icon: "🧩", fields: [
        B("CUSTOM_TABLE", "Tabela de itens", "▦"),
      ] },
      GENERICOS,
    ],
  },
  // ── ORÇAMENTOS DE OBRAS (PoolBudget) — DADOS REAIS hoje ──
  {
    id: "orcamento_obras", label: "Orçamentos de Obras (Piscina)", icon: "🏊", live: true,
    groups: [
      { label: "Orçamento", icon: "📄", fields: [
        T("{budgetCode}", "Número do orçamento", "🔢"),
        T("{budgetTitle}", "Título", "🏷️"),
        T("{budgetDate}", "Data", "📅"),
        T("{budgetTotal}", "Valor total", "💰"),
        T("{budgetSubtotal}", "Subtotal", "💰"),
        T("{budgetDiscount}", "Desconto", "💰"),
        T("{budgetTaxes}", "Impostos / taxas", "💰"),
        T("{validityDays}", "Validade (dias)", "⏳"),
        T("{paymentTerms}", "Condições de pagamento", "💳"),
        T("{termsConditions}", "Termos e condições", "📜"),
        T("{equipmentWarranty}", "Garantia dos equipamentos", "🛡️"),
        T("{workWarranty}", "Garantia da obra", "🛡️"),
      ] },
      CLIENTE(),
      { label: "Piscina (dimensões)", icon: "📐", fields: [
        T("{poolLength}", "Comprimento (m)", "📐"),
        T("{poolWidth}", "Largura (m)", "📐"),
        T("{poolDepth}", "Profundidade (m)", "📐"),
        T("{poolArea}", "Área (m²)", "📐"),
        T("{poolVolume}", "Volume (m³)", "📐"),
        T("{poolPerimeter}", "Perímetro (m)", "📐"),
      ] },
      EMPRESA,
      { label: "Blocos prontos", icon: "🧩", fields: [
        B("COVER", "Capa pronta", "🖼️"),
        B("PRODUCTS_BY_SECTION", "Produtos por etapa", "📋"),
        B("BUDGET_SUMMARY", "Resumo do orçamento", "🧮"),
        B("INSTALLMENTS", "Plano de pagamento", "💳"),
        B("TERMS_CONDITIONS", "Termos e condições", "📜"),
        B("PHOTOS_GALLERY", "Galeria de fotos", "🖼️"),
        B("CUSTOM_TABLE", "Tabela personalizada", "▦"),
        B("HEATING_SOLAR", "Datasheet Coletor Solar", "☀️"),
        B("HEATING_BOMBA", "Datasheet Bomba de Calor", "♨️"),
      ] },
      GENERICOS,
    ],
  },
  // ── ORDEM DE SERVIÇO (ServiceOrder) ──
  {
    id: "ordem_servico", label: "Ordem de Serviço", icon: "🛠️",
    groups: [
      { label: "Ordem de Serviço", icon: "📄", fields: [
        T("{osCode}", "Número da OS", "🔢"),
        T("{osTitle}", "Título", "🏷️"),
        T("{osDescription}", "Descrição", "📝"),
        T("{osStatus}", "Status", "🚦"),
        T("{osAddress}", "Endereço do serviço", "📍"),
        T("{osDeadline}", "Prazo", "⏳"),
        T("{osStartedAt}", "Início", "🕒"),
        T("{osFinishedAt}", "Conclusão", "🕒"),
        T("{osValue}", "Valor", "💰"),
        T("{osServiceReport}", "Serviços prestados (relatório)", "🔧"),
        T("{osMaterialsUsed}", "Materiais utilizados", "📦"),
      ] },
      { label: "Técnico", icon: "🧑‍🔧", fields: [
        T("{osTechnician}", "Técnico responsável", "🧑‍🔧"),
        T("{osTechnicianPhone}", "Telefone do técnico", "📞"),
      ] },
      CLIENTE(), EMPRESA, GENERICOS,
    ],
  },
  // ── CONTAS A RECEBER (FinancialEntry RECEIVABLE) ──
  {
    id: "contas_receber", label: "Contas a Receber", icon: "📥",
    groups: [
      { label: "Conta a receber", icon: "📄", fields: [
        T("{finCode}", "Número (FIN)", "🔢"),
        T("{finDescription}", "Descrição", "📝"),
        T("{finGross}", "Valor bruto", "💰"),
        T("{finNet}", "Valor líquido", "💰"),
        T("{finDueDate}", "Vencimento", "📅"),
        T("{finPaidAt}", "Recebido em", "📅"),
        T("{finStatus}", "Status", "🚦"),
        T("{finPaymentMethod}", "Forma de pagamento", "💳"),
        T("{finCategory}", "Categoria (plano de contas)", "🗂️"),
      ] },
      CLIENTE("Cliente (pagador)"), EMPRESA, GENERICOS,
    ],
  },
  // ── CONTAS A PAGAR (FinancialEntry PAYABLE) ──
  {
    id: "contas_pagar", label: "Contas a Pagar", icon: "📤",
    groups: [
      { label: "Conta a pagar", icon: "📄", fields: [
        T("{finCode}", "Número (FIN)", "🔢"),
        T("{finDescription}", "Descrição", "📝"),
        T("{finGross}", "Valor bruto", "💰"),
        T("{finNet}", "Valor líquido", "💰"),
        T("{finDueDate}", "Vencimento", "📅"),
        T("{finPaidAt}", "Pago em", "📅"),
        T("{finStatus}", "Status", "🚦"),
        T("{finPaymentMethod}", "Forma de pagamento", "💳"),
        T("{finCategory}", "Categoria (plano de contas)", "🗂️"),
      ] },
      CLIENTE("Fornecedor (beneficiário)"), EMPRESA, GENERICOS,
    ],
  },
];
