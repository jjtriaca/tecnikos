/**
 * Parser CSV leve com auto-detecção de separador e suporte a campos entre aspas.
 * Compatível com exports do Sankhya e Excel BR (separador ; com BOM UTF-8).
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/** Remove BOM (Byte Order Mark) do início do texto */
function removeBOM(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Auto-detecta separador (;  ,  \t) analisando a primeira linha */
function detectSeparator(firstLine: string): string {
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;

  for (const ch of firstLine) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch in counts) {
      counts[ch]++;
    }
  }

  // Retorna o separador mais frequente (prioriza ; para BR)
  if (counts[";"] >= counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts[","] >= counts["\t"]) return ",";
  return "\t";
}

/** Parseia uma linha CSV respeitando campos entre aspas */
function parseLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // pula aspas escapada
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === separator) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/** Parseia texto CSV completo e retorna headers + rows como objetos */
export function parseCSV(text: string): ParsedCSV {
  const clean = removeBOM(text);
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

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

/** Mapeamento de colunas Sankhya → campos do Partner */
const COLUMN_MAP: Record<string, string[]> = {
  name: ["nome", "razao social", "razão social", "nomeparc", "nome/razão social", "nome/razao social", "nome parceiro"],
  tradeName: ["nome fantasia", "nomefantasia", "fantasia", "nome_fantasia"],
  document: ["cgc/cpf", "cgc_cpf", "cnpj", "cpf", "cgc", "documento", "cpf/cnpj", "cnpj/cpf", "cpf_cnpj"],
  phone: ["telefone", "fone", "tel", "celular", "phone"],
  email: ["email", "e-mail", "e_mail"],
  addressStreet: ["endereco", "endereço", "logradouro", "rua"],
  addressNumber: ["numero", "número", "nro", "num", "nr"],
  addressComp: ["complemento", "compl"],
  neighborhood: ["bairro"],
  city: ["cidade", "municipio", "município"],
  state: ["uf", "estado"],
  cep: ["cep", "cep_fiscal"],
  ie: ["ie", "inscricao estadual", "inscrição estadual", "insc estadual", "inscestadual"],
  im: ["im", "inscricao municipal", "inscrição municipal"],
};

/** Mapeia headers do CSV para campos do Partner usando fuzzy match */
export function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();

    for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
      if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
        if (!mapping[header]) {
          mapping[header] = field;
        }
        break;
      }
    }
  }

  return mapping;
}

/** Limpa documento removendo pontos, traços e barras */
function cleanDocument(doc: string): string {
  return doc.replace(/[.\-/\s]/g, "");
}

/** Converte rows do CSV em dados de Partner prontos para a API */
export function mapRowsToPartners(
  rows: Record<string, string>[],
  columnMapping: Record<string, string>
): Record<string, unknown>[] {
  // Inverte o mapeamento: csvHeader → partnerField  →  partnerField → csvHeader
  const fieldToHeader: Record<string, string> = {};
  for (const [csvHeader, partnerField] of Object.entries(columnMapping)) {
    fieldToHeader[partnerField] = csvHeader;
  }

  return rows
    .filter((row) => {
      // Pula linhas sem nome
      const nameHeader = fieldToHeader["name"];
      return nameHeader && row[nameHeader]?.trim();
    })
    .map((row) => {
      const get = (field: string) => {
        const header = fieldToHeader[field];
        return header ? row[header]?.trim() || "" : "";
      };

      const rawDoc = cleanDocument(get("document"));
      const isPJ = rawDoc.length >= 14;
      const isPF = rawDoc.length > 0 && rawDoc.length <= 11;

      const partner: Record<string, unknown> = {
        partnerTypes: ["CLIENTE"],
        personType: isPJ ? "PJ" : "PF",
        name: get("name"),
        status: "ATIVO",
      };

      if (get("tradeName")) partner.tradeName = get("tradeName");
      if (rawDoc) {
        partner.document = rawDoc;
        partner.documentType = isPJ ? "CNPJ" : "CPF";
      }
      if (get("phone")) partner.phone = get("phone").replace(/[^\d]/g, "");
      if (get("email")) partner.email = get("email").toLowerCase();
      if (get("addressStreet")) partner.addressStreet = get("addressStreet");
      if (get("addressNumber")) partner.addressNumber = get("addressNumber");
      if (get("addressComp")) partner.addressComp = get("addressComp");
      if (get("neighborhood")) partner.neighborhood = get("neighborhood");
      if (get("city")) partner.city = get("city");
      if (get("state")) partner.state = get("state").toUpperCase().slice(0, 2);
      if (get("cep")) partner.cep = get("cep").replace(/[^\d]/g, "");
      if (get("ie")) partner.ie = get("ie");
      if (get("im")) partner.im = get("im");

      return partner;
    });
}
