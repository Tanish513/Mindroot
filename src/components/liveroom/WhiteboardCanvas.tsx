import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';

export type DrawingTool = 'pen' | 'highlighter' | 'eraser' | 'stroke_eraser' | 'line' | 'rect' | 'circle' | 'arrow';

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
  onUndo?: () => void;
  onRedo?: () => void;
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
  endDraw,
  onUndo,
  onRedo
}: WhiteboardCanvasProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [paperGrid, setPaperGrid] = useState(true);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const shapesMenuRef = useRef<HTMLDivElement>(null);
  const colorPopoverRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // High-contrast ink colors that stay clearly visible on the Midnight Indigo canvas
  const colors = ['#FFFFFF', '#ECEBFA', '#10B981', '#38BDF8', '#F59E0B', '#EF4444', '#A78BFA'];
  const strokeSizes = [
    { width: 2, dot: 3 },
    { width: 4, dot: 6 },
    { width: 8, dot: 9 },
    { width: 14, dot: 13 }
  ];

  // Auto-map dark ink (#0A1612, black, or dark blue) to clean white for high contrast on dark canvas
  useEffect(() => {
    if (drawColor === '#0A1612' || drawColor === '#000000' || drawColor === '#0F1020' || drawColor === '#2563eb') {
      setDrawColor('#FFFFFF');
    }
  }, [drawColor, setDrawColor]);

  // Click-outside listener without blocking full-screen backdrops
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (shapesMenuRef.current && !shapesMenuRef.current.contains(target)) {
        setShowShapesMenu(false);
      }
      if (colorPopoverRef.current && !colorPopoverRef.current.contains(target)) {
        setShowColorPopover(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const saveCanvasState = () => {
    const c = canvasRef.current;
    if (!c || c.width === 0 || c.height === 0) return;
    try {
      const dataUrl = c.toDataURL('image/png');
      setUndoStack(prev => {
        if (prev.length > 0 && prev[prev.length - 1] === dataUrl) {
          return prev;
        }
        return [...prev.slice(-20), dataUrl];
      });
      setRedoStack([]);
    } catch {}
  };

  // Synchronize internal canvas bitmap resolution with display dimensions
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const syncCanvasSize = () => {
      const rect = c.getBoundingClientRect();
      const targetW = Math.max(300, Math.round(rect.width || c.clientWidth || 800));
      const targetH = Math.max(150, Math.round(rect.height || c.clientHeight || 500));

      if (c.width !== targetW || c.height !== targetH) {
        // Save existing drawing buffer before updating dimensions
        const ctx = c.getContext('2d');
        let tempCanvas: HTMLCanvasElement | null = null;
        if (ctx && c.width > 0 && c.height > 0) {
          tempCanvas = document.createElement('canvas');
          tempCanvas.width = c.width;
          tempCanvas.height = c.height;
          tempCanvas.getContext('2d')?.drawImage(c, 0, 0);
        }

        c.width = targetW;
        c.height = targetH;

        if (tempCanvas && ctx) {
          ctx.drawImage(tempCanvas, 0, 0);
        }
        saveCanvasState();
      }
    };

    syncCanvasSize();
    const ro = new ResizeObserver(() => syncCanvasSize());
    ro.observe(c);

    return () => ro.disconnect();
  }, [canvasRef]);

  const handlePointerUp = () => {
    endDraw();
    saveCanvasState();
  };

  const handleUndo = () => {
    const c = canvasRef.current;
    if (!c || undoStack.length <= 1) return;
    const currentUrl = undoStack[undoStack.length - 1];
    const prevUrl = undoStack[undoStack.length - 2];
    setRedoStack(r => [...r, currentUrl]);
    setUndoStack(u => u.slice(0, -1));

    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      onUndo?.();
    };
    img.src = prevUrl;
  };

  const handleRedo = () => {
    const c = canvasRef.current;
    if (!c || redoStack.length === 0) return;
    const nextUrl = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, nextUrl]);
    setRedoStack(r => r.slice(0, -1));

    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      onRedo?.();
    };
    img.src = nextUrl;
  };

  const isShapeActive = ['line', 'arrow', 'rect', 'circle'].includes(drawingTool);

  return (
    <div className="relative h-full w-full bg-[#171830] flex flex-col overflow-hidden text-[#ECEBFA]">
      {/* Whiteboard Floating Toolbar (overflow-visible to prevent popover clipping) */}
      <div 
        role="toolbar" 
        aria-label="Whiteboard toolbar"
        className="absolute left-2.5 top-2.5 z-20 flex flex-wrap items-center gap-1 sm:gap-1.5 rounded-2xl bg-[#171830]/95 backdrop-blur-md border border-white/[0.07] p-1.5 text-xs text-[#ECEBFA] shadow-xl max-w-[calc(100%-20px)] overflow-visible select-none"
      >
        {/* GROUP 1: Tools (Pen, Highlighter, Eraser, Shapes) */}
        <div className="flex items-center gap-0.5 sm:gap-1" role="group" aria-label="Drawing tools">
          <button
            onClick={() => {
              setDrawingTool('pen');
              setShowShapesMenu(false);
            }}
            className={clsx(
              "px-2 py-1 rounded-xl flex items-center gap-1 font-medium text-xs transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none cursor-pointer",
              drawingTool === 'pen' ? "bg-[#10B981] text-white shadow-xs" : "hover:bg-[#202244] text-[#A5A3C7] hover:text-[#ECEBFA]"
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
              "px-2 py-1 rounded-xl flex items-center gap-1 font-medium text-xs transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none cursor-pointer",
              drawingTool === 'highlighter' ? "bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30 shadow-xs" : "hover:bg-[#202244] text-[#A5A3C7] hover:text-[#ECEBFA]"
            )}
            title="Highlighter tool"
            aria-label="Highlighter tool"
          >
            <span className="material-symbols-outlined text-base">ink_highlighter</span>
            <span className="hidden sm:inline">Highlight</span>
          </button>

          <button
            onClick={() => {
              setDrawingTool('stroke_eraser');
              setShowShapesMenu(false);
            }}
            className={clsx(
              "px-2 py-1 rounded-xl flex items-center gap-1 font-medium text-xs transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none cursor-pointer",
              drawingTool === 'stroke_eraser' ? "bg-[#202244] text-[#10B981] font-semibold border border-[#10B981]/30 shadow-xs" : "hover:bg-[#202244] text-[#A5A3C7] hover:text-[#ECEBFA]"
            )}
            title="Stroke Eraser (erases whole strokes on touch)"
            aria-label="Stroke eraser tool"
          >
            <span className="material-symbols-outlined text-base">auto_fix_normal</span>
            <span className="hidden sm:inline">Stroke Eraser</span>
          </button>

          <button
            onClick={() => {
              setDrawingTool('eraser');
              setShowShapesMenu(false);
            }}
            className={clsx(
              "px-2 py-1 rounded-xl flex items-center gap-1 font-medium text-xs transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none cursor-pointer",
              drawingTool === 'eraser' ? "bg-[#202244] text-[#10B981] font-semibold border border-[#10B981]/30 shadow-xs" : "hover:bg-[#202244] text-[#A5A3C7] hover:text-[#ECEBFA]"
            )}
            title="Pixel Eraser (standard brush eraser)"
            aria-label="Eraser tool"
          >
            <span className="material-symbols-outlined text-base">ink_eraser</span>
            <span className="hidden sm:inline">Eraser</span>
          </button>

          {/* Shapes Dropdown */}
          <div className="relative" ref={shapesMenuRef}>
            <button
              onClick={() => setShowShapesMenu(v => !v)}
              className={clsx(
                "px-2 py-1 rounded-xl flex items-center gap-1 text-xs transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none cursor-pointer",
                isShapeActive ? "bg-[#202244] text-[#10B981] font-semibold" : "hover:bg-[#202244] text-[#A5A3C7] hover:text-[#ECEBFA]"
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
              <div className="absolute top-full mt-1.5 left-0 z-50 bg-[#171830] rounded-xl border border-white/[0.07] shadow-2xl p-1 flex items-center gap-1 animate-in fade-in duration-150 backdrop-blur-md">
                <button
                  onClick={() => { setDrawingTool('line'); setShowShapesMenu(false); }}
                  className={clsx("p-1.5 rounded-lg hover:bg-[#202244] cursor-pointer text-[#A5A3C7] hover:text-[#ECEBFA]", drawingTool === 'line' && "bg-[#202244] text-[#10B981]")}
                  title="Line"
                  aria-label="Draw Line"
                >
                  <span className="material-symbols-outlined text-base">horizontal_rule</span>
                </button>
                <button
                  onClick={() => { setDrawingTool('arrow'); setShowShapesMenu(false); }}
                  className={clsx("p-1.5 rounded-lg hover:bg-[#202244] cursor-pointer text-[#A5A3C7] hover:text-[#ECEBFA]", drawingTool === 'arrow' && "bg-[#202244] text-[#10B981]")}
                  title="Arrow"
                  aria-label="Draw Arrow"
                >
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
                <button
                  onClick={() => { setDrawingTool('rect'); setShowShapesMenu(false); }}
                  className={clsx("p-1.5 rounded-lg hover:bg-[#202244] cursor-pointer text-[#A5A3C7] hover:text-[#ECEBFA]", drawingTool === 'rect' && "bg-[#202244] text-[#10B981]")}
                  title="Rectangle"
                  aria-label="Draw Rectangle"
                >
                  <span className="material-symbols-outlined text-base">rectangle</span>
                </button>
                <button
                  onClick={() => { setDrawingTool('circle'); setShowShapesMenu(false); }}
                  className={clsx("p-1.5 rounded-lg hover:bg-[#202244] cursor-pointer text-[#A5A3C7] hover:text-[#ECEBFA]", drawingTool === 'circle' && "bg-[#202244] text-[#10B981]")}
                  title="Circle"
                  aria-label="Draw Circle"
                >
                  <span className="material-symbols-outlined text-base">radio_button_unchecked</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="h-5 w-px bg-white/[0.07] mx-0.5 shrink-0" />

        {/* GROUP 2: Color + Size (Collapsed Color Swatch Popover + Stroke Size Dots) */}
        <div className="flex items-center gap-1 sm:gap-1.5" role="group" aria-label="Color and stroke size">
          {/* Collapsed Color Swatch Trigger & Popover */}
          <div className="relative" ref={colorPopoverRef}>
            <button
              onClick={() => setShowColorPopover(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-xl bg-[#202244] hover:bg-[#202244]/80 text-[#ECEBFA] border border-white/[0.07] transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none"
              title="Stroke color popover"
              aria-label="Select stroke color"
            >
              <span
                className="w-4 h-4 rounded-full border border-white/20 shadow-xs shrink-0"
                style={{ backgroundColor: drawColor }}
              />
              <span className="material-symbols-outlined text-[14px] text-[#A5A3C7]">palette</span>
              <span className="material-symbols-outlined text-[13px] text-[#A5A3C7]">expand_more</span>
            </button>

            {/* Popover palette with accessible swatches (persisted in DOM) */}
            <div className={clsx(
              "absolute top-full mt-1.5 left-0 z-50 bg-[#171830] rounded-xl border border-white/[0.07] shadow-2xl p-2 items-center gap-1.5 animate-in fade-in duration-150 backdrop-blur-md",
              showColorPopover ? "flex" : "hidden"
            )}>
              {colors.map(color => {
                const isSelected = drawingTool !== 'eraser' && drawingTool !== 'stroke_eraser' && drawColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => {
                      setDrawColor(color);
                      if (drawingTool === 'eraser' || drawingTool === 'stroke_eraser') setDrawingTool('pen');
                      setShowColorPopover(false);
                    }}
                    className={clsx(
                      "w-5 h-5 rounded-full border border-white/20 shadow-2xs transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none cursor-pointer",
                      isSelected
                        ? "scale-125 ring-2 ring-[#10B981] ring-offset-2 ring-offset-[#171830] z-10"
                        : "hover:scale-110 opacity-90 hover:opacity-100"
                    )}
                    style={{ backgroundColor: color }}
                    title={`Color ${color}`}
                    aria-label={`Select color ${color}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Size Dots (4 widths) */}
          <div className="flex items-center gap-0.5" role="group" aria-label="Stroke size selector">
            {strokeSizes.map(({ width, dot }) => {
              const isSelected = drawWidth === width;
              return (
                <button
                  key={width}
                  onClick={() => setDrawWidth(width)}
                  className={clsx(
                    "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none cursor-pointer",
                    isSelected
                      ? "bg-[#10B981] text-white shadow-xs"
                      : "text-[#A5A3C7] hover:text-[#ECEBFA] hover:bg-[#202244]"
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
        </div>

        <div className="h-5 w-px bg-white/[0.07] mx-0.5 shrink-0" />

        {/* GROUP 3: Undo / Redo */}
        <div className="flex items-center gap-0.5" role="group" aria-label="History actions">
          <button
            onClick={handleUndo}
            disabled={undoStack.length <= 1}
            className="p-1 rounded-lg text-[#A5A3C7] hover:text-[#ECEBFA] hover:bg-[#202244] transition-all duration-200 disabled:opacity-30 cursor-pointer"
            title="Undo stroke"
            aria-label="Undo stroke"
          >
            <span className="material-symbols-outlined text-base">undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1 rounded-lg text-[#A5A3C7] hover:text-[#ECEBFA] hover:bg-[#202244] transition-all duration-200 disabled:opacity-30 cursor-pointer"
            title="Redo stroke"
            aria-label="Redo stroke"
          >
            <span className="material-symbols-outlined text-base">redo</span>
          </button>
        </div>

        <div className="h-5 w-px bg-white/[0.07] mx-0.5 shrink-0" />

        {/* GROUP 4: More Menu (Grid, Save) + Clear confirmation */}
        <div className="flex items-center gap-1" role="group" aria-label="Whiteboard actions">
          {/* More Popover */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className="px-2 py-1 rounded-xl text-xs font-medium text-[#A5A3C7] hover:text-[#ECEBFA] hover:bg-[#202244] border border-white/[0.07] flex items-center gap-1 transition-all duration-200 cursor-pointer"
              title="More options (Grid, Save)"
              aria-label="More options"
            >
              <span className="material-symbols-outlined text-sm">more_horiz</span>
              <span className="hidden md:inline">More</span>
            </button>

            {showMoreMenu && (
              <div className="absolute top-full mt-1.5 left-0 z-50 bg-[#171830] rounded-xl border border-white/[0.07] shadow-2xl p-1.5 flex flex-col gap-1 min-w-[130px] animate-in fade-in duration-150 backdrop-blur-md">
                <button
                  onClick={() => {
                    setPaperGrid(v => !v);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#ECEBFA] hover:bg-[#202244] flex items-center gap-2 cursor-pointer transition-colors duration-200"
                  aria-label="Toggle paper dot grid surface"
                >
                  <span className="material-symbols-outlined text-sm text-[#10B981]">{paperGrid ? 'grid_4x4' : 'check_box_outline_blank'}</span>
                  <span>{paperGrid ? 'Dot Grid' : 'Plain Canvas'}</span>
                </button>

                <button
                  onClick={() => {
                    downloadWhiteboard();
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#ECEBFA] hover:bg-[#202244] flex items-center gap-2 cursor-pointer transition-colors duration-200"
                  aria-label="Export Whiteboard as Image"
                >
                  <span className="material-symbols-outlined text-sm text-[#38BDF8]">download</span>
                  <span>Save Image</span>
                </button>
              </div>
            )}
          </div>

          {/* Destructive Clear Button with Confirmation */}
          <div className="ml-1 pl-1 border-l border-white/[0.07]">
            {showClearConfirm ? (
              <div className="flex items-center gap-1 bg-[#202244] p-1 rounded-xl border border-red-500/30 animate-in fade-in slide-in-from-right-1 duration-150">
                <span className="text-xs font-semibold text-red-400 px-1">Clear all?</span>
                <button
                  onClick={() => {
                    clearBoard();
                    setShowClearConfirm(false);
                    setUndoStack([]);
                    setRedoStack([]);
                  }}
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium active:scale-95 transition-all shadow-xs cursor-pointer"
                  aria-label="Confirm clear whiteboard"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-0.5 bg-[#171830] text-[#ECEBFA] rounded-lg text-xs font-medium hover:bg-[#171830]/80 border border-white/[0.07] active:scale-95 transition-all cursor-pointer"
                  aria-label="Cancel clear whiteboard"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-2 py-1 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/15 border border-red-500/20 transition-all duration-200 flex items-center gap-1 active:scale-95 cursor-pointer"
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

      {/* Canvas with subtle dot grid surface pattern on Midnight Indigo background */}
      <canvas
        ref={canvasRef}
        onPointerDown={beginDraw}
        onPointerMove={continueDraw}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={clsx(
          "flex-1 w-full h-full touch-none transition-colors duration-200 bg-[#171830]",
          drawingTool === 'stroke_eraser' ? "cursor-cell" : "cursor-crosshair",
          paperGrid && "bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:24px_24px]"
        )}
      />
    </div>
  );
}
