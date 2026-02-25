"use client";

import { useCallback, useRef, useState } from "react";
import {
  type AutoBlockCategory,
  type EntityType,
  type ActionDef,
  type TriggerDef,
  type ConditionNode,
  CONNECTION_RULES,
  ENTITY_OPTIONS,
  ENTITY_EVENTS,
  ENTITY_FIELDS,
  ACTION_TYPES,
  getActionsForEntity,
} from "@/types/automation-blocks";

/* ═══════════════════════════════════════════════════════════════
   CANVAS STATE HOOK — Blocks, connections, selection, drag
   ═══════════════════════════════════════════════════════════════ */

export interface CanvasBlock {
  id: string;
  category: AutoBlockCategory;
  label: string;
  icon: string;
  x: number;
  y: number;
  /** Extra data depending on category */
  data?: Record<string, any>;
}

export interface CanvasConnection {
  id: string;
  fromBlockId: string;
  toBlockId: string;
}

export interface CanvasLayout {
  blocks: CanvasBlock[];
  connections: CanvasConnection[];
  pan: { x: number; y: number };
  zoom: number;
}

const SNAP = 20;
const BLOCK_W = 240;
const BLOCK_H = 80;

function snap(v: number) {
  return Math.round(v / SNAP) * SNAP;
}

let blockCounter = 0;
function nextId(prefix: string) {
  return `${prefix}_${++blockCounter}_${Date.now().toString(36)}`;
}

