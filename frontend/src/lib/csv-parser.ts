/**
 * Parser CSV/XLSX com auto-detecção de formato, separador e mapeamento de colunas.
 * Aceita o modelo CSV padrão do Tecnikos ou qualquer planilha com colunas similares.
 */
import * as XLSX from "xlsx";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

/* ───────────────── CSV helpers ───────────────── */

function removeBOM(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectSeparator(firstLine: string): string {
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  if (counts[";"] >= counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts[","] >= counts["\t"]) return ",";
  return "\t";
}

function parseLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === separator) { fields.push(current.trim()); current = ""; }
      else current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Parseia texto CSV e retorna headers + rows */
export function parseCSV(text: string): ParsedFile {
  const clean = removeBOM(text);
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const separator = detectSeparator(lines[0]);
  const headers = parseLine(lines[0], separator);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], separator);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }
  return { headers, rows };
}

/* ───────────────── XLSX parser ───────────────── */

/**
 * Parseia arquivo XLSX (ArrayBuffer).
 * Detecta automaticamente linhas de cabeçalho/metadados antes dos dados reais.
 */
export function parseXLSX(buffer: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (rawRows.length < 2) return { headers: [], rows: [] };

  // Detecta onde estão os headers reais.
  // Algumas planilhas colocam linhas de título/metadados antes dos headers.
  // Heurística: a linha de headers é a primeira linha com 5+ colunas preenchidas com texto.
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    const row = rawRows[i];
    const filledTexts = row.filter((c) => typeof c === "string" && c.trim().length > 0).length;
    if (filledTexts >= 5) {
      headerIdx = i;
      break;
    }
  }

  const headers = rawRows[headerIdx].map((h) => String(h ?? "").trim()).filter(Boolean);

  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    // Pula linhas vazias ou de metadados
    const nonEmpty = rawRow.filter((c) => c !== "" && c != null).length;
    if (nonEmpty < 2) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const val = rawRow[j];
      row[headers[j]] = val != null ? String(val).trim() : "";
    }
    // Pula se não tem nome (primeira coluna vazia)
    if (!row[headers[0]]?.trim()) continue;
    rows.push(row);
  }

  return { headers, rows };
}

/* ───────────────── Column Mapping ───────────────── */

/**
 * Mapeamento de colunas → campo do Partner.
 * Chave = campo do Partner, Valor = lista de aliases (lowercase) que matcham.
 * Compatível com o modelo CSV padrão do Tecnikos e planilhas genéricas.
 */
const COLUMN_MAP: Record<string, string[]> = {
  name: [
    "nome", "nome parceiro", "razao social", "razão social",
    "nome/razão social", "nome/razao social",
  ],
  tradeName: [
    "nome fantasia", "fantasia", "nome_fantasia",
  ],
  document: [
    "documento", "cnpj/cpf", "cpf/cnpj", "cnpj", "cpf",
    "cnpj / cpf", "cgc/cpf", "cgc_cpf", "cgc", "cpf_cnpj",
  ],
  personType: [
    "tipo pessoa", "tipo de pessoa", "pessoa",
  ],
  phone: [
    "telefone", "fone", "tel", "phone",
  ],
  email: [
    "email", "e-mail", "e_mail",
  ],
  addressStreet: [
    "endereco", "endereço", "logradouro", "rua",
    "nome (endereço)", "nome (endereco)",
  ],
  addressNumber: [
    "número", "numero", "nro", "num", "nr",
  ],
  addressComp: [
    "complemento", "compl",
  ],
  neighborhood: [
    "bairro",
  ],
  city: [
    "cidade", "municipio", "município",
  ],
  state: [
    "uf", "estado",
  ],
  cep: [
    "cep", "cep_fiscal",
  ],
  ie: [
    "insc. estadual", "ie", "inscricao estadual",
    "inscrição estadual", "insc estadual", "inscestadual",
    "insc. estadual / identidade",
  ],
  im: [
    "insc. municipal", "inscricao municipal", "inscrição municipal", "im",
  ],
  partnerType: [
    "tipo parceiro", "tipo", "tipo de parceiro",
  ],
  status: [
    "status", "situacao", "situação", "ativo",
  ],
  regime: [
    "regime", "regime contratacao", "regime contratação",
  ],
};

