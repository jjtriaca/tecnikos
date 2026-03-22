"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
  name?: string;
}

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function pad(n: number) { return n.toString().padStart(2, "0"); }
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfWeek(y: number, m: number) { return new Date(y, m, 1).getDay(); }

export default function DateTimePicker({ value, onChange, required, className = "", placeholder = "dd/mm/aaaa hh:mm", name }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = value ? new Date(value) : null;
  const isValid = parsed && !isNaN(parsed.getTime());

  const today = new Date();
  const [viewYear, setViewYear] = useState(isValid ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(isValid ? parsed.getMonth() : today.getMonth());

  const selectedDay = isValid ? parsed.getDate() : null;
  const selectedMonth = isValid ? parsed.getMonth() : null;
  const selectedYear = isValid ? parsed.getFullYear() : null;
  const selectedHour = isValid ? parsed.getHours() : 17;
  const selectedMinute = isValid ? parsed.getMinutes() : 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const buildValue = useCallback(
    (year: number, month: number, day: number, hour: number, minute: number) =>
      `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`,
    [],
  );

  const handleDayClick = (day: number) => {
    onChange(buildValue(viewYear, viewMonth, day, selectedHour, selectedMinute));
  };

  const handleHourClick = (h: number) => {
    if (!isValid) {
      onChange(buildValue(today.getFullYear(), today.getMonth(), today.getDate(), h, selectedMinute));
    } else {
      onChange(buildValue(selectedYear!, selectedMonth!, selectedDay!, h, selectedMinute));
    }
  };

  const handleMinuteClick = (m: number) => {
    if (!isValid) {
      onChange(buildValue(today.getFullYear(), today.getMonth(), today.getDate(), selectedHour, m));
    } else {
      onChange(buildValue(selectedYear!, selectedMonth!, selectedDay!, selectedHour, m));
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (day: number) =>
    day === selectedDay && viewMonth === selectedMonth && viewYear === selectedYear;

  const displayValue = isValid
    ? `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
    : "";

  // Compact hours: 6-21 (commercial range)
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  const minutes = [0, 10, 15, 20, 30, 40, 45, 50];

  return (
    <div ref={containerRef} className="relative">
      {name && <input type="hidden" name={name} value={value} required={required} />}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
          open ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-300 hover:border-slate-400"
        } bg-white text-slate-900 ${!displayValue ? "text-slate-400" : ""} ${className}`}
      >
        <div className="flex items-center justify-between">
          <span>{displayValue || placeholder}</span>
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-[290px]">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-1.5">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-slate-100 text-slate-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs font-semibold text-slate-700">
              {MONTHS_SHORT[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-slate-100 text-slate-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-0.5">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-[9px] font-medium text-slate-400 py-0.5">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px mb-2">
            {calendarDays.map((day, i) => (
              <button key={i} type="button" disabled={!day}
                onClick={() => day && handleDayClick(day)}
                className={`h-7 w-full rounded text-[11px] font-medium transition-colors ${
                  !day ? "invisible"
                    : isSelected(day) ? "bg-blue-500 text-white"
                    : isToday(day) ? "bg-blue-50 text-blue-600 font-bold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}>
                {day}
              </button>
            ))}
          </div>

          {/* Time selection — compact */}
          <div className="border-t border-slate-100 pt-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate-400 w-8">Hora</span>
              <div className="flex-1 flex flex-wrap gap-0.5">
                {hours.map((h) => (
                  <button key={h} type="button" onClick={() => handleHourClick(h)}
                    className={`w-[30px] h-6 rounded text-[10px] font-medium transition-colors ${
                      h === selectedHour && isValid
                        ? "bg-blue-500 text-white"
                        : "bg-slate-50 text-slate-600 hover:bg-blue-50"
                    }`}>
                    {pad(h)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate-400 w-8">Min</span>
              <div className="flex-1 flex flex-wrap gap-0.5">
                {minutes.map((m) => (
                  <button key={m} type="button" onClick={() => handleMinuteClick(m)}
                    className={`w-[30px] h-6 rounded text-[10px] font-medium transition-colors ${
                      m === selectedMinute && isValid
                        ? "bg-blue-500 text-white"
                        : "bg-slate-50 text-slate-600 hover:bg-blue-50"
                    }`}>
                    {pad(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
            <button type="button" onClick={() => onChange("")} className="text-[10px] text-slate-400 hover:text-slate-600">
              Limpar
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-3 py-1 rounded-md bg-blue-500 text-white text-[11px] font-medium hover:bg-blue-600">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
