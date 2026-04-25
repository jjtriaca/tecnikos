"use client";

import { useEffect } from "react";

/**
 * Listeners globais de UX (v1.10.08+):
 *  1. Selecao de linha em tabelas (click → data-row-selected="true")
 *  2. Auto-select em inputs numericos ao receber foco (v1.10.10) —
 *     padrao do sistema: clicar em campo de valor seleciona o conteudo
 *     pra digitar substituir.
 *
 * Trigger do auto-select: input com `type="number"`, `inputMode="decimal"` ou
 * `inputMode="numeric"`, OU atributo opt-in `data-auto-select="true"`.
 * Opt-out: `data-no-auto-select="true"`.
 */
export default function TableRowSelectionListener() {
  useEffect(() => {
    function handleClick(ev: MouseEvent) {
      const target = ev.target as HTMLElement | null;
      if (!target) return;

      // Ignora cliques em controles interativos — eles tem proprio onClick
      // e nao devem alterar selecao (ex: botao "...", checkbox, link).
      const interactive = target.closest(
        "button, a, input, textarea, select, [role='button'], [data-no-row-select]",
      );
      const row = target.closest("tbody > tr") as HTMLTableRowElement | null;

      if (!row) {
        // Click fora de tabela: limpa selecao geral
        if (!interactive) {
          document
            .querySelectorAll('tbody tr[data-row-selected="true"]')
            .forEach((r) => r.removeAttribute("data-row-selected"));
        }
        return;
      }

      // Se o click foi em um controle interno do tr, nao seleciona —
      // mas tambem nao limpa a selecao atual (deixa user trabalhar com botoes).
      if (interactive && row.contains(interactive)) return;

      // Pula linhas que explicitamente nao querem selecao
      if (row.hasAttribute("data-no-row-select")) return;

      const tbody = row.parentElement;
      if (!tbody) return;

      // Limpa selecao das outras linhas da MESMA tabela
      tbody.querySelectorAll('tr[data-row-selected="true"]').forEach((r) => {
        if (r !== row) r.removeAttribute("data-row-selected");
      });

      // Toggle: clicar de novo na ja selecionada deseleciona
      if (row.getAttribute("data-row-selected") === "true") {
        row.removeAttribute("data-row-selected");
      } else {
        row.setAttribute("data-row-selected", "true");
      }
    }

    function handleFocusIn(ev: FocusEvent) {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") return;
      const el = target as HTMLInputElement | HTMLTextAreaElement;
      // Opt-out explicito
      if (el.hasAttribute("data-no-auto-select")) return;
      // Determina se eh input numerico (que merece auto-select)
      const type = (el.getAttribute("type") || "").toLowerCase();
      const inputMode = (el.getAttribute("inputmode") || "").toLowerCase();
      const isNumeric =
        type === "number" ||
        inputMode === "decimal" ||
        inputMode === "numeric" ||
        el.hasAttribute("data-auto-select");
      if (!isNumeric) return;
      // setTimeout 0 evita race condition com cliques que poderiam reposicionar caret
      setTimeout(() => {
        try { el.select(); } catch { /* ignore */ }
      }, 0);
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, []);

  return null;
}
