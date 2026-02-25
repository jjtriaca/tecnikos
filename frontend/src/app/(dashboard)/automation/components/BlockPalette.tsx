"use client";

import {
  type AutoBlockCategory,
  type EntityType,
  CATEGORY_COLORS,
  ENTITY_OPTIONS,
  ENTITY_EVENTS,
  ENTITY_FIELDS,
  ACTION_TYPES,
  getActionsForEntity,
} from "@/types/automation-blocks";

/* ═══════════════════════════════════════════════════════════════
   BLOCK PALETTE — Sidebar with draggable block definitions
   ═══════════════════════════════════════════════════════════════ */

interface PaletteItem {
  category: AutoBlockCategory;
  label: string;
  icon: string;
  data?: Record<string, any>;
}

interface Props {
  entity: EntityType;
  onDragBlock: (item: PaletteItem) => void;
}

export default function BlockPalette({ entity, onDragBlock }: Props) {
  const entityOpt = ENTITY_OPTIONS.find((e) => e.id === entity);
  const events = ENTITY_EVENTS[entity] || [];
  const fields = ENTITY_FIELDS[entity] || [];
  const actions = getActionsForEntity(entity);

  const sections: { title: string; items: PaletteItem[] }[] = [
    {
      title: "Gatilho",
      items: [
        { category: "TRIGGER", label: "Quando...", icon: "⚡" },
      ],
    },
    {
      title: "Entidade",
      items: ENTITY_OPTIONS.map((ent) => ({
        category: "ENTITY" as AutoBlockCategory,
        label: ent.label,
        icon: ent.icon,
        data: { entityId: ent.id },
      })),
    },
    {
      title: "Evento",
      items: events.map((evt) => ({
        category: "EVENT" as AutoBlockCategory,
        label: evt.label,
        icon: evt.icon,
        data: { eventId: evt.id },
      })),
    },
    {
      title: "Condição",
      items: fields.map((f) => ({
        category: "CONDITION" as AutoBlockCategory,
        label: f.label,
        icon: "🔍",
        data: { field: f.id, operator: "eq", value: "" },
      })),
    },
    {
      title: "Ação",
      items: actions.map((a) => ({
        category: "ACTION" as AutoBlockCategory,
        label: a.label,
        icon: a.icon,
        data: { actionType: a.id, config: {} },
      })),
    },
  ];

  return (
    <div className="w-56 bg-white border-r border-slate-200 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-slate-200">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Blocos</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
              {section.title}
            </h4>
            <div className="space-y-1">
              {section.items.map((item, i) => {
                const colors = CATEGORY_COLORS[item.category];
                return (
                  <button
                    key={`${item.category}-${i}`}
                    onClick={() => onDragBlock(item)}
                    className={`
                      w-full text-left px-2.5 py-2 rounded-lg border transition-all
                      ${colors.bg} ${colors.border} ${colors.text}
                      hover:shadow-md hover:scale-[1.02] active:scale-95
                      flex items-center gap-2 text-xs font-medium
                    `}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { PaletteItem };
