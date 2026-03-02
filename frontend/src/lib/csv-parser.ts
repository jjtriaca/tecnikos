/**
 * Parser CSV/XLSX com auto-detecção de formato, separador e mapeamento de colunas.
 * Compatível com exports do Sankhya ERP e Excel BR.
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
 * Detecta automaticamente o formato Sankhya (que tem linhas de cabeçalho/metadados antes dos dados reais).
 */
export function parseXLSX(buffer: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (rawRows.length < 2) return { headers: [], rows: [] };

  // Detecta onde estão os headers reais.
  // Sankhya coloca 1-2 linhas de título/metadados antes dos headers.
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
 */
const COLUMN_MAP: Record<string, string[]> = {
  name: [
    "nome parceiro", "nome", "razao social", "razão social",
    "nomeparc", "nome/razão social", "nome/razao social",
  ],
  tradeName: [
    "nome fantasia", "nomefantasia", "fantasia", "nome_fantasia", "razão social", "razao social",
  ],
  document: [
    "cnpj / cpf", "cnpj/cpf", "cgc/cpf", "cgc_cpf", "cnpj", "cpf",
    "cgc", "documento", "cpf/cnpj", "cnpj/cpf", "cpf_cnpj",
  ],
  personTypeSankhya: [
    "tipo de pessoa",
  ],
  phone: [
    "telefone", "fone", "tel", "phone",
  ],
  // phone2 removido - campo não existe no schema Partner
  email: [
    "email", "e-mail", "e_mail",
  ],
  addressNumber: [
    "número", "numero", "nro", "num", "nr",
  ],
  addressComp: [
    "complemento", "compl",
  ],
  neighborhood: [
    "nome (bairro)",
  ],
  cityState: [
    "nome + uf (cidade)",
  ],
  city: [
    "cidade", "municipio", "município",
  ],
  state: [
    "uf",
  ],
  cep: [
    "cep", "cep_fiscal",
  ],
  ie: [
    "insc. estadual / identidade", "ie", "inscricao estadual",
    "inscrição estadual", "insc estadual", "inscestadual",
  ],
  im: [
    "inscricao municipal", "inscrição municipal", "insc. municipal",
  ],
  isCliente: ["cliente"],
  isFornecedor: ["fornecedor"],
  isAtivo: ["ativo"],
  addressStreet: ["endereco", "endereço", "logradouro", "rua"],
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
      const sankhyaPersonType = get("personTypeSankhya").toLowerCase();

      // Detecta PJ/PF pelo campo "Tipo de pessoa" do Sankhya ou pelo tamanho do documento
      let isPJ = rawDoc.length >= 14;
      if (sankhyaPersonType.includes("juríd") || sankhyaPersonType.includes("juridic")) isPJ = true;
      if (sankhyaPersonType.includes("físic") || sankhyaPersonType.includes("fisic")) isPJ = false;

      // Detecta partnerTypes pelo "Cliente"/"Fornecedor" do Sankhya
      const partnerTypes: string[] = [];
      const isCliente = get("isCliente").toLowerCase();
      const isFornecedor = get("isFornecedor").toLowerCase();
      if (isCliente === "sim" || isCliente === "s" || isCliente === "true") partnerTypes.push("CLIENTE");
      if (isFornecedor === "sim" || isFornecedor === "s" || isFornecedor === "true") partnerTypes.push("FORNECEDOR");
      if (partnerTypes.length === 0) partnerTypes.push("CLIENTE"); // default

      // Status pelo "Ativo" do Sankhya
      const ativoVal = get("isAtivo").toLowerCase();
      const status = (ativoVal === "não" || ativoVal === "nao" || ativoVal === "n" || ativoVal === "false")
        ? "INATIVO" : "ATIVO";

      // Cidade/UF: prioriza campo combinado "Nome + UF (Cidade)" ex: "PRIMAVERA DO LESTE - MT"
      const cityState = get("cityState");
      let city = "";
      let state = "";
      if (cityState) {
        const parts = cityState.split(" - ");
        if (parts.length >= 2) {
          city = parts.slice(0, -1).join(" - ").trim();
          state = parts[parts.length - 1].trim();
        } else {
          city = cityState;
        }
      } else {
        city = get("city");
        state = get("state");
      }

      // Pega nome fantasia do campo "Razão social" se o name veio de "Nome Parceiro" (que é abreviado)
      let tradeName = get("tradeName");
      const name = get("name");
      // Se tradeName é igual ao name, limpa (redundante)
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
      // Phone: limpa formatação (066) 3498-1938 → 06634981938
      const phone = get("phone");
      if (phone) partner.phone = phone.replace(/[^\d]/g, "");

      const email = get("email");
      if (email) partner.email = email.toLowerCase().split(";")[0].trim(); // pega só o primeiro se tiver vários

      // Endereço: no Sankhya, o campo "Endereço" pode ser um código numérico
      const addressStreet = get("addressStreet");
      if (addressStreet && !/^\d+$/.test(addressStreet)) partner.addressStreet = addressStreet;

      const addressNumber = get("addressNumber");
      if (addressNumber) partner.addressNumber = addressNumber;

      const addressComp = get("addressComp");
      if (addressComp) partner.addressComp = addressComp;

      const neighborhood = get("neighborhood");
      if (neighborhood && !/^\d+$/.test(neighborhood)) partner.neighborhood = neighborhood;

      if (city) partner.city = city;
      if (state) partner.state = state.toUpperCase().slice(0, 2);

      const cep = get("cep");
      if (cep) partner.cep = cep.replace(/[^\d]/g, "");

      const ie = get("ie");
      if (ie && ie.toUpperCase() !== "ISENTO") partner.ie = ie;

      const im = get("im");
      if (im) partner.im = im;

      return partner;
    });
}

/* ───────────────── Friendly field labels ───────────────── */

export const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  tradeName: "Nome Fantasia",
  document: "Documento",
  personTypeSankhya: "Tipo Pessoa",
  phone: "Telefone",
  email: "Email",
  addressStreet: "Endereço",
  addressNumber: "Número",
  addressComp: "Complemento",
  neighborhood: "Bairro",
  city: "Cidade",
  cityState: "Cidade/UF",
  state: "UF",
  cep: "CEP",
  ie: "Insc. Estadual",
  im: "Insc. Municipal",
  isCliente: "Cliente",
  isFornecedor: "Fornecedor",
  isAtivo: "Ativo",
};
