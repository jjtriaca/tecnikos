// CATALOGO DE CAMPOS/BLOCOS do EngineReporter (a "biblia").
// O EngineReporter monta relatorio de QUALQUER parte do sistema — entao o catalogo e
// HIERARQUICO por ORIGEM (Orcamento de Piscina, Ordem de Servico, Financeiro, ...).
// Cada item: token {campo} + descricao + icone. Clicar insere uma caixa na pagina.
// EXTENSIVEL: pra adicionar campos novos, basta acrescentar aqui (nada hardcode na UI).
//
// kind:
//  - "text"  -> insere caixa de TEXTO com o token (resolvido no render quando houver dado)
//  - "block" -> insere caixa de BLOCO dinamico (tabela/desenho pronto: produtos, resumo, ...)
//
// OBS: hoje a renderizacao com DADOS reais existe para Orcamento de Piscina (SAMPLE_BUDGET /
// BudgetReportData). As demais origens ja aparecem na biblia (estrutura pronta); o token e
// inserido e sera resolvido conforme cada origem for ligada ao seu provedor de dados.

export type CatalogField = {
  label: string;
  kind: "text" | "block";
  token?: string;        // text: o placeholder inserido (ex: "{clientName}")
  blockType?: string;    // block: tipo do bloco (ex: "PRODUCTS_BY_SECTION")
  icon?: string;         // icone do item (emoji); default por kind
};

export type CatalogSource = {
  id: string;
  label: string;
  icon: string;
  live?: boolean;        // true = ja resolve com dados reais (Orcamento de Piscina)
  fields: CatalogField[];
};

const T = (token: string, label: string, icon?: string): CatalogField => ({ kind: "text", token, label, icon });
const B = (blockType: string, label: string, icon?: string): CatalogField => ({ kind: "block", blockType, label, icon });

export const REPORT_FIELD_CATALOG: CatalogSource[] = [
  {
    id: "generico", label: "Genéricos", icon: "🔤",
    fields: [
      T("{date}", "Data de hoje", "📅"),
      T("{pageNumber}", "Número da página", "#️⃣"),
      T("{pageCount}", "Total de páginas", "#️⃣"),
    ],
  },
  {
    id: "empresa", label: "Empresa (emissor)", icon: "🏢",
    fields: [
      T("{companyName}", "Razão social / nome", "🏢"),
      T("{companyTradeName}", "Nome fantasia", "🏢"),
      T("{companyCnpj}", "CNPJ", "🧾"),
      T("{companyPhone}", "Telefone", "📞"),
      T("{companyEmail}", "E-mail", "✉️"),
      T("{companyAddress}", "Endereço", "📍"),
      T("{companyCity}", "Cidade/UF", "📍"),
      T("{companyInstagram}", "Instagram", "📷"),
      T("{companyWhatsapp}", "WhatsApp", "💬"),
    ],
  },
  {
    id: "cliente", label: "Cliente", icon: "👤",
    fields: [
      T("{clientName}", "Nome do cliente", "👤"),
      T("{clientDocument}", "CPF / CNPJ", "🧾"),
      T("{clientPhone}", "Telefone", "📞"),
      T("{clientEmail}", "E-mail", "✉️"),
      T("{clientAddress}", "Endereço", "📍"),
      T("{clientCity}", "Cidade", "📍"),
      T("{clientState}", "Estado (UF)", "📍"),
    ],
  },
  {
    id: "orcamento_piscina", label: "Orçamento de Piscina", icon: "🏊", live: true,
    fields: [
      T("{budgetCode}", "Número do orçamento", "🔢"),
      T("{budgetTitle}", "Título do orçamento", "🏷️"),
      T("{budgetDate}", "Data do orçamento", "📅"),
      T("{budgetTotal}", "Valor total", "💰"),
      T("{budgetSubtotal}", "Subtotal", "💰"),
      T("{budgetDiscount}", "Desconto", "💰"),
      T("{budgetTaxes}", "Impostos / taxas", "💰"),
      T("{validityDays}", "Validade (dias)", "⏳"),
      T("{poolLength}", "Comprimento (m)", "📐"),
      T("{poolWidth}", "Largura (m)", "📐"),
      T("{poolDepth}", "Profundidade (m)", "📐"),
      T("{poolArea}", "Área (m²)", "📐"),
      T("{poolVolume}", "Volume (m³)", "📐"),
      T("{poolPerimeter}", "Perímetro (m)", "📐"),
      T("{paymentTerms}", "Condições de pagamento", "💳"),
      T("{termsConditions}", "Termos e condições (texto)", "📜"),
      T("{equipmentWarranty}", "Garantia dos equipamentos", "🛡️"),
      T("{workWarranty}", "Garantia da obra", "🛡️"),
      B("COVER", "Bloco: Capa pronta", "🖼️"),
      B("PRODUCTS_BY_SECTION", "Bloco: Produtos por etapa", "📋"),
      B("BUDGET_SUMMARY", "Bloco: Resumo do orçamento", "🧮"),
      B("INSTALLMENTS", "Bloco: Plano de pagamento", "💳"),
      B("TERMS_CONDITIONS", "Bloco: Termos e condições", "📜"),
      B("PHOTOS_GALLERY", "Bloco: Galeria de fotos", "🖼️"),
      B("CUSTOM_TABLE", "Bloco: Tabela personalizada", "▦"),
      B("HEATING_SOLAR", "Bloco: Datasheet Coletor Solar", "☀️"),
      B("HEATING_BOMBA", "Bloco: Datasheet Bomba de Calor", "♨️"),
    ],
  },
  {
    id: "ordem_servico", label: "Ordem de Serviço", icon: "🛠️",
    fields: [
      T("{osCode}", "Número da OS", "🔢"),
      T("{osDate}", "Data de abertura", "📅"),
      T("{osStatus}", "Status", "🚦"),
      T("{osClient}", "Cliente", "👤"),
      T("{osTechnician}", "Técnico responsável", "🧑‍🔧"),
      T("{osDescription}", "Descrição do serviço", "📝"),
      T("{osServices}", "Serviços realizados", "🔧"),
      T("{osMaterials}", "Materiais utilizados", "📦"),
      T("{osStartedAt}", "Início", "🕒"),
      T("{osFinishedAt}", "Conclusão", "🕒"),
      T("{osTotal}", "Valor total", "💰"),
    ],
  },
  {
    id: "financeiro", label: "Financeiro", icon: "💰",
    fields: [
      T("{finPeriod}", "Período", "📅"),
      T("{finTotalReceitas}", "Total de receitas", "📈"),
      T("{finTotalDespesas}", "Total de despesas", "📉"),
      T("{finResultado}", "Resultado (lucro/prejuízo)", "🧮"),
      T("{finSaldoAtual}", "Saldo atual", "🏦"),
    ],
  },
  {
    id: "produto", label: "Produto / Serviço", icon: "📦",
    fields: [
      T("{productName}", "Nome", "📦"),
      T("{productCode}", "Código", "🔢"),
      T("{productPrice}", "Preço", "💰"),
      T("{productUnit}", "Unidade", "📏"),
      T("{productDescription}", "Descrição", "📝"),
    ],
  },
];
