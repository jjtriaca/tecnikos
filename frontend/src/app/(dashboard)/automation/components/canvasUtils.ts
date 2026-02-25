/* ═══════════════════════════════════════════════════════════════
   CANVAS UTILS — Hit testing, snap-to-grid, port positions
   ═══════════════════════════════════════════════════════════════ */

import type { CanvasBlock } from "./useCanvasState";

export const BLOCK_W = 240;
export const BLOCK_H = 80;
export const PORT_R = 8;
export const GRID_SIZE = 20;

/** Output port position (right center of block) */
export function getOutputPort(block: CanvasBlock): { x: number; y: number } {
  return { x: block.x + BLOCK_W, y: block.y + BLOCK_H / 2 };
}

/** Input port position (left center of block) */
export function getInputPort(block: CanvasBlock): { x: number; y: number } {
  return { x: block.x, y: block.y + BLOCK_H / 2 };
}

/** Hit-test: is point (px, py) inside block? */
export function isInsideBlock(px: number, py: number, block: CanvasBlock): boolean {
  return px >= block.x && px <= block.x + BLOCK_W && py >= block.y && py <= block.y + BLOCK_H;
}

/** Hit-test: is point near a port? */
export function isNearPort(px: number, py: number, port: { x: number; y: number }, radius = PORT_R * 2): boolean {
  const dx = px - port.x;
  const dy = py - port.y;
  return dx * dx + dy * dy <= radius * radius;
}

/** Snap to grid */
export function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

/** Convert screen coords to canvas coords */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  pan: { x: number; y: number },
  zoom: number,
  containerRect: DOMRect
): { x: number; y: number } {
  return {
    x: (screenX - containerRect.left - pan.x) / zoom,
    y: (screenY - containerRect.top - pan.y) / zoom,
  };
}

/** Build SVG cubic bezier path between two points */
export function buildConnectionPath(
  from: { x: number; y: number },
  to: { x: number; y: number }
): string {
  const dx = Math.abs(to.x - from.x) * 0.5;
  const cp1x = from.x + dx;
  const cp2x = to.x - dx;
  return `M ${from.x} ${from.y} C ${cp1x} ${from.y}, ${cp2x} ${to.y}, ${to.x} ${to.y}`;
}
