"use client";

import { type Block, findStartBlock, walkChain, findBlock } from "@/types/workflow-blocks";
import WorkflowBlockNode from "./WorkflowBlockNode";

interface Props {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onInsertAfter: (afterBlockId: string, via?: "next" | "yesBranch" | "noBranch") => void;
}

/** Vertical arrow connector between blocks */
function Connector({ onClick, label }: { onClick?: () => void; label?: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-0.5 h-4 bg-slate-300" />
      {onClick && (
        <button
          onClick={onClick}
          className="flex items-center justify-center h-6 w-6 rounded-full border-2 border-dashed border-slate-300 text-slate-400 text-xs hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
          title="Inserir bloco aqui"
        >
          +
        </button>
      )}
      {label && !onClick && (
        <span className="text-[9px] text-slate-400 font-medium">{label}</span>
      )}
      <div className="w-0.5 h-4 bg-slate-300" />
      <svg className="h-3 w-3 text-slate-300 -mt-0.5" fill="currentColor" viewBox="0 0 12 12">
        <path d="M6 12L0 6h12L6 12z" />
      </svg>
    </div>
  );
}

/** Render a branch (yesBranch, noBranch, or ACTION_BUTTONS branch) */
function BranchRenderer({
  blocks,
  startId,
  mergeId,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onInsertAfter,
  label,
  parentBlockId,
  branchVia,
  labelColor,
}: {
  blocks: Block[];
  startId: string | null | undefined;
  mergeId: string | null;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onInsertAfter: (afterBlockId: string, via?: string) => void;
  label: string;
  parentBlockId?: string;
  branchVia?: string;
  labelColor?: string;
}) {
  if (!startId || startId === mergeId) {
    // Branch vazia — mostrar botao + para inserir bloco na branch
    const via = branchVia || (label === "SIM" ? "yesBranch" : "noBranch");
    return (
      <div className="flex flex-col items-center px-4">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-1 ${labelColor || "text-slate-400 bg-slate-100 border-slate-200"}`}>
          {label}
        </span>
        {parentBlockId && (
          <button
            onClick={() => onInsertAfter(parentBlockId, via)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-amber-400 bg-amber-50 text-amber-500 hover:bg-amber-100 hover:border-amber-500 transition-colors mt-1"
            title={`Adicionar bloco no caminho ${label}`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
        {!parentBlockId && <span className="text-[10px] text-slate-300 italic">(vazio)</span>}
      </div>
    );
  }

  const branchBlocks: Block[] = [];
  let currentId: string | null = startId;
  const visited = new Set<string>();
  while (currentId && currentId !== mergeId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const b = findBlock(blocks, currentId);
    if (!b) break;
    branchBlocks.push(b);
    currentId = b.next;
  }

  const via = branchVia || (label === "SIM" ? "yesBranch" : "noBranch");
  const defaultLabelColor = label === "SIM" ? "text-green-600 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className="flex flex-col items-center px-2" style={{ minWidth: "12rem" }}>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-1 ${labelColor || defaultLabelColor}`}>
        {label}
      </span>
      {branchBlocks.map((b, i) => (
        <div key={b.id} className="flex flex-col items-center">
          {i > 0 && <Connector onClick={() => onInsertAfter(branchBlocks[i - 1].id)} />}
          <WorkflowBlockNode
            block={b}
            isSelected={selectedBlockId === b.id}
            isFirst={false}
            isLast={false}
            onClick={() => onSelectBlock(b.id)}
            onDelete={() => onDeleteBlock(b.id)}
          />
          {/* CONDITION inside branch: render sub-branches */}
          {b.type === "CONDITION" && (
            <div className="flex flex-col items-center mt-1">
              <div className="w-0.5 h-3 bg-amber-300" />
              <div className="grid grid-cols-2 gap-2 w-full">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-3 bg-amber-300" />
                  <BranchRenderer blocks={blocks} startId={b.yesBranch} mergeId={b.next}
                    selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock}
                    onDeleteBlock={onDeleteBlock} onInsertAfter={onInsertAfter}
                    label="SIM" parentBlockId={b.id} />
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-3 bg-amber-300" />
                  <BranchRenderer blocks={blocks} startId={b.noBranch} mergeId={b.next}
                    selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock}
                    onDeleteBlock={onDeleteBlock} onInsertAfter={onInsertAfter}
                    label="NAO" parentBlockId={b.id} />
                </div>
              </div>
              <div className="w-0.5 h-3 bg-amber-300" />
            </div>
          )}
          {/* ACTION_BUTTONS inside branch: render N sub-branches (only when 2+ buttons) */}
          {b.type === "ACTION_BUTTONS" && b.branches && (() => {
            const btns: { id: string; label: string; color: string; icon?: string }[] = b.config?.buttons || [];
            if (btns.length <= 1) return null;
            const BC: Record<string, string> = { green: "text-green-600 bg-green-50 border-green-200", red: "text-red-600 bg-red-50 border-red-200", blue: "text-blue-600 bg-blue-50 border-blue-200", yellow: "text-yellow-700 bg-yellow-50 border-yellow-200", slate: "text-slate-600 bg-slate-100 border-slate-300" };
            return (
              <div className="flex flex-col items-center mt-1">
                <div className="w-0.5 h-3 bg-amber-300" />
                <div className="flex gap-2 w-full justify-center">
                  {btns.map(btn => (
                    <div key={btn.id} className="flex flex-col items-center">
                      <div className="w-0.5 h-3 bg-amber-300" />
                      <BranchRenderer blocks={blocks} startId={b.branches?.[btn.id]} mergeId={b.next}
                        selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock}
                        onDeleteBlock={onDeleteBlock} onInsertAfter={onInsertAfter}
                        label={`${btn.icon || ""} ${btn.label}`.trim()} parentBlockId={b.id}
                        branchVia={`branches.${btn.id}`} labelColor={BC[btn.color] || BC.slate} />
                    </div>
                  ))}
                </div>
                <div className="w-0.5 h-3 bg-amber-300" />
              </div>
            );
          })()}
        </div>
      ))}
      {/* + button after last block in branch to continue adding */}
      {branchBlocks.length > 0 && (
        <Connector onClick={() => onInsertAfter(branchBlocks[branchBlocks.length - 1].id)} />
      )}
      {/* Show "Fim" indicator when branch terminates (doesn't merge back) */}
      {branchBlocks.length > 0 && (() => {
        const lastBlock = branchBlocks[branchBlocks.length - 1];
        const lastNext = lastBlock.next;
        // Branch terminates if: next is null, or next points to END block, or next !== mergeId
        const nextBlock = lastNext ? findBlock(blocks, lastNext) : null;
        const terminates = !lastNext || (nextBlock?.type === "END") || (lastNext !== mergeId && !nextBlock);
        if (!terminates) return null;
        return (
          <div className="flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 mt-0.5">
            <span className="text-[10px]">⏹️</span>
            <span className="text-[10px] font-semibold text-slate-500">Fim</span>
          </div>
        );
      })()}
    </div>
  );
}