export function useCanvasState(initialLayout?: CanvasLayout | null) {
  const [blocks, setBlocks] = useState<CanvasBlock[]>(initialLayout?.blocks ?? []);
  const [connections, setConnections] = useState<CanvasConnection[]>(initialLayout?.connections ?? []);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [pan, setPan] = useState(initialLayout?.pan ?? { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialLayout?.zoom ?? 1);

  /* ── Block CRUD ──────────────────────────────────── */

  const addBlock = useCallback((category: AutoBlockCategory, label: string, icon: string, x: number, y: number, data?: Record<string, any>) => {
    const id = nextId(category.toLowerCase());
    const block: CanvasBlock = { id, category, label, icon, x: snap(x), y: snap(y), data };
    setBlocks((prev) => [...prev, block]);
    setSelectedBlockId(id);
    return id;
  }, []);

  const moveBlock = useCallback((id: string, x: number, y: number) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, x: snap(x), y: snap(y) } : b)));
  }, []);

  const updateBlockData = useCallback((id: string, data: Record<string, any>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setConnections((prev) => prev.filter((c) => c.fromBlockId !== id && c.toBlockId !== id));
    setSelectedBlockId((s) => (s === id ? null : s));
  }, []);

  /* ── Connection CRUD ─────────────────────────────── */

  const canConnect = useCallback((fromId: string, toId: string) => {
    const fromBlock = blocks.find((b) => b.id === fromId);
    const toBlock = blocks.find((b) => b.id === toId);
    if (!fromBlock || !toBlock) return false;
    if (fromId === toId) return false;

    const fromPort = CONNECTION_RULES[fromBlock.category].outputPort;
    const toAccepts = CONNECTION_RULES[toBlock.category].acceptsFrom;
    if (!toAccepts.includes(fromPort)) return false;

    // No duplicate connections
    if (connections.some((c) => c.fromBlockId === fromId && c.toBlockId === toId)) return false;

    return true;
  }, [blocks, connections]);

  const addConnection = useCallback((fromId: string, toId: string) => {
    if (!canConnect(fromId, toId)) return null;
    const id = nextId("conn");
    setConnections((prev) => [...prev, { id, fromBlockId: fromId, toBlockId: toId }]);
    return id;
  }, [canConnect]);

  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  /* ── Viewport ────────────────────────────────────── */

  const handleZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(2, Math.max(0.3, z + delta)));
  }, []);

  /* ── Serialize ───────────────────────────────────── */

  const getLayout = useCallback((): CanvasLayout => ({
    blocks,
    connections,
    pan,
    zoom,
  }), [blocks, connections, pan, zoom]);

  /**
   * Convert canvas blocks/connections into trigger + actions JSON
   * that the backend/engine expects.
   */
  const serialize = useCallback((): { trigger: TriggerDef; actions: ActionDef[] } | null => {
    // Find trigger chain: TRIGGER → ENTITY → EVENT → CONDITIONs → ACTIONs
    const triggerBlock = blocks.find((b) => b.category === "TRIGGER");
    if (!triggerBlock) return null;

    // Walk connections from trigger
    const getConnected = (fromId: string): CanvasBlock[] =>
      connections
        .filter((c) => c.fromBlockId === fromId)
        .map((c) => blocks.find((b) => b.id === c.toBlockId))
        .filter(Boolean) as CanvasBlock[];

    // Entity
    const entityBlocks = getConnected(triggerBlock.id).filter((b) => b.category === "ENTITY");
    const entityBlock = entityBlocks[0];
    if (!entityBlock) return null;

    // Event
    const eventBlocks = getConnected(entityBlock.id).filter((b) => b.category === "EVENT");
    const eventBlock = eventBlocks[0];
    if (!eventBlock) return null;

    const entity = (entityBlock.data?.entityId || "SERVICE_ORDER") as EntityType;
    const event = eventBlock.data?.eventId || "";

    // Walk from event through conditions/actions
    const conditions: ConditionNode[] = [];
    const actions: ActionDef[] = [];

    function walkFrom(blockId: string) {
      const nextBlocks = getConnected(blockId);
      for (const nb of nextBlocks) {
        if (nb.category === "CONDITION") {
          conditions.push({
            field: nb.data?.field || "",
            operator: nb.data?.operator || "eq",
            value: nb.data?.value || "",
          });
          walkFrom(nb.id);
        } else if (nb.category === "ACTION") {
          actions.push({
            type: nb.data?.actionType || "",
            config: nb.data?.config || {},
          });
          walkFrom(nb.id);
        }
      }
    }

    walkFrom(eventBlock.id);

    return {
      trigger: {
        entity,
        event,
        conditions: conditions.length > 0 ? conditions : undefined,
      },
      actions,
    };
  }, [blocks, connections]);

  /**
   * Deserialize trigger + actions back into canvas blocks.
   * Creates a simple left-to-right layout.
   */
  const deserialize = useCallback((trigger: TriggerDef, ruleActions: ActionDef[], existingLayout?: CanvasLayout | null) => {
    if (existingLayout && existingLayout.blocks.length > 0) {
      setBlocks(existingLayout.blocks);
      setConnections(existingLayout.connections);
      setPan(existingLayout.pan);
      setZoom(existingLayout.zoom);
      return;
    }

    // Auto-generate layout
    const newBlocks: CanvasBlock[] = [];
    const newConns: CanvasConnection[] = [];
    let x = 40;
    const yBase = 160;

    // Trigger block
    const triggerId = nextId("trigger");
    newBlocks.push({ id: triggerId, category: "TRIGGER", label: "Quando...", icon: "⚡", x, y: yBase });
    x += BLOCK_W + 60;

    // Entity block
    const entityOpt = ENTITY_OPTIONS.find((e) => e.id === trigger.entity);
    const entityId = nextId("entity");
    newBlocks.push({
      id: entityId, category: "ENTITY",
      label: entityOpt?.label || trigger.entity, icon: entityOpt?.icon || "📋",
      x, y: yBase, data: { entityId: trigger.entity },
    });
    newConns.push({ id: nextId("conn"), fromBlockId: triggerId, toBlockId: entityId });
    x += BLOCK_W + 60;

    // Event block
    const evtOpt = ENTITY_EVENTS[trigger.entity]?.find((e) => e.id === trigger.event);
    const eventId = nextId("event");
    newBlocks.push({
      id: eventId, category: "EVENT",
      label: evtOpt?.label || trigger.event, icon: evtOpt?.icon || "🔔",
      x, y: yBase, data: { eventId: trigger.event },
    });
    newConns.push({ id: nextId("conn"), fromBlockId: entityId, toBlockId: eventId });
    x += BLOCK_W + 60;

    let prevId = eventId;

    // Conditions
    for (const cond of trigger.conditions || []) {
      const fieldDef = ENTITY_FIELDS[trigger.entity]?.find((f) => f.id === cond.field);
      const condId = nextId("condition");
      newBlocks.push({
        id: condId, category: "CONDITION",
        label: fieldDef?.label || cond.field, icon: "🔍",
        x, y: yBase, data: { field: cond.field, operator: cond.operator, value: cond.value },
      });
      newConns.push({ id: nextId("conn"), fromBlockId: prevId, toBlockId: condId });
      prevId = condId;
      x += BLOCK_W + 60;
    }

    // Actions
    let yAction = yBase;
    for (const act of ruleActions) {
      const actDef = ACTION_TYPES.find((a) => a.id === act.type);
      const actId = nextId("action");
      newBlocks.push({
        id: actId, category: "ACTION",
        label: actDef?.label || act.type, icon: actDef?.icon || "🎯",
        x, y: yAction, data: { actionType: act.type, config: act.config || {} },
      });
      newConns.push({ id: nextId("conn"), fromBlockId: prevId, toBlockId: actId });
      yAction += BLOCK_H + 30;
    }

    setBlocks(newBlocks);
    setConnections(newConns);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  return {
    blocks,
    connections,
    selectedBlockId,
    pan,
    zoom,
    setSelectedBlockId,
    setPan,
    addBlock,
    moveBlock,
    updateBlockData,
    removeBlock,
    canConnect,
    addConnection,
    removeConnection,
    handleZoom,
    getLayout,
    serialize,
    deserialize,
  };
}
