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
