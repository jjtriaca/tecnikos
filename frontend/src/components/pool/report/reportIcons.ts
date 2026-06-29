// Biblioteca de icones do EngineReporter (inline SVG, estilo contorno 24x24, stroke=currentColor).
// Inline (nao webfont) pra funcionar no PDF via printViaClone sem dependencia externa. A cor vem
// do textColor da caixa (currentColor); o tamanho = dimensoes da caixa. Extensivel: so acrescentar.
export type ReportIcon = { name: string; label: string; svg: string };

// `svg` = conteudo INTERNO de <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ...>.
export const REPORT_ICONS: ReportIcon[] = [
  // ── Medidas / piscina ──
  { name: "ruler-h", label: "Comprimento", svg: '<line x1="3" y1="12" x2="21" y2="12"/><polyline points="6 9 3 12 6 15"/><polyline points="18 9 21 12 18 15"/>' },
  { name: "ruler-v", label: "Largura", svg: '<line x1="12" y1="3" x2="12" y2="21"/><polyline points="9 6 12 3 15 6"/><polyline points="9 18 12 21 15 18"/>' },
  { name: "area", label: "Área", svg: '<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="10" y1="4" x2="10" y2="20"/>' },
  { name: "depth", label: "Profundidade", svg: '<line x1="12" y1="4" x2="12" y2="20"/><polyline points="6 14 12 20 18 14"/>' },
  { name: "droplet", label: "Volume / água", svg: '<path d="M12 3 L18 12 a6 6 0 1 1 -12 0 Z"/>' },
  { name: "pool", label: "Piscina", svg: '<path d="M3 17 q3 -2 6 0 t6 0 t6 0"/><path d="M3 13 q3 -2 6 0 t6 0 t6 0"/><line x1="7" y1="4" x2="7" y2="13"/><line x1="13" y1="4" x2="13" y2="13"/>' },
  { name: "ruler", label: "Medida", svg: '<rect x="3" y="8" width="18" height="8" rx="1"/><line x1="7" y1="8" x2="7" y2="12"/><line x1="11" y1="8" x2="11" y2="12"/><line x1="15" y1="8" x2="15" y2="12"/>' },
  // ── Sistemas ──
  { name: "sun", label: "Solar", svg: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="5" y1="5" x2="7" y2="7"/><line x1="17" y1="17" x2="19" y2="19"/><line x1="17" y1="7" x2="19" y2="5"/><line x1="5" y1="19" x2="7" y2="17"/>' },
  { name: "flame", label: "Aquecimento", svg: '<path d="M12 3 C12 8 8 9 8 14 a4 4 0 0 0 8 0 C16 11 13 11 12 3 Z"/>' },
  { name: "bolt", label: "Energia", svg: '<polygon points="13 3 5 13 11 13 10 21 19 10 13 10 13 3"/>' },
  { name: "tools", label: "Filtro / equip.", svg: '<circle cx="12" cy="12" r="3"/><path d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M5 5 l2 2 M17 17 l2 2 M17 7 l2 -2 M5 19 l2 -2"/>' },
  // ── Gerais ──
  { name: "home", label: "Casa", svg: '<path d="M3 11 L12 3 L21 11"/><path d="M5 10 V20 H19 V10"/>' },
  { name: "user", label: "Cliente", svg: '<circle cx="12" cy="8" r="4"/><path d="M4 20 a8 8 0 0 1 16 0"/>' },
  { name: "phone", label: "Telefone", svg: '<path d="M5 4 H9 L11 9 L8 11 a10 10 0 0 0 5 5 L15 13 L20 15 V19 a2 2 0 0 1 -2 2 A16 16 0 0 1 3 6 a2 2 0 0 1 2 -2 Z"/>' },
  { name: "mail", label: "E-mail", svg: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7 L12 13 L21 7"/>' },
  { name: "map-pin", label: "Local", svg: '<path d="M12 21 C12 21 5 14 5 9 a7 7 0 0 1 14 0 C19 14 12 21 12 21 Z"/><circle cx="12" cy="9" r="2.5"/>' },
  { name: "calendar", label: "Data", svg: '<rect x="4" y="5" width="16" height="16" rx="2"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="9" y1="3" x2="9" y2="7"/><line x1="15" y1="3" x2="15" y2="7"/>' },
  { name: "check", label: "OK", svg: '<polyline points="5 12 10 17 19 7"/>' },
  { name: "star", label: "Destaque", svg: '<polygon points="12 3 15 9 21 9.5 16.5 14 18 20 12 16.5 6 20 7.5 14 3 9.5 9 9"/>' },
  { name: "shield", label: "Garantia", svg: '<path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z"/><polyline points="9 12 11 14 15 10"/>' },
  { name: "cash", label: "Valor", svg: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>' },
  { name: "file", label: "Documento", svg: '<path d="M6 3 H14 L19 8 V21 H6 Z"/><polyline points="14 3 14 8 19 8"/>' },
];

export function getReportIcon(name?: string | null): ReportIcon | undefined {
  if (!name) return undefined;
  return REPORT_ICONS.find((i) => i.name === name);
}
