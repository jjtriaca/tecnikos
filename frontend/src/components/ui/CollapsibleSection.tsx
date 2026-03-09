"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface CollapsibleSectionProps {
  /** Title displayed in the header */
  title: string;
  /** Icon element (SVG/emoji) displayed before the title */
  icon?: ReactNode;
  /** Subtitle/hint shown to the right of the title */
  subtitle?: string;
  /** Summary text shown when collapsed (e.g. current value) */
  summary?: string;
  /** Whether the section starts expanded */
  defaultOpen?: boolean;
  /** Controlled open state (overrides internal state) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Whether to auto-collapse when scrolled out of view */
  autoCollapse?: boolean;
  /** Additional CSS classes on the wrapper */
  className?: string;
  /** Children content */
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  icon,
  subtitle,
  summary,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  autoCollapse = true,
  className = "",
  children,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const sectionRef = useRef<HTMLDivElement>(null);

  function toggle() {
    const next = !isOpen;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  // Auto-collapse when scrolled out of view
  useEffect(() => {
    if (!autoCollapse || !isOpen || !sectionRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Collapse when less than 5% visible
        if (!entry.isIntersecting) {
          if (controlledOpen === undefined) setInternalOpen(false);
          onOpenChange?.(false);
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [autoCollapse, isOpen, controlledOpen, onOpenChange]);

  return (
    <div ref={sectionRef} className={`border-t border-slate-200 pt-4 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          {subtitle && (
            <span className="text-xs text-slate-400 font-normal">{subtitle}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Summary when collapsed */}
          {!isOpen && summary && (
            <span className="text-xs text-slate-500 max-w-[200px] truncate">{summary}</span>
          )}
          {/* Chevron */}
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible content with smooth animation */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? "max-h-[2000px] opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
