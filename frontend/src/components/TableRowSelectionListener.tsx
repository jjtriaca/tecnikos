"use client";

import { useEffect } from "react";

/**
 * Listener global de selecao de linhas em tabelas (v1.10.08).
 *
 * Estrategia: ouve cliques no document inteiro. Quando o click acontece dentro
 * de um `tbody > tr`, marca a linha com `data-row-selected="true"` e remove
 * o atributo de outras linhas da MESMA <table> (selecao unica por tabela).
 *
 * O destaque visual vem do CSS global em globals.css (selector
 * `tbody tr[data-row-selected="true"]`).
 *
 * Nao requer mudanca em nenhum <tr> — funciona pra todas as tabelas
 * existentes automaticamente.
 *
 * Excecoes:
 *  - Se o click foi em controle interativo (button, a, input, select), ignora
 *    pra nao roubar foco / sobrescrever interacao do componente.
 *  - Click fora de qualquer <tr> limpa selecao da pagina.
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

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
