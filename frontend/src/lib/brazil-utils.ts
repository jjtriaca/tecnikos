// ========== Title Case ==========

/** Preposicoes / artigos que ficam minusculos (exceto se primeira palavra) */
const LOWERCASE_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos",
  "com", "por", "para", "ao", "aos", "a", "as", "o", "os", "um", "uma",
]);

/**
 * Converte texto para Title Case (primeira letra de cada palavra maiuscula).
 * Preposicoes/artigos ficam minusculos, exceto se forem a primeira palavra.
 * Ex: "rua sao bernardo do campo" → "Rua Sao Bernardo do Campo"
 */
export function toTitleCase(text: string): string {
  if (!text) return text;
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return word;
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Handler para onBlur que aplica Title Case ao valor do input.
 * Uso: onBlur={titleCaseBlur(value, setter)}
 */
export function titleCaseBlur(
  value: string,
  setter: (v: string) => void,
) {
  return () => {
    if (value && value !== toTitleCase(value)) {
      setter(toTitleCase(value));
    }
  };
}

// States array
export const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

// Mask functions
export function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Mask currency input: "150000" → "1.500,00" */
export function maskCurrency(v: string): string {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return (num / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Parse masked currency to cents: "1.500,00" → 150000 */
export function parseCurrencyToCents(v: string): number {
  const digits = v.replace(/\D/g, "");
  return parseInt(digits, 10) || 0;
}

export function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskPhone(v: string): string {
  let d = v.replace(/\D/g, "");
  // Strip leading zeros (common in Sankhya imports: 066... → 66...)
  while (d.startsWith("0")) d = d.substring(1);
  // Remove country code 55 if present
  if (d.startsWith("55") && d.length >= 12) d = d.substring(2);
  d = d.slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

// ========== Inscrição Estadual Masks by State ==========

const IE_MASKS: Record<string, { maxDigits: number; mask: (d: string) => string }> = {
  AC: { maxDigits: 13, mask: (d) => d.replace(/(\d{2})(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3/$4-$5") },
  AL: { maxDigits: 9, mask: (d) => d.replace(/(\d{9})/, "$1") },
  AP: { maxDigits: 9, mask: (d) => d.replace(/(\d{9})/, "$1") },
  AM: { maxDigits: 9, mask: (d) => d.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, "$1.$2.$3-$4") },
  BA: { maxDigits: 9, mask: (d) => d.length <= 8
    ? d.replace(/(\d{6})(\d{0,2})/, "$1-$2")
    : d.replace(/(\d{7})(\d{0,2})/, "$1-$2") },
  CE: { maxDigits: 9, mask: (d) => d.replace(/(\d{8})(\d{0,1})/, "$1-$2") },
  DF: { maxDigits: 13, mask: (d) => d.replace(/(\d{3})(\d{7})(\d{3})/, "$1.$2.$3") },
  ES: { maxDigits: 9, mask: (d) => d.replace(/(\d{8})(\d{0,1})/, "$1-$2") },
  GO: { maxDigits: 9, mask: (d) => d.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, "$1.$2.$3-$4") },
  MA: { maxDigits: 9, mask: (d) => d.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, "$1.$2.$3-$4") },
  MT: { maxDigits: 11, mask: (d) => d.replace(/(\d{10})(\d{0,1})/, "$1-$2") },
  MS: { maxDigits: 9, mask: (d) => d.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, "$1.$2.$3-$4") },
  MG: { maxDigits: 13, mask: (d) => d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4") },
  PA: { maxDigits: 9, mask: (d) => d.replace(/(\d{2})(\d{6})(\d{0,1})/, "$1-$2-$3") },
  PB: { maxDigits: 9, mask: (d) => d.replace(/(\d{8})(\d{0,1})/, "$1-$2") },
  PR: { maxDigits: 10, mask: (d) => d.replace(/(\d{3})(\d{5})(\d{0,2})/, "$1.$2-$3") },
  PE: { maxDigits: 9, mask: (d) => d.replace(/(\d{7})(\d{0,2})/, "$1-$2") },
  PI: { maxDigits: 9, mask: (d) => d.replace(/(\d{8})(\d{0,1})/, "$1-$2") },
  RJ: { maxDigits: 8, mask: (d) => d.replace(/(\d{2})(\d{3})(\d{2})(\d{0,1})/, "$1.$2.$3-$4") },
  RN: { maxDigits: 10, mask: (d) => d.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, "$1.$2.$3-$4") },
  RS: { maxDigits: 10, mask: (d) => d.replace(/(\d{3})(\d{0,7})/, "$1/$2") },
  RO: { maxDigits: 14, mask: (d) => d.replace(/(\d{3})(\d{5})(\d{0,1})/, "$1.$2-$3") },
  RR: { maxDigits: 9, mask: (d) => d.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, "$1.$2.$3-$4") },
  SC: { maxDigits: 9, mask: (d) => d.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3") },
  SP: { maxDigits: 12, mask: (d) => d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3.$4") },
  SE: { maxDigits: 9, mask: (d) => d.replace(/(\d{8})(\d{0,1})/, "$1-$2") },
  TO: { maxDigits: 11, mask: (d) => d.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, "$1.$2.$3-$4") },
};

/** Mask Inscrição Estadual based on state (UF). If no state, just limit to 14 digits. */
export function maskIE(v: string, uf?: string): string {
  const d = v.replace(/\D/g, "");
  if (!uf || !IE_MASKS[uf]) return d.slice(0, 14);
  const { maxDigits, mask } = IE_MASKS[uf];
  return mask(d.slice(0, maxDigits));
}

// CNPJ Lookup - BrasilAPI primary, ReceitaWS fallback
export async function lookupCnpj(cnpj: string): Promise<{
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  situacao: string;
} | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;

  // Try BrasilAPI first
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (r.ok) {
      const d = await r.json();
      return {
        razaoSocial: d.razao_social || "",
        nomeFantasia: d.nome_fantasia || "",
        telefone: d.ddd_telefone_1 || "",
        email: d.email || "",
        cep: d.cep || "",
        logradouro: d.logradouro || "",
        numero: d.numero || "",
        complemento: d.complemento || "",
        bairro: d.bairro || "",
        municipio: d.municipio || "",
        uf: d.uf || "",
        situacao: d.situacao_cadastral || d.descricao_situacao_cadastral || "",
      };
    }
  } catch { /* fallback */ }

  // Fallback: ReceitaWS
  try {
    const r = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`);
    if (r.ok) {
      const d = await r.json();
      if (d.status === "ERROR") return null;
      return {
        razaoSocial: d.nome || "",
        nomeFantasia: d.fantasia || "",
        telefone: d.telefone || "",
        email: d.email || "",
        cep: d.cep || "",
        logradouro: d.logradouro || "",
        numero: d.numero || "",
        complemento: d.complemento || "",
        bairro: d.bairro || "",
        municipio: d.municipio || "",
        uf: d.uf || "",
        situacao: d.situacao || "",
      };
    }
  } catch { /* ignore */ }

  return null;
}

// CEP Lookup via ViaCEP
export async function lookupCep(cep: string): Promise<{
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  complemento: string;
} | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (r.ok) {
      const d = await r.json();
      if (d.erro) return null;
      return {
        logradouro: d.logradouro || "",
        bairro: d.bairro || "",
        localidade: d.localidade || "",
        uf: d.uf || "",
        complemento: d.complemento || "",
      };
    }
  } catch { /* ignore */ }

  return null;
}

// ========== v1.00.09 — Endereço Inteligente ==========

// Tipo para cidade IBGE
export type IBGECity = { id: number; nome: string };

// Cache de cidades por UF (evita re-fetch)
const citiesCache = new Map<string, IBGECity[]>();

// Buscar cidades de um estado via IBGE
export async function fetchCitiesByState(uf: string): Promise<IBGECity[]> {
  const upper = uf.toUpperCase();
  if (citiesCache.has(upper)) return citiesCache.get(upper)!;

  try {
    const r = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${upper}/municipios?orderBy=nome`,
    );
    if (r.ok) {
      const data: { id: number; nome: string }[] = await r.json();
      const cities = data.map((c) => ({ id: c.id, nome: c.nome }));
      citiesCache.set(upper, cities);
      return cities;
    }
  } catch { /* ignore */ }

  return [];
}

