import React, { useState } from 'react';
import clsx from 'clsx';

export type DrawingTool = 'pen' | 'highlighter' | 'eraser' | 'line' | 'rect' | 'circle' | 'arrow';

export interface WhiteboardCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  drawingTool: DrawingTool;
  setDrawingTool: (tool: DrawingTool) => void;
  drawColor: string;
  setDrawColor: (color: string) => void;
  drawWidth: number;
  setDrawWidth: (width: number) => void;
  clearBoard: () => void;
  syncWorkspaceWithPeer: () => void;
  downloadWhiteboard: () => void;
  beginDraw: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  continueDraw: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  endDraw: () => void;
}

export function WhiteboardCanvas({
  canvasRef,
  drawingTool,
  setDrawingTool,
  drawColor,
  setDrawColor,
  drawWidth,
  setDrawWidth,
  clearBoard,
  syncWorkspaceWithPeer,
  downloadWhiteboard,
  beginDraw,
  continueDraw,
  endDraw
}: WhiteboardCanvasProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [paperGrid, setPaperGrid] = useState(true);

  const colors = ['#0A1612', '#FFFFFF', '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const strokeSizes = [
    { width: 2, dot: 3 },
    { width: 4, dot: 6 },
    { width: 8, dot: 9 },
    { width: 14, dot: 13 }
  ];

  return (
    <div className="relative h-full w-full bg-surface flex flex-col overflow-hidden">
      {/* Whiteboard Floating Toolbar */}
      <div 
        role="toolbar" 
        aria-label="Whiteboard toolbar"
        className="absolute left-2.5 top-2.5 z-20 flex flex-wrap items-center gap-1 sm:gap-1.5 rounded-2xl bg-surface/95 backdrop-blur-md border border-border p-1.5 text-xs text-text shadow-elevation-2 max-w-[calc(100%-20px)] overflow-x-auto custom-scrollbar select-none"
      >
        {/* GROUP 1: Tools (Pen, Highlight, Eraser & Shapes) */}
        <div className="flex items-center gap-0.5 sm:gap-1" role="group" aria-label="Drawing tools">
          <button
            onClick={() => setDrawingTool('pen')}
            className={clsx(
              "px-2 py-1 rounded-xl flex items-center gap-1 font-bold text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              drawingTool === 'pen' ? "bg-primary text-on-primary shadow-xs" : "hover:bg-surface-2 text-text"
            )}
            title="Pen tool"
            aria-label="Pen tool"
          >
            <span className="material-symbols-outlined text-base">edit</span>
            <span className="hidden sm:inline">Pen</span>
          </button>

          <button
            onClick={() => setDrawingTool('highlighter')}
            className={clsx(
              "px-2 py-1 rounded-xl flex items-center gap-1 font-bold text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              drawingTool === 'highlighter' ? "bg-accent text-on-primary shadow-xs" : "hover:bg-surface-2 text-text"
            )}
            title="Highlighter tool"
            aria-label="Highlighter tool"
          >
            <span className="material-symbols-outlined text-base">ink_highlighter</span>
            <span className="hidden sm:inline">Highlight</span>
          </button>

          <button
            onClick={() => setDrawingTool('eraser')}
            className={clsx(
              "px-2 py-1 rounded-xl flex items-center gap-1 font-bold text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              drawingTool === 'eraser' ? "bg-danger text-white shadow-xs" : "hover:bg-surface-2 text-text"
            )}
            title="Eraser tool"
            aria-label="Eraser tool"
          >
            <span className="material-symbols-outlined text-base">ink_eraser</span>
            <span className="hidden sm:inline">Eraser</span>
          </button>

          {/* Shape tools */}
          <div className="flex items-center gap-0.5 ml-0.5 pl-0.5 border-l border-border">
            <button
              onClick={() => setDrawingTool('line')}
              className={clsx(
                "p-1 rounded-lg text-text transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                drawingTool === 'line' ? "bg-primary-tint text-primary-text font-bold" : "hover:bg-surface-2"
              )}
              title="Draw Line"
              aria-label="Draw Line"
            >
              <span className="material-symbols-outlined text-base">horizontal_rule</span>
            </button>
            <button
              onClick={() => setDrawingTool('arrow')}
              className={clsx(
                "p-1 rounded-lg text-text transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                drawingTool === 'arrow' ? "bg-primary-tint text-primary-text font-bold" : "hover:bg-surface-2"
              )}
              title="Draw Arrow"
              aria-label="Draw Arrow"
            >
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
            <button
              onClick={() => setDrawingTool('rect')}
              className={clsx(
                "p-1 rounded-lg text-text transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                drawingTool === 'rect' ? "bg-primary-tint text-primary-text font-bold" : "hover:bg-surface-2"
              )}
              title="Draw Rectangle"
              aria-label="Draw Rectangle"
            >
              <span className="material-symbols-outlined text-base">rectangle</span>
            </button>
            <button
              onClick={() => setDrawingTool('circle')}
              className={clsx(
                "p-1 rounded-lg text-text transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                drawingTool === 'circle' ? "bg-primary-tint text-primary-text font-bold" : "hover:bg-surface-2"
              )}
              title="Draw Circle"
              aria-label="Draw Circle"
            >
              <span className="material-symbols-outlined text-base">radio_button_unchecked</span>
            </button>
          </div>
        </div>

        <div className="h-5 w-px bg-border mx-0.5 shrink-0" />

        {/* GROUP 2: Colour Swatches (with borders for high visibility) */}
        <div className="flex items-center gap-1" role="group" aria-label="Stroke color palette">
          {colors.map(color => {
            const isSelected = drawingTool !== 'eraser' && drawColor === color;
            return (
              <button
                key={color}
                onClick={() => {
                  setDrawColor(color);
                  if (drawingTool === 'eraser') setDrawingTool('pen');
                }}
                className={clsx(
                  "w-5 h-5 rounded-full border border-border shadow-2xs transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  isSelected
                    ? "scale-125 ring-2 ring-primary ring-offset-2 ring-offset-surface z-10"
                    : "hover:scale-110 opacity-90 hover:opacity-100"
                )}
                style={{ backgroundColor: color }}
                title={`Color ${color}`}
                aria-label={`Select color ${color}`}
              />
            );
          })}
        </div>

        <div className="h-5 w-px bg-border mx-0.5 shrink-0" />

        {/* GROUP 3: Size (Icon Dots instead of px text) */}
        <div className="flex items-center gap-1" role="group" aria-label="Stroke size selector">
          {strokeSizes.map(({ width, dot }) => {
            const isSelected = drawWidth === width;
            return (
              <button
                key={width}
                onClick={() => setDrawWidth(width)}
                className={clsx(
                  "w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  isSelected
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-muted hover:text-text hover:bg-surface-2"
                )}
                title={`${width}px stroke size`}
                aria-label={`Stroke width ${width} pixels`}
              >
                <span
                  className="rounded-full bg-current transition-all"
                  style={{ width: `${dot}px`, height: `${dot}px` }}
                />
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-border mx-0.5 shrink-0" />

        {/* GROUP 4: Actions (Sync, Save, Grid toggle, Clear) */}
        <div className="flex items-center gap-1" role="group" aria-label="Whiteboard actions">
          <button 
            onClick={syncWorkspaceWithPeer} 
            className="px-2 py-1 rounded-xl text-xs font-bold text-primary-text bg-primary-tint border border-primary/20 hover:bg-primary-tint/80 flex items-center gap-1 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95"
            title="Sync drawing with peer"
            aria-label="Sync drawing with peer"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            <span className="hidden md:inline">Sync</span>
          </button>

          <button 
            onClick={downloadWhiteboard} 
            className="px-2 py-1 rounded-xl text-xs font-bold text-text hover:bg-surface-2 border border-border flex items-center gap-1 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95"
            title="Export Whiteboard as Image"
            aria-label="Export Whiteboard as Image"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span className="hidden md:inline">Save</span>
          </button>

          {/* Subtle Grid Paper Toggle */}
          <button
            onClick={() => setPaperGrid(v => !v)}
            className={clsx(
              "px-2 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95",
              paperGrid 
                ? "bg-surface-2 text-primary border-primary/30 font-extrabold" 
                : "bg-surface text-muted hover:text-text border-border"
            )}
            title={paperGrid ? "Paper: Dot Grid Active" : "Paper: Plain Active"}
            aria-label="Toggle paper dot grid surface"
          >
            <span className="material-symbols-outlined text-sm">{paperGrid ? 'grid_4x4' : 'check_box_outline_blank'}</span>
            <span className="hidden lg:inline">{paperGrid ? 'Grid' : 'Plain'}</span>
          </button>

          {/* Destructive Clear Button with Confirmation */}
          <div className="ml-0.5 pl-0.5 border-l border-border">
            {showClearConfirm ? (
              <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-danger/40 animate-in fade-in slide-in-from-right-1 duration-150">
                <span className="text-xs font-bold text-danger px-1">Clear all?</span>
                <button
                  onClick={() => {
                    clearBoard();
                    setShowClearConfirm(false);
                  }}
                  className="px-2 py-0.5 bg-danger text-white rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-xs"
                  aria-label="Confirm clear whiteboard"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-0.5 bg-surface text-text rounded-lg text-xs font-bold hover:bg-surface-2 border border-border active:scale-95 transition-all"
                  aria-label="Cancel clear whiteboard"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-2 py-1 rounded-xl text-xs font-bold text-danger bg-danger/10 hover:bg-danger hover:text-white border border-danger/30 transition-all flex items-center gap-1 active:scale-95 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                title="Clear entire whiteboard"
                aria-label="Clear whiteboard"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Canvas with subtle dot grid surface pattern option */}
      <canvas
        ref={canvasRef}
        onPointerDown={beginDraw}
        onPointerMove={continueDraw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        style={paperGrid ? {
          backgroundImage: 'radial-gradient(var(--border) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        } : undefined}
        className="h-full w-full touch-none cursor-crosshair bg-surface"
      />
    </div>
  );
}