/** Mapeia headers do arquivo para campos do Partner */
export function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();

    for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
      if (usedFields.has(field)) continue; // cada campo só mapeia uma vez

      if (aliases.some((alias) => normalized === alias)) {
        mapping[header] = field;
        usedFields.add(field);
        break;
      }
    }
  }

  // Segundo passe: fuzzy (includes) para o que sobrou
  // Ignora headers que parecem códigos (ex: "Cód. Cidade", "Cód. Parceiro")
  for (const header of headers) {
    if (mapping[header]) continue;
    const normalized = header.toLowerCase().trim();
    if (normalized.startsWith("cód") || normalized.startsWith("cod")) continue;

    for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
      if (usedFields.has(field)) continue;
      if (aliases.some((alias) => alias.length >= 3 && normalized.includes(alias))) {
        mapping[header] = field;
        usedFields.add(field);
        break;
      }
    }
  }

  return mapping;
}

/* ───────────────── Row → Partner ───────────────── */

function cleanDocument(doc: string): string {
  return doc.replace(/[.\-/\s]/g, "");
}

/** Converte rows parseados em dados de Partner prontos para a API */
export function mapRowsToPartners(
  rows: Record<string, string>[],
  columnMapping: Record<string, string>
): Record<string, unknown>[] {
  // Inverte: csvHeader → field  →  field → csvHeader
  const fieldToHeader: Record<string, string> = {};
  for (const [csvHeader, partnerField] of Object.entries(columnMapping)) {
    if (!fieldToHeader[partnerField]) {
      fieldToHeader[partnerField] = csvHeader;
    }
  }

  return rows
    .filter((row) => {
      const nameHeader = fieldToHeader["name"];
      return nameHeader && row[nameHeader]?.trim();
    })
    .map((row) => {
      const get = (field: string) => {
        const header = fieldToHeader[field];
        return header ? row[header]?.trim() || "" : "";
      };

      const rawDoc = cleanDocument(get("document"));

      // Detecta PJ/PF pelo campo "Tipo Pessoa" ou pelo tamanho do documento
      const personTypeRaw = get("personType").toUpperCase();
      let isPJ = rawDoc.length >= 14;
      if (personTypeRaw === "PJ" || personTypeRaw.includes("JURÍD") || personTypeRaw.includes("JURIDIC")) isPJ = true;
      if (personTypeRaw === "PF" || personTypeRaw.includes("FÍSIC") || personTypeRaw.includes("FISIC")) isPJ = false;

      // Detecta partnerTypes pelo campo "Tipo Parceiro" ou default CLIENTE
      const partnerTypes: string[] = [];
      const partnerTypeRaw = get("partnerType").toUpperCase();
      if (partnerTypeRaw.includes("CLIENTE") || partnerTypeRaw.includes("CLI")) partnerTypes.push("CLIENTE");
      if (partnerTypeRaw.includes("FORNECEDOR") || partnerTypeRaw.includes("FORN")) partnerTypes.push("FORNECEDOR");
      if (partnerTypeRaw.includes("TECNICO") || partnerTypeRaw.includes("TÉCNICO") || partnerTypeRaw.includes("TEC")) partnerTypes.push("TECNICO");
      if (partnerTypes.length === 0) partnerTypes.push("CLIENTE"); // default

      // Status
      const statusRaw = get("status").toUpperCase();
      let status = "ATIVO";
      if (statusRaw === "INATIVO" || statusRaw === "NÃO" || statusRaw === "NAO" || statusRaw === "N" || statusRaw === "FALSE") {
        status = "INATIVO";
      }

      // Nome fantasia
      let tradeName = get("tradeName");
      const name = get("name");
      if (tradeName && tradeName.toUpperCase() === name.toUpperCase()) tradeName = "";

      const partner: Record<string, unknown> = {
        partnerTypes,
        personType: isPJ ? "PJ" : "PF",
        name,
        status,
      };

      if (tradeName) partner.tradeName = tradeName;
      if (rawDoc) {
        partner.document = rawDoc;
        partner.documentType = isPJ ? "CNPJ" : "CPF";
      }

      const phone = get("phone");
      if (phone) partner.phone = phone.replace(/[^\d]/g, "");

      const email = get("email");
      if (email) partner.email = email.toLowerCase().split(";")[0].trim();

      const addressStreet = get("addressStreet");
      if (addressStreet && !/^\d+$/.test(addressStreet)) partner.addressStreet = addressStreet;

      const addressNumber = get("addressNumber");
      if (addressNumber) partner.addressNumber = addressNumber;

      const addressComp = get("addressComp");
      if (addressComp) partner.addressComp = addressComp;

      const neighborhood = get("neighborhood");
      if (neighborhood && !/^\d+$/.test(neighborhood)) partner.neighborhood = neighborhood;

      const city = get("city");
      if (city) partner.city = city;

      const stateVal = get("state");
      if (stateVal) partner.state = stateVal.toUpperCase().slice(0, 2);

      const cep = get("cep");
      if (cep) partner.cep = cep.replace(/[^\d]/g, "");

      const ie = get("ie");
      if (ie && ie.toUpperCase() !== "ISENTO") partner.ie = ie;

      const im = get("im");
      if (im) partner.im = im;

      // Regime (CLT/PJ) — só para técnicos
      const regime = get("regime").toUpperCase();
      if (regime === "CLT" || regime === "PJ") partner.regime = regime;

      return partner;
    });
}

