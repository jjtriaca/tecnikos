"use client";

import { useState, useRef, useEffect } from "react";

interface PeriodSelectorProps {
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
}

const PRESETS = [
  { label: "Este mês", key: "this-month" },
  { label: "Mês passado", key: "last-month" },
  { label: "Últimos 3 meses", key: "last-3" },
  { label: "Este ano", key: "this-year" },
  { label: "Personalizado", key: "custom" },
] as const;

function getMonthRange(date: Date): [string, string] {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return [fmt(first), fmt(last)];
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function PeriodSelector({ dateFrom, dateTo, onChange }: PeriodSelectorProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);
  const menuRef = useRef<HTMLDivElement>(null);

  // Parse the current displayed month from dateFrom
  const current = new Date(dateFrom + "T12:00:00");
  const monthLabel = `${MONTH_NAMES[current.getMonth()]} ${current.getFullYear()}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navigate(delta: number) {
    const d = new Date(dateFrom + "T12:00:00");
    d.setMonth(d.getMonth() + delta);
    const [from, to] = getMonthRange(d);
    onChange(from, to);
  }

  function applyPreset(key: string) {
    const now = new Date();
    switch (key) {
      case "this-month": {
        const [from, to] = getMonthRange(now);
        onChange(from, to);
        break;
      }
      case "last-month": {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const [from, to] = getMonthRange(d);
        onChange(from, to);
        break;
      }
      case "last-3": {
        const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        onChange(fmt(d), fmt(last));
        break;
      }
      case "this-year": {
        const first = new Date(now.getFullYear(), 0, 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        onChange(fmt(first), fmt(last));
        break;
      }
      case "custom": {
        setShowCustom(true);
        return; // Don't close menu
      }
    }
    setShowMenu(false);
    setShowCustom(false);
  }

  function applyCustom() {
    if (customFrom && customTo) {
      onChange(customFrom, customTo);
      setShowMenu(false);
      setShowCustom(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors min-w-[160px] justify-center"
        >
          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {monthLabel}
          <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          onClick={() => navigate(1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {showMenu && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
          {!showCustom ? (
            PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className="flex w-full items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {p.label}
              </button>
            ))
          ) : (
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">De</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Até</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={applyCustom}
                className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
