// Validacao de tokens do layout (EngineReporter, Fase 5 — alertas). Varre todo o HTML do layout
// (FIXED, caixas TEXT do canvas, nos TEXT da composicao, cabecalho/rodape) e aponta tokens que
// NAO vao resolver: campo de outra origem, linha inexistente no modelo, campo desconhecido.
import { REPORT_FIELD_CATALOG } from "./reportFieldCatalog";

const GLOBAL_TOKENS = new Set(["{date}", "{pageNumber}", "{pageCount}"]);

export type TokenIssue = { token: string; page: string; severity: "error" | "warn"; message: string };

function collectHtml(layout: any): { page: string; html: string }[] {
  const out: { page: string; html: string }[] = [];
  const brand = layout?.branding || {};
  if (brand.headerHtml) out.push({ page: "Cabecalho", html: String(brand.headerHtml) });
  if (brand.footerHtml) out.push({ page: "Rodape", html: String(brand.footerHtml) });
  for (const p of (layout?.pages || [])) {
    const pc = p?.pageConfig || {};
    const nm = pc.name || `Pagina ${(p?.order ?? 0) + 1}`;
    if (p?.htmlContent) out.push({ page: nm, html: String(p.htmlContent) });
    for (const b of (pc.boxes || [])) if (b?.html) out.push({ page: nm, html: String(b.html) });
    const walk = (nodes: any[]) => {
      for (const n of nodes || []) {
        if (n?.config?.html) out.push({ page: nm, html: String(n.config.html) });
        if (n?.children) walk(n.children);
      }
    };
    walk(pc.nodes || []);
  }
  return out;
}

export function validateLayoutTokens(
  layout: any,
  sourceId: string,
  modeloCellRefs: Set<string>,
): TokenIssue[] {
  const thisSource = REPORT_FIELD_CATALOG.find((s) => s.id === sourceId);
  const okTokens = new Set<string>(GLOBAL_TOKENS);
  for (const g of thisSource?.groups || []) for (const f of g.fields) if (f.token) okTokens.add(f.token);
  const allTokens = new Set<string>();
  for (const s of REPORT_FIELD_CATALOG) for (const g of s.groups) for (const f of g.fields) if (f.token) allTokens.add(f.token);

  const issues: TokenIssue[] = [];
  const seen = new Set<string>();
  for (const { page, html } of collectHtml(layout)) {
    const matches = html.match(/\{[a-zA-Z][\w.:-]*\}/g) || [];
    for (const tk of matches) {
      const key = page + tk;
      if (seen.has(key)) continue;
      seen.add(key);
      const inner = tk.slice(1, -1);
      const lm = inner.match(/^linha:([A-Za-z]?\d+)\.[a-zA-Z]+$/);
      if (lm) {
        const ref = lm[1].toUpperCase();
        if (modeloCellRefs.size > 0 && !modeloCellRefs.has(ref))
          issues.push({ token: tk, page, severity: "error", message: `linha ${ref} nao existe no modelo de obra` });
        continue;
      }
      if (/^etapa:/.test(inner)) continue; // etapas variam por orcamento — nao validamos
      if (inner.includes(".")) continue; // path ({budget.pool.area}) — resolve no contexto
      if (okTokens.has(tk)) continue;
      if (allTokens.has(tk)) {
        issues.push({ token: tk, page, severity: "warn", message: "campo de outra origem — nao resolve neste layout" });
        continue;
      }
      issues.push({ token: tk, page, severity: "warn", message: "campo desconhecido — verifique o codigo" });
    }
  }
  return issues;
}
