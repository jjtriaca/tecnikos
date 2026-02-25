"use client";

import type { CanvasBlock as CanvasBlockType, CanvasConnection } from "./useCanvasState";
import { getOutputPort, getInputPort, buildConnectionPath } from "./canvasUtils";

/* ═══════════════════════════════════════════════════════════════
   CONNECTION LINE — SVG path between output→input ports
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  connection: CanvasConnection;
  blocks: CanvasBlockType[];
  onRemove: () => void;
}

export default function ConnectionLine({ connection, blocks, onRemove }: Props) {
  const fromBlock = blocks.find((b) => b.id === connection.fromBlockId);
  const toBlock = blocks.find((b) => b.id === connection.toBlockId);
  if (!fromBlock || !toBlock) return null;

  const from = getOutputPort(fromBlock);
  const to = getInputPort(toBlock);
  const pathD = buildConnectionPath(from, to);

  return (
    <g className="group cursor-pointer" onClick={onRemove}>
      {/* Invisible wider path for easier clicking */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} />
      {/* Visible path */}
      <path
        d={pathD}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={2.5}
        strokeDasharray="none"
        className="group-hover:stroke-red-400 transition-colors"
      />
      {/* Arrow at end */}
      <circle cx={to.x} cy={to.y} r={4} fill="#94a3b8" className="group-hover:fill-red-400 transition-colors" />
    </g>
  );
}

/** Temp line while dragging a new connection */
export function TempConnectionLine({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const pathD = buildConnectionPath(from, to);
  return (
    <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 4" />
  );
}
