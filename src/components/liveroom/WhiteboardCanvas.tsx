import React, { useState, useEffect } from 'react';
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
  syncWorkspaceWithPeer?: () => void;
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
  downloadWhiteboard,
  beginDraw,
  continueDraw,
  endDraw
}: WhiteboardCanvasProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [paperGrid, setPaperGrid] = useState(true);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);

  const colors = ['#0A1612', '#FFFFFF', '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const strokeSizes = [
    { width: 2, dot: 3 },
    { width: 4, dot: 6 },
    { width: 8, dot: 9 },
    { width: 14, dot: 13 }
  ];

  const saveCanvasState = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    try {
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      setUndoStack(prev => [...prev.slice(-20), imgData]);
      setRedoStack([]);
    } catch {}
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      saveCanvasState();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const handlePointerUp = () => {
    endDraw();
    saveCanvasState();
  };

  const handleUndo = () => {
    const c = canvasRef.current;
    if (!c || undoStack.length <= 1) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const currentImg = undoStack[undoStack.length - 1];
    const prevImg = undoStack[undoStack.length - 2];
    setRedoStack(r => [...r, currentImg]);
    setUndoStack(u => u.slice(0, -1));
    ctx.putImageData(prevImg, 0, 0);
  };

  const handleRedo = () => {
    const c = canvasRef.current;
    if (!c || redoStack.length === 0) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const nextImg = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, nextImg]);
    setRedoStack(r => r.slice(0, -1));
    ctx.putImageData(nextImg, 0, 0);
  };

  const isShapeActive = ['line', 'arrow', 'rect', 'circle'].includes(drawingTool);

  return (
    <div className="relative h-full w-full bg-surface flex flex-col overflow-hidden">
      {/* Whiteboard Floating Toolbar */}
      <div 
        role="toolbar" 
        aria-label="Whiteboard toolbar"
        className="absolute left-2.5 top-2.5 z-20 flex flex-wrap items-center gap-1 sm:gap-1.5 rounded-2xl bg-surface/95 backdrop-blur-md border border-border p-1.5 text-xs text-text shadow-elevation-2 max-w-[calc(100%-20px)] overflow-x-auto custom-scrollbar select-none"
      >
        {/* GROUP 1: Core Tools (Pen, Highlighter, Eraser) */}
        <div className="flex items-center gap-0.5 sm:gap-1" role="group" aria-label="Drawing tools">
          <button
            onClick={() => {
              setDrawingTool('pen');
              setShowShapesMenu(false);
            }}
            className={clsx(
              "px-2 py-1 rounded-xl flex items-center gap-1 font-semibold text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer",
              drawingTool === 'pen' ? "bg-primary text-white shadow-xs" : "hover:bg-surface-2 text-text"
            )}
            title="Pen tool"
            aria-label="Pen tool"
          >
            <span className="material-symbols-outlined text-base">edit</span>
            <span className="hidden sm:inline">Pen</span>
          </button>

          <button
            onClick={() => {
              setDrawingTool('highlighter');
              setShowShapesMenu(false);
            }}
            className={clsx(
              "px-2 py-1 rounded-xl flex items-center gap-1 font-semibold text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer",
              drawingTool === 'highlighter' ? "bg-accent/20 text-accent font-bold border border-accent/30 shadow-xs" : "hover:bg-surface-2 text-text"
            )}
            title="Highlighter tool"
            aria-label="Highlighter tool"
          >
            <span className="material-symbols-outlined text-base">ink_highlighter</span>
            <span className="hidden sm:inline">Highlight</span>
          </button>

          <button
            onClick={() => {
              setDrawingTool('eraser');
              setShowShapesMenu(false);
            }}
            className={clsx(
              "px-2 py-1 rounded-xl flex items-center gap-1 font-semibold text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer",
              drawingTool === 'eraser' ? "bg-surface-2 text-primary font-bold border border-primary/20 shadow-xs" : "hover:bg-surface-2 text-muted"
            )}
            title="Eraser tool"
            aria-label="Eraser tool"
          >
            <span className="material-symbols-outlined text-base">ink_eraser</span>
            <span className="hidden sm:inline">Eraser</span>
          </button>

          {/* Shapes Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowShapesMenu(v => !v)}
              className={clsx(
                "px-2 py-1 rounded-xl flex items-center gap-1 text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer",
                isShapeActive ? "bg-primary-tint text-primary font-bold" : "hover:bg-surface-2 text-muted"
              )}
              title="Shapes"
              aria-label="Select shape tool"
            >
              <span className="material-symbols-outlined text-base">
                {drawingTool === 'line' ? 'horizontal_rule' :
                 drawingTool === 'arrow' ? 'arrow_forward' :
                 drawingTool === 'rect' ? 'rectangle' :
                 drawingTool === 'circle' ? 'radio_button_unchecked' : 'shapes'}
              </span>
              <span className="material-symbols-outlined text-[13px]">expand_more</span>
            </button>

            {showShapesMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowShapesMenu(false)} />
                <div className="absolute top-8 left-0 z-40 bg-surface rounded-xl border border-border shadow-md p-1 flex items-center gap-1 animate-in fade-in duration-150">
                  <button
                    onClick={() => { setDrawingTool('line'); setShowShapesMenu(false); }}
                    className={clsx("p-1.5 rounded-lg hover:bg-surface-2 cursor-pointer", drawingTool === 'line' && "bg-primary-tint text-primary")}
                    title="Line"
                    aria-label="Draw Line"
                  >
                    <span className="material-symbols-outlined text-base">horizontal_rule</span>
                  </button>
                  <button
                    onClick={() => { setDrawingTool('arrow'); setShowShapesMenu(false); }}
                    className={clsx("p-1.5 rounded-lg hover:bg-surface-2 cursor-pointer", drawingTool === 'arrow' && "bg-primary-tint text-primary")}
                    title="Arrow"
                    aria-label="Draw Arrow"
                  >
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                  <button
                    onClick={() => { setDrawingTool('rect'); setShowShapesMenu(false); }}
                    className={clsx("p-1.5 rounded-lg hover:bg-surface-2 cursor-pointer", drawingTool === 'rect' && "bg-primary-tint text-primary")}
                    title="Rectangle"
                    aria-label="Draw Rectangle"
                  >
                    <span className="material-symbols-outlined text-base">rectangle</span>
                  </button>
                  <button
                    onClick={() => { setDrawingTool('circle'); setShowShapesMenu(false); }}
                    className={clsx("p-1.5 rounded-lg hover:bg-surface-2 cursor-pointer", drawingTool === 'circle' && "bg-primary-tint text-primary")}
                    title="Circle"
                    aria-label="Draw Circle"
                  >
                    <span className="material-symbols-outlined text-base">radio_button_unchecked</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="h-5 w-px bg-border mx-0.5 shrink-0" />

        {/* GROUP 2: Undo / Redo */}
        <div className="flex items-center gap-0.5" role="group" aria-label="History actions">
          <button
            onClick={handleUndo}
            disabled={undoStack.length <= 1}
            className="p-1 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-all disabled:opacity-30 cursor-pointer"
            title="Undo stroke"
            aria-label="Undo stroke"
          >
            <span className="material-symbols-outlined text-base">undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-all disabled:opacity-30 cursor-pointer"
            title="Redo stroke"
            aria-label="Redo stroke"
          >
            <span className="material-symbols-outlined text-base">redo</span>
          </button>
        </div>

        <div className="h-5 w-px bg-border mx-0.5 shrink-0" />

        {/* GROUP 3: Colour Swatches (min 5, accessible labels) */}
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
                  "w-5 h-5 rounded-full border border-border shadow-2xs transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer",
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

        {/* GROUP 4: Size Dots (4 widths) */}
        <div className="flex items-center gap-0.5" role="group" aria-label="Stroke size selector">
          {strokeSizes.map(({ width, dot }) => {
            const isSelected = drawWidth === width;
            return (
              <button
                key={width}
                onClick={() => setDrawWidth(width)}
                className={clsx(
                  "w-6 h-6 rounded-lg flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer",
                  isSelected
                    ? "bg-primary text-white shadow-xs"
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

        {/* GROUP 5: More Menu (Grid, Save) + Clear confirmation */}
        <div className="flex items-center gap-1" role="group" aria-label="Whiteboard actions">
          {/* More Popover */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className="px-2 py-1 rounded-xl text-xs font-semibold text-muted hover:text-text hover:bg-surface-2 border border-border flex items-center gap-1 transition-all cursor-pointer"
              title="More options (Grid, Save)"
              aria-label="More options"
            >
              <span className="material-symbols-outlined text-sm">more_horiz</span>
              <span className="hidden md:inline">More</span>
            </button>

            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute top-8 left-0 z-40 bg-surface rounded-xl border border-border shadow-md p-1.5 flex flex-col gap-1 min-w-[120px] animate-in fade-in duration-150">
                  <button
                    onClick={() => {
                      setPaperGrid(v => !v);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-text hover:bg-surface-2 flex items-center gap-2 cursor-pointer"
                    aria-label="Toggle paper dot grid surface"
                  >
                    <span className="material-symbols-outlined text-sm">{paperGrid ? 'grid_4x4' : 'check_box_outline_blank'}</span>
                    <span>{paperGrid ? 'Dot Grid' : 'Plain Paper'}</span>
                  </button>

                  <button
                    onClick={() => {
                      downloadWhiteboard();
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-text hover:bg-surface-2 flex items-center gap-2 cursor-pointer"
                    aria-label="Export Whiteboard as Image"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>Save Image</span>
                  </button>
                </div>
              </>
            )}
          </div>

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
                  className="px-2 py-0.5 bg-danger text-white rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
                  aria-label="Confirm clear whiteboard"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-0.5 bg-surface text-text rounded-lg text-xs font-bold hover:bg-surface-2 border border-border active:scale-95 transition-all cursor-pointer"
                  aria-label="Cancel clear whiteboard"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-2 py-1 rounded-xl text-xs font-semibold text-muted hover:text-danger hover:bg-danger/10 border border-border transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
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
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={clsx(
          "flex-1 w-full h-full touch-none cursor-crosshair transition-colors duration-300",
          paperGrid ? "bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px] bg-surface" : "bg-surface"
        )}
      />
    </div>
  );
}
