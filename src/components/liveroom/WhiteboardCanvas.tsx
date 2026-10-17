import React from 'react';
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
  return (
    <div className="relative h-full w-full bg-surface flex flex-col">
      {/* Whiteboard Floating Toolbar */}
      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-1.5 rounded-2xl bg-surface border border-outline-variant px-3 py-2 text-xs text-on-surface shadow-elevation-2 max-w-[calc(100%-24px)]">
        {/* Drawing Tool Selectors */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDrawingTool('pen')}
            className={clsx("p-1.5 rounded-lg flex items-center gap-1 font-extrabold text-[11px] transition-all", drawingTool === 'pen' ? "bg-primary text-on-primary" : "hover:bg-surface-container text-on-surface")}
            title="Pen tool"
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
            <span className="hidden sm:inline">Pen</span>
          </button>

          <button
            onClick={() => setDrawingTool('highlighter')}
            className={clsx("p-1.5 rounded-lg flex items-center gap-1 font-extrabold text-[11px] transition-all", drawingTool === 'highlighter' ? "bg-learning-amber text-on-learning-amber" : "hover:bg-surface-container text-on-surface")}
            title="Highlighter tool"
          >
            <span className="material-symbols-outlined text-[15px]">ink_highlighter</span>
            <span className="hidden sm:inline">Highlight</span>
          </button>

          <button
            onClick={() => setDrawingTool('eraser')}
            className={clsx("p-1.5 rounded-lg flex items-center gap-1 font-extrabold text-[11px] transition-all", drawingTool === 'eraser' ? "bg-alert-rose text-on-alert-rose" : "hover:bg-surface-container text-on-surface")}
            title="Eraser tool"
          >
            <span className="material-symbols-outlined text-[15px]">ink_eraser</span>
            <span className="hidden sm:inline">Eraser</span>
          </button>
        </div>

        <div className="h-4 w-px bg-outline-variant mx-0.5" />

        {/* Shapes */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => setDrawingTool('line')} className={clsx("p-1 rounded-lg text-on-surface", drawingTool === 'line' ? "bg-primary-container text-on-primary-container font-bold" : "hover:bg-surface-container")} title="Draw Line">
            <span className="material-symbols-outlined text-[16px]">horizontal_rule</span>
          </button>
          <button onClick={() => setDrawingTool('arrow')} className={clsx("p-1 rounded-lg text-on-surface", drawingTool === 'arrow' ? "bg-primary-container text-on-primary-container font-bold" : "hover:bg-surface-container")} title="Draw Arrow">
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
          <button onClick={() => setDrawingTool('rect')} className={clsx("p-1 rounded-lg text-on-surface", drawingTool === 'rect' ? "bg-primary-container text-on-primary-container font-bold" : "hover:bg-surface-container")} title="Draw Rectangle">
            <span className="material-symbols-outlined text-[16px]">rectangle</span>
          </button>
          <button onClick={() => setDrawingTool('circle')} className={clsx("p-1 rounded-lg text-on-surface", drawingTool === 'circle' ? "bg-primary-container text-on-primary-container font-bold" : "hover:bg-surface-container")} title="Draw Circle">
            <span className="material-symbols-outlined text-[16px]">radio_button_unchecked</span>
          </button>
        </div>

        <div className="h-4 w-px bg-outline-variant mx-0.5" />

        {/* Color Palette */}
        <div className="flex items-center gap-1">
          {['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0f172a'].map(color => (
            <button
              key={color}
              onClick={() => { setDrawColor(color); if (drawingTool === 'eraser') setDrawingTool('pen'); }}
              className={clsx(
                "w-4 h-4 rounded-full transition-transform",
                drawingTool !== 'eraser' && drawColor === color ? "scale-125 ring-2 ring-offset-1 ring-primary" : "hover:scale-110"
              )}
              style={{ backgroundColor: color }}
              title={`Color ${color}`}
            />
          ))}
        </div>

        <div className="h-4 w-px bg-outline-variant mx-0.5" />

        {/* Stroke Widths */}
        <div className="flex items-center gap-1">
          {[2, 4, 8, 14].map(w => (
            <button
              key={w}
              onClick={() => setDrawWidth(w)}
              className={clsx(
                "px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-all",
                drawWidth === w ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container"
              )}
            >
              {w}px
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-outline-variant mx-0.5" />

        {/* Sync & Export */}
        <button 
          onClick={syncWorkspaceWithPeer} 
          className="px-2 py-1 rounded-lg text-[11px] font-extrabold text-on-primary-container bg-primary-container border border-primary/20 hover:bg-primary-container/80 flex items-center gap-1 transition-all"
          title="Sync drawing with peer"
        >
          <span className="material-symbols-outlined text-xs">sync</span> Sync
        </button>

        <button 
          onClick={downloadWhiteboard} 
          className="px-2 py-1 rounded-lg text-[11px] font-extrabold text-on-surface hover:bg-surface-container flex items-center gap-1 transition-all"
          title="Export Whiteboard as Image"
        >
          <span className="material-symbols-outlined text-xs">download</span> Save
        </button>

        <button onClick={clearBoard} className="text-[11px] font-extrabold text-on-surface-variant hover:text-alert-rose px-1 transition-colors">
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={beginDraw}
        onPointerMove={continueDraw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        className="h-full w-full touch-none cursor-crosshair bg-surface"
      />
    </div>
  );
}