/* ───────────────── Friendly field labels ───────────────── */

export const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  tradeName: "Nome Fantasia",
  document: "Documento",
  personType: "Tipo Pessoa",
  phone: "Telefone",
  email: "Email",
  addressStreet: "Endereço",
  addressNumber: "Número",
  addressComp: "Complemento",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "UF",
  cep: "CEP",
  ie: "Insc. Estadual",
  im: "Insc. Municipal",
  partnerType: "Tipo Parceiro",
  status: "Status",
  regime: "Regime",
};

/* ───────────────── CSV Template Generator ───────────────── */

/** Gera o conteúdo CSV do modelo padrão de importação de parceiros */
export function generatePartnerCSVTemplate(): string {
  const headers = [
    "Nome",
    "Nome Fantasia",
    "Documento",
    "Tipo Pessoa",
    "Tipo Parceiro",
    "Telefone",
    "Email",
    "Endereço",
    "Número",
    "Complemento",
    "Bairro",
    "Cidade",
    "UF",
    "CEP",
    "Insc. Estadual",
    "Insc. Municipal",
    "Status",
    "Regime",
  ];

  const exampleRows = [
    [
      "João Silva Materiais LTDA",
      "JS Materiais",
      "12.345.678/0001-90",
      "PJ",
      "CLIENTE",
      "(11) 98765-4321",
      "contato@jsmateriais.com.br",
      "Rua das Flores",
      "123",
      "Sala 4",
      "Centro",
      "São Paulo",
      "SP",
      "01001-000",
      "123.456.789.000",
      "",
      "ATIVO",
      "",
    ],
    [
      "Maria Oliveira",
      "",
      "123.456.789-00",
      "PF",
      "TECNICO",
      "(21) 91234-5678",
      "maria@email.com",
      "Av. Brasil",
      "456",
      "",
      "Copacabana",
      "Rio de Janeiro",
      "RJ",
      "22041-080",
      "",
      "",
      "ATIVO",
      "PJ",
    ],
    [
      "Empresa ABC LTDA",
      "ABC Serviços",
      "98.765.432/0001-10",
      "PJ",
      "FORNECEDOR",
      "(31) 3333-4444",
      "abc@empresa.com",
      "Rua Minas Gerais",
      "789",
      "Bloco B",
      "Savassi",
      "Belo Horizonte",
      "MG",
      "30130-000",
      "987.654.321.000",
      "12345",
      "ATIVO",
      "",
    ],
  ];

  const sep = ";";
  const lines = [headers.join(sep)];
  for (const row of exampleRows) {
    lines.push(row.map(v => v.includes(sep) ? `"${v}"` : v).join(sep));
  }
  return "\uFEFF" + lines.join("\r\n"); // BOM for Excel compatibility
}
