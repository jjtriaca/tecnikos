"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface DraggableHeaderProps {
  index: number;
  columnId: string;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onResize?: (columnId: string, width: number) => void;
  width?: number;
  children: React.ReactNode;
  className?: string;
}

export default function DraggableHeader({
  index,
  columnId,
  onReorder,
  onResize,
  width,
  children,
  className = "",
}: DraggableHeaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const thRef = useRef<HTMLTableCellElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  /* ---- Drag & Drop (reorder) ---- */
  function handleDragStart(e: React.DragEvent) {
    if (isResizing) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragEnd() {
    setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    if (fromIndex !== index) {
      onReorder(fromIndex, index);
    }
  }

  /* ---- Resize ---- */
  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!onResize) return;
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(60, startWidthRef.current + delta);
      onResize(columnId, newWidth);
    },
    [onResize, columnId],
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [handleResizeMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = thRef.current?.offsetWidth ?? 100;
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const style: React.CSSProperties = width
    ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }
    : {};

  return (
    <th
      ref={thRef}
      draggable={!isResizing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={style}
      className={`relative cursor-grab select-none transition-colors ${isDragging ? "opacity-40" : ""} ${isDragOver ? "bg-blue-50 border-l-2 border-l-blue-400" : ""} ${className}`}
    >
      {children}
      {/* Resize handle */}
      {onResize && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors z-10"
          title="Arrastar para redimensionar"
        />
      )}
    </th>
  );
}
