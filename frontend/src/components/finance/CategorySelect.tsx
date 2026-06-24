"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * SELETOR CENTRAL DE CATEGORIA (Plano de Contas) — v1.13.98.
 *
 * Um unico componente usado em TODAS as telas de receber/pagar/editar/importar. Filtra a categoria
 * pela DIRECAO do lancamento (recebimento => so RECEITA; pagamento => so CUSTO/DESPESA), escondendo
 * as opcoes erradas, e renderiza sempre com a MESMA aparencia. Mudou aqui, muda em todas as telas.
 *
 * O backend (assertAccountDirection) reforca a mesma regra — esta UI so deixa mais limpo/seguro.
 */

interface AccountOpt {
  id: string;
  code: string | null;
  name: string;
  type?: string;
  parent?: { id: string; code: string | null; name: string } | null;
}

// Cache por direcao (modulo) — varias instancias do seletor nao refazem a busca.
const cache: Record<string, AccountOpt[]> = {};
const inflight: Record<string, Promise<AccountOpt[]>> = {};

function fetchAccounts(direction: "RECEIVABLE" | "PAYABLE"): Promise<AccountOpt[]> {
  if (cache[direction]) return Promise.resolve(cache[direction]);
  if (!inflight[direction]) {
    inflight[direction] = api
      .get<AccountOpt[]>(`/finance/accounts/postable?direction=${direction}`)
      .then((r) => {
        cache[direction] = r || [];
        return cache[direction];
      })
      .catch(() => [])
      .finally(() => {
        delete inflight[direction];
      });
  }
  return inflight[direction];
}

/** Limpa o cache (chamar apos criar/editar/excluir uma categoria). */
export function invalidateCategoryCache() {
  delete cache.RECEIVABLE;
  delete cache.PAYABLE;
}

export default function CategorySelect({
  direction,
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = "Sem categoria",
  disabled,
  className,
  id,
}: {
  direction: "RECEIVABLE" | "PAYABLE";
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [accounts, setAccounts] = useState<AccountOpt[]>(cache[direction] || []);

  useEffect(() => {
    let alive = true;
    fetchAccounts(direction).then((a) => {
      if (alive) setAccounts(a);
    });
    return () => {
      alive = false;
    };
  }, [direction]);

  // Agrupa por grupo pai (aparencia padrao system-wide).
  const grouped = new Map<string, AccountOpt[]>();
  for (const acc of accounts) {
    const g = acc.parent
      ? `${acc.parent.code ? acc.parent.code + " - " : ""}${acc.parent.name}`
      : "Sem grupo";
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(acc);
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={
        className ??
        "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
      }
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {[...grouped.entries()].map(([group, accs]) => (
        <optgroup key={group} label={group}>
          {accs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code ? `${a.code} - ` : ""}
              {a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
