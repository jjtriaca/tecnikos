export interface Product {
  id: string;
  companyId: string;
  code?: string;
  barcode?: string;
  description: string;
  brand?: string;
  model?: string;
  unit: string;
  ncm?: string;
  cest?: string;
  origin?: string;
  category?: string;
  icmsRate?: number;
  ipiRate?: number;
  pisRate?: number;
  cofinsRate?: number;
  csosn?: string;
  cfop?: string;
  cst?: string;
  cstPis?: string;
  cstCofins?: string;
  costCents?: number;
  salePriceCents?: number;
  profitMarginPercent?: number;
  lastPurchasePriceCents?: number;
  averageCostCents?: number;
  finalidade?: string;
  currentStock: number;
  minStock?: number;
  maxStock?: number;
  location?: string;
  status: string;
  // Tipo do produto no modulo Piscina (Cascata, Aquecedor, Conjunto de filtragem,
  // Tubos cascata, etc.). Substitui o uso de technicalSpecs.categoriaPlanilha.
  // Alimenta dropdown de filtro no AutoSelectModal de orcamento de piscina.
  poolType?: string;
  // Quantidade padrao ao escolher esse produto numa linha do orcamento de piscina.
  // Null = sem padrao (fluxo usa 1). Linha do orcamento fica amarela se qty != defaultQty.
  defaultQty?: number | null;
  // Specs tecnicas livres em JSON (modulo Piscina). Chaves comuns:
  // vazaoM3h, tuboEntradaMm, kcalHNominal, kwNominal, btuH, copMax,
  // copAt50Air26, copAt50Air15, ratedInputPowerKW, potenciaCv,
  // voltagem, amperagem, bifTrif, tempoMontagemH.
  // Usadas pelo auto-selecao de produto (auto-select.helper.ts).
  technicalSpecs?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  equivalents?: ProductEquivalent[];
  _count?: { equivalents: number };
}

export interface ProductEquivalent {
  id: string;
  productId: string;
  supplierId: string;
  supplierCode: string;
  supplierDescription?: string;
  lastPriceCents?: number;
  lastPurchaseDate?: string;
  supplier?: { id: string; name: string };
}

export const UNIT_OPTIONS = ['UN', 'CX', 'KG', 'MT', 'LT', 'PC', 'PAR', 'JG', 'KIT'];

export const ORIGIN_OPTIONS = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (Importacao)' },
  { value: '2', label: '2 - Estrangeira (Mercado interno)' },
];