export default function WorkflowCanvas({ blocks, selectedBlockId, onSelectBlock, onDeleteBlock, onInsertAfter }: Props) {
  const startBlock = findStartBlock(blocks);
  if (!startBlock) return <div className="flex-1 flex items-center justify-center text-slate-400">Workflow vazio</div>;

  // Walk the main chain
  const chainIds = walkChain(blocks, startBlock.id);

  // Click on empty area deselects
  function handleBackgroundClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onSelectBlock(null);
  }

  return (
    <div
      className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50/50 p-6"
      onClick={handleBackgroundClick}
    >
      <div className="flex flex-col items-center min-h-full">
        {chainIds.map((blockId, idx) => {
          const block = findBlock(blocks, blockId);
          if (!block) return null;

          const prevBlock = idx > 0 ? findBlock(blocks, chainIds[idx - 1]) : null;
          const isFirst = block.type === "START";
          const isLast = block.type === "END";

          return (
            <div key={blockId} className="flex flex-col items-center">
              {/* Connector between blocks */}
              {idx > 0 && prevBlock?.type !== "CONDITION" && !(prevBlock?.type === "ACTION_BUTTONS" && (prevBlock.config?.buttons?.length || 0) > 1) && (
                <Connector onClick={() => onInsertAfter(chainIds[idx - 1])} />
              )}

              {/* The block itself */}
              <WorkflowBlockNode
                block={block}
                isSelected={selectedBlockId === blockId}
                isFirst={isFirst}
                isLast={isLast}
                onClick={() => onSelectBlock(isFirst || isLast ? null : blockId)}
                onDelete={() => onDeleteBlock(blockId)}
              />

              {/* ACTION_BUTTONS: render N branches (only when 2+ buttons) */}
              {block.type === "ACTION_BUTTONS" && (block.config?.buttons?.length || 0) > 1 && (() => {
                const buttons: { id: string; label: string; color: string; icon?: string }[] = block.config?.buttons || [];
                const BRANCH_COLORS: Record<string, string> = {
                  green: "text-green-600 bg-green-50 border-green-200",
                  red: "text-red-600 bg-red-50 border-red-200",
                  blue: "text-blue-600 bg-blue-50 border-blue-200",
                  yellow: "text-yellow-700 bg-yellow-50 border-yellow-200",
                  slate: "text-slate-600 bg-slate-100 border-slate-300",
                };
                return (
                  <div className="flex flex-col items-center mt-1">
                    <div className="w-0.5 h-4 bg-amber-300" />
                    <div className="relative w-full flex justify-center">
                      <div className="absolute top-0 h-0.5 bg-amber-300" style={{ width: `${Math.max(50, buttons.length * 25)}%`, left: `${Math.max(0, 50 - buttons.length * 12.5)}%` }} />
                    </div>
                    <div className="flex gap-4 w-full justify-center" style={{ minWidth: `${buttons.length * 14}rem` }}>
                      {buttons.map(btn => (
                        <div key={btn.id} className="flex flex-col items-center">
                          <div className="w-0.5 h-3 bg-amber-300" />
                          <BranchRenderer
                            blocks={blocks}
                            startId={block.branches?.[btn.id]}
                            mergeId={block.next}
                            selectedBlockId={selectedBlockId}
                            onSelectBlock={onSelectBlock}
                            onDeleteBlock={onDeleteBlock}
                            onInsertAfter={onInsertAfter}
                            label={`${btn.icon || ""} ${btn.label}`.trim()}
                            parentBlockId={block.id}
                            branchVia={`branches.${btn.id}`}
                            labelColor={BRANCH_COLORS[btn.color] || BRANCH_COLORS.slate}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="relative w-full flex justify-center">
                      <div className="absolute top-0 h-0.5 bg-amber-300" style={{ width: `${Math.max(50, buttons.length * 25)}%`, left: `${Math.max(0, 50 - buttons.length * 12.5)}%` }} />
                    </div>
                    <div className="w-0.5 h-3 bg-amber-300" />
                    <svg className="h-3 w-3 text-amber-300 -mt-0.5" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M6 12L0 6h12L6 12z" />
                    </svg>
                  </div>
                );
              })()}

              {/* CONDITION: render branches — symmetric layout */}
              {block.type === "CONDITION" && (
                <div className="flex flex-col items-center mt-1">
                  {/* Vertical line from condition to fork */}
                  <div className="w-0.5 h-4 bg-amber-300" />
                  {/* Horizontal fork line */}
                  <div className="relative w-full flex justify-center">
                    <div className="absolute top-0 h-0.5 bg-amber-300" style={{ width: "50%", left: "25%" }} />
                  </div>
                  {/* Two branches side by side, equal width */}
                  <div className="grid grid-cols-2 gap-4 w-full" style={{ minWidth: "28rem" }}>
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-3 bg-amber-300" />
                      <BranchRenderer
                        blocks={blocks}
                        startId={block.yesBranch}
                        mergeId={block.next}
                        selectedBlockId={selectedBlockId}
                        onSelectBlock={onSelectBlock}
                        onDeleteBlock={onDeleteBlock}
                        onInsertAfter={onInsertAfter}
                        label="SIM"
                        parentBlockId={block.id}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-3 bg-amber-300" />
                      <BranchRenderer
                        blocks={blocks}
                        startId={block.noBranch}
                        mergeId={block.next}
                        selectedBlockId={selectedBlockId}
                      onSelectBlock={onSelectBlock}
                      onDeleteBlock={onDeleteBlock}
                      onInsertAfter={onInsertAfter}
                      label="NAO"
                      parentBlockId={block.id}
                    />
                    </div>
                  </div>
                  {/* Merge line back to center */}
                  <div className="relative w-full flex justify-center">
                    <div className="absolute top-0 h-0.5 bg-amber-300" style={{ width: "50%", left: "25%" }} />
                  </div>
                  <div className="w-0.5 h-3 bg-amber-300" />
                  <svg className="h-3 w-3 text-amber-300 -mt-0.5" fill="currentColor" viewBox="0 0 12 12">
                    <path d="M6 12L0 6h12L6 12z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