// Geocoding via Nominatim (OpenStreetMap) — gratuito, sem API key
// Usa parâmetros estruturados para precisão máxima
export async function geocodeAddress(
  fullAddress: string,
  structured?: {
    street?: string;
    number?: string;
    city?: string;
    state?: string;
  },
): Promise<{ lat: number; lng: number } | null> {
  if (!fullAddress.trim()) return null;

  const headers = {
    "User-Agent": "SistemaTerceirizacao/1.0",
    "Accept-Language": "pt-BR",
  };

  // Tentativa 1: busca estruturada (mais precisa)
  if (structured?.city && structured?.state) {
    try {
      const params = new URLSearchParams({
        format: "json",
        limit: "1",
        country: "Brazil",
        state: STATE_NAMES[structured.state] || structured.state,
        city: structured.city,
      });
      if (structured.street) {
        const streetQ = structured.number
          ? `${structured.street}, ${structured.number}`
          : structured.street;
        params.set("street", streetQ);
      }
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers },
      );
      if (r.ok) {
        const data = await r.json();
        if (data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
        }
      }
    } catch { /* fallback */ }
  }

  // Tentativa 2: busca por texto livre (fallback)
  try {
    const q = encodeURIComponent(`${fullAddress}, Brazil`);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers },
    );
    if (r.ok) {
      const data = await r.json();
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    }
  } catch { /* ignore */ }

  return null;
}

// Compor addressText a partir dos campos estruturados
export function composeAddressText(fields: {
  addressStreet?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}): string {
  const parts: string[] = [];

  // "Rua X, 123"
  if (fields.addressStreet) {
    let streetPart = fields.addressStreet;
    if (fields.addressNumber) streetPart += `, ${fields.addressNumber}`;
    parts.push(streetPart);
  }

  // "- Bairro"
  if (fields.neighborhood) {
    parts.push(`- ${fields.neighborhood}`);
  }

  // ", Cidade/UF"
  if (fields.city) {
    let cityPart = fields.city;
    if (fields.state) cityPart += `/${fields.state}`;
    parts.push(`, ${cityPart}`);
  }

  return parts.join(" ").replace(/^[\s,-]+/, "").trim();
}

// Nomes dos estados para display
export const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
