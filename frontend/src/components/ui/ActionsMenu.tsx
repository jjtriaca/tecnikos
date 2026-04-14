"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type ActionsMenuItemVariant = "default" | "primary" | "success" | "warning" | "danger" | "info" | "purple" | "rose";

export interface ActionsMenuItem {
  /** Texto exibido no menu */
  label: string;
  /** Callback ao clicar (menu fecha automaticamente antes) */
  onClick: () => void;
  /** Cor semantica do item */
  variant?: ActionsMenuItemVariant;
  /** Conteudo extra (ex: badge) renderizado depois do label */
  suffix?: ReactNode;
  /** Icone opcional (emoji ou SVG) antes do label */
  icon?: ReactNode;
  /** Desabilita o item (mantem visivel mas nao clicavel) */
  disabled?: boolean;
  /** Insere um divisor ACIMA deste item */
  divider?: boolean;
  /** Tooltip ao passar o mouse */
  title?: string;
}

export interface ActionsMenuProps {
  /**
   * Lista de itens. Use `false`/`null` em posicoes condicionais pra pular.
   * Ex: [importar, canEdit && editar, canDelete && excluir].
   */
  items: Array<ActionsMenuItem | false | null | undefined>;
  /** Label acessivel do botao (default: "Acoes") */
  ariaLabel?: string;
  /** Largura minima do dropdown em px (default: 180) */
  minWidth?: number;
  /** Classe extra pro botao de abertura */
  triggerClassName?: string;
}

const VARIANT_CLASSES: Record<ActionsMenuItemVariant, string> = {
  default: "text-slate-700 hover:bg-slate-50",
  primary: "text-blue-700 hover:bg-blue-50 font-medium",
  success: "text-green-700 hover:bg-green-50 font-medium",
  warning: "text-amber-700 hover:bg-amber-50 font-medium",
  danger: "text-red-600 hover:bg-red-50 font-medium",
  info: "text-slate-500 hover:bg-slate-50",
  purple: "text-purple-700 hover:bg-purple-50 font-medium",
  rose: "text-rose-700 hover:bg-rose-50 font-medium",
};

/**
 * Menu de acoes padrao do sistema (botao `⋯` com dropdown).
 *
 * Usar em toda tabela com 3+ acoes por linha em vez de botoes inline.
 * Aceita itens condicionais — passe `false` ou `null` em posicoes desabilitadas
 * que eles sao filtrados antes de renderizar.
 *
 * @example
 * <ActionsMenu
 *   items={[
 *     { label: "Editar", onClick: () => edit(row.id), variant: "primary" },
 *     canRevert && { label: "Reverter", onClick: () => revert(row.id), variant: "warning" },
 *     { label: "Excluir", onClick: () => remove(row.id), variant: "danger", divider: true },
 *   ]}
 * />
 */
export default function ActionsMenu({
  items,
  ariaLabel = "Acoes",
  minWidth = 180,
  triggerClassName = "",
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Filtra itens condicionais (false/null) — permite `cond && item` inline
  const validItems = items.filter((i): i is ActionsMenuItem => !!i && typeof i === "object");

  // Posiciona dropdown — tenta abrir abaixo; se faltar espaco, abre acima
  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const itemCount = validItems.length;
      const dividerCount = validItems.filter((i) => i.divider).length;
      // Cada item ~36px, divider ~9px, wrapper py-1 = 8px
      const estHeight = 8 + itemCount * 36 + dividerCount * 9;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estHeight + 12;
      setPos({
        top: openUp ? rect.top - estHeight - 4 : rect.bottom + 4,
        left: Math.max(8, rect.right - minWidth),
      });
    }
  }, [open, validItems.length, minWidth]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Fecha ao rolar a pagina (o dropdown e position:fixed e descola da linha)
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  if (validItems.length === 0) return null;

  return (
    <div ref={wrapperRef} className="inline-block">
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100 ${triggerClassName}`}
      >
        &#x22EF;
      </button>
      {open && pos && (
        <div
          role="menu"
          className="fixed z-50 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left"
          style={{ top: pos.top, left: pos.left, minWidth }}
        >
          {validItems.map((item, idx) => (
            <div key={idx}>
              {item.divider && <div className="my-1 border-t border-slate-100" />}
              <button
                type="button"
                disabled={item.disabled}
                title={item.title}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick();
                }}
                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                  item.disabled ? "opacity-50 cursor-not-allowed text-slate-400" : VARIANT_CLASSES[item.variant || "default"]
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {item.icon && <span className="inline-flex items-center">{item.icon}</span>}
                  <span>{item.label}</span>
                  {item.suffix}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
