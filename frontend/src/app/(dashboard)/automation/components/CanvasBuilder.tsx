"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { type EntityType } from "@/types/automation-blocks";
import CanvasBlockComp from "./CanvasBlock";
import ConnectionLine, { TempConnectionLine } from "./ConnectionLine";
import BlockPalette, { type PaletteItem } from "./BlockPalette";
import { useCanvasState, type CanvasLayout, type CanvasBlock } from "./useCanvasState";
import { BLOCK_W, BLOCK_H, getOutputPort, screenToCanvas, snapToGrid } from "./canvasUtils";
import type { TriggerDef, ActionDef } from "@/types/automation-blocks";

/* ═══════════════════════════════════════════════════════════════
   CANVAS BUILDER — Main container with pan/zoom, grid, blocks
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  entity: EntityType;
  onEntityChange: (entity: EntityType) => void;
  trigger: TriggerDef;
  actions: ActionDef[];
  layout?: CanvasLayout | null;
  onSave: (trigger: TriggerDef, actions: ActionDef[], layout: CanvasLayout) => void;
  onCancel: () => void;
  ruleName: string;
  saving: boolean;
}

export default function CanvasBuilder({
  entity,
  onEntityChange,
  trigger,
  actions: initialActions,
  layout: initialLayout,
  onSave,
  onCancel,
  ruleName,
  saving,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
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
  } = useCanvasState(initialLayout);

  // Dragging state
  const [dragging, setDragging] = useState<{ blockId: string; startX: number; startY: number; blockX: number; blockY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ fromBlockId: string; cursorX: number; cursorY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  // Initialize canvas from existing data
  useEffect(() => {
    if (trigger.event) {
      deserialize(trigger, initialActions, initialLayout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Palette click: add block at center ──
  const handlePaletteBlock = useCallback((item: PaletteItem) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (rect.width / 2 - pan.x) / zoom - BLOCK_W / 2;
    const cy = (rect.height / 2 - pan.y) / zoom - BLOCK_H / 2;
    addBlock(item.category, item.label, item.icon, cx, cy, item.data);
  }, [addBlock, pan, zoom]);

  // ── Block drag ──
  const handleBlockDragStart = useCallback((blockId: string, e: React.PointerEvent) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    setDragging({ blockId, startX: e.clientX, startY: e.clientY, blockX: block.x, blockY: block.y });
  }, [blocks]);

  // ── Port connection start ──
  const handlePortDragStart = useCallback((blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const port = getOutputPort(block);
    setConnecting({ fromBlockId: blockId, cursorX: port.x, cursorY: port.y });
  }, [blocks]);

  // ── Port drop ──
  const handlePortDrop = useCallback((toBlockId: string) => {
    if (!connecting) return;
    addConnection(connecting.fromBlockId, toBlockId);
    setConnecting(null);
  }, [connecting, addConnection]);

  // ── Global pointer events ──
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / zoom;
      const dy = (e.clientY - dragging.startY) / zoom;
      moveBlock(dragging.blockId, snapToGrid(dragging.blockX + dx), snapToGrid(dragging.blockY + dy));
    } else if (connecting) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY, pan, zoom, rect);
      setConnecting({ ...connecting, cursorX: x, cursorY: y });
    } else if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      setPan({ x: panning.panX + dx, y: panning.panY + dy });
    }
  }, [dragging, connecting, panning, zoom, pan, moveBlock, setPan]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    setConnecting(null);
    setPanning(null);
  }, []);

  const handleCanvasPanStart = useCallback((e: React.PointerEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'rect') {
      setSelectedBlockId(null);
      setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
    }
  }, [pan, setSelectedBlockId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
  }, [handleZoom]);

  // ── Save ──
  const handleSaveClick = useCallback(() => {
    const result = serialize();
    if (!result) return;
    onSave(result.trigger, result.actions, getLayout());
  }, [serialize, getLayout, onSave]);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">
            🎨 Canvas Visual {ruleName && `— ${ruleName}`}
          </span>
          <span className="text-xs text-slate-400">
            {blocks.length} blocos · {connections.length} conexões
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleZoom(-0.1)}
            className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => handleZoom(0.1)}
            className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
            title="Zoom in"
          >
            +
          </button>
          <div className="w-px h-5 bg-slate-300 mx-1" />
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className="px-4 py-1.5 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 font-medium transition-colors"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <BlockPalette entity={entity} onDragBlock={handlePaletteBlock} />

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-slate-50"
          onWheel={handleWheel}
        >
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full"
            onPointerDown={handleCanvasPanStart}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ cursor: panning ? "grabbing" : "default" }}
          >
            {/* Grid pattern */}
            <defs>
              <pattern id="grid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse" x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)}>
                <path d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`} fill="none" stroke="#e2e8f0" strokeWidth={0.5} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Panned + zoomed group */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Connections */}
              {connections.map((conn) => (
                <ConnectionLine
                  key={conn.id}
                  connection={conn}
                  blocks={blocks}
                  onRemove={() => removeConnection(conn.id)}
                />
              ))}

              {/* Temp connection while dragging */}
              {connecting && (() => {
                const fromBlock = blocks.find((b) => b.id === connecting.fromBlockId);
                if (!fromBlock) return null;
                const from = getOutputPort(fromBlock);
                return <TempConnectionLine from={from} to={{ x: connecting.cursorX, y: connecting.cursorY }} />;
              })()}

              {/* Blocks */}
              {blocks.map((block) => (
                <CanvasBlockComp
                  key={block.id}
                  block={block}
                  selected={selectedBlockId === block.id}
                  onSelect={() => setSelectedBlockId(block.id)}
                  onDragStart={(e) => handleBlockDragStart(block.id, e)}
                  onPortDragStart={handlePortDragStart}
                  onPortDrop={handlePortDrop}
                  onRemove={() => removeBlock(block.id)}
                />
              ))}
            </g>
          </svg>

          {/* Empty state */}
          {blocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-5xl mb-3 opacity-30">🎨</div>
                <p className="text-sm text-slate-400 font-medium">
                  Clique nos blocos da paleta para adicioná-los ao canvas
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Arraste para mover · Conecte as portas entre si
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
