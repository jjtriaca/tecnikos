/**
 * printViaClone — impressao A4 de uma area HTML, via CLONE no document.body.
 *
 * Extraido/generalizado do HeatingSimulatorModal (datasheets solar/bomba), que
 * provou esse padrao ao longo de 18 bugs (ver memory/sistema_impressao_pdf_simulador.md).
 * O motivo de clonar: a area original costuma estar dentro de um container
 * `fixed inset-0 overflow-hidden` (modal) que confunde o motor de print do Chrome
 * e gera paginas duplicadas / branco no topo. Clonar pra fora, direto no body, e
 * imprimir SO o clone resolve.
 *
 * O CSS de @media print fica POR RELATORIO (cada area tem o seu, keyed pelo cloneId).
 * O unico contrato generico: `html.printing-mode body > *:not(.pdf-clone-container) { display:none }`
 * (display:none, NUNCA visibility:hidden — senao o original fica no layout flow e gera 2a pagina).
 */
export type PrintViaCloneOpts = {
  /** id da area a imprimir (ex: "budget-pdf-area"). */
  areaId: string;
  /** id que o clone recebe (ex: "budget-pdf-clone"). O CSS @media print mira esse id. */
  cloneId: string;
  /** classe extra no container do clone (default "printing-clone"). */
  containerClass?: string;
};

/**
 * Clona a area, prefixa ids internos (evita conflito de gradient SVG entre
 * original e clone), reescreve url(#x) de fill/stroke, e devolve o container
 * (ja inserido no body). NAO imprime — use printViaClone pra imprimir.
 */
export function createPdfClone(opts: PrintViaCloneOpts): HTMLElement | null {
  const { areaId, cloneId, containerClass = "printing-clone" } = opts;
  const original = document.getElementById(areaId);
  if (!original) return null;

  const container = document.createElement("div");
  container.className = `pdf-clone-container ${containerClass}`;

  const clone = original.cloneNode(true) as HTMLElement;
  clone.id = cloneId;

  // Prefixa ids descendentes -> evita que o clone resolva url(#grad) pro gradient
  // do ORIGINAL (browser pega o 1o id que acha no DOM). Incidente #5 da biblia.
  const prefix = "clone-";
  clone.querySelectorAll("[id]").forEach((el) => {
    const oldId = el.getAttribute("id");
    if (oldId) el.setAttribute("id", `${prefix}${oldId}`);
  });
  clone.querySelectorAll("[fill], [stroke]").forEach((el) => {
    (["fill", "stroke"] as const).forEach((attr) => {
      const v = el.getAttribute(attr);
      if (v && v.startsWith("url(#")) {
        const ref = v.slice(5, -1);
        el.setAttribute(attr, `url(#${prefix}${ref})`);
      }
    });
  });

  container.appendChild(clone);
  document.body.appendChild(container);

  // Zera min-height da tela (cloneNode preserva classes Tailwind tipo min-h-[1120px]).
  clone.style.minHeight = "0";
  clone.style.height = "auto";
  return container;
}

/**
 * Imprime a area via clone no body. Idempotente (limpa clones residuais antes).
 * Adiciona `html.printing-mode`, chama window.print(), e limpa no afterprint
 * (com fallback em 1s pra browsers que nao disparam o evento).
 */
export function printViaClone(opts: PrintViaCloneOpts): void {
  // Cleanup defensivo: zero clones residuais antes de criar o novo.
  document.querySelectorAll(".pdf-clone-container").forEach((el) => el.remove());

  const container = createPdfClone(opts);
  if (!container) return;

  document.documentElement.classList.add("printing-mode");

  const cleanupAfterPrint = () => {
    document.documentElement.classList.remove("printing-mode");
    document.querySelectorAll(".pdf-clone-container").forEach((el) => el.remove());
    window.removeEventListener("afterprint", cleanupAfterPrint);
  };
  window.addEventListener("afterprint", cleanupAfterPrint);

  // Delay pro browser pintar o clone + computar layout antes de imprimir.
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      if (document.documentElement.classList.contains("printing-mode")) {
        cleanupAfterPrint();
      }
    }, 1000);
  }, 50);
}
