import React, { useRef, useState, useEffect, useCallback } from 'react';
import { DrawStroke, DrawPoint } from '../types';
import {
  PenTool,
  Eraser,
  Trash2,
  Download,
  X,
  Palette,
  Undo2,
  Circle,
} from 'lucide-react';

interface WhiteboardModalProps {
  isOpen: boolean;
  strokes: DrawStroke[];
  onEmitStroke: (stroke: DrawStroke) => void;
  onClearWhiteboard: () => void;
  onClose: () => void;
}

const COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#ec4899', // pink
  '#eab308', // yellow
  '#ffffff', // white
];

const BRUSH_SIZES = [2, 4, 8, 14];

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  isOpen,
  strokes,
  onEmitStroke,
  onClearWhiteboard,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#10b981');
  const [currentWidth, setCurrentWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const currentPointsRef = useRef<DrawPoint[]>([]);

  // Redraw canvas on strokes change
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background to dark slate
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = 20; x < canvas.width; x += 24) {
      for (let y = 20; y < canvas.height; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.isEraser ? '#0b0f19' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes]);

  useEffect(() => {
    if (isOpen) {
      // Set canvas dimensions
      if (canvasRef.current) {
        canvasRef.current.width = 800;
        canvasRef.current.height = 550;
      }
      redrawCanvas();
    }
  }, [isOpen, redrawCanvas]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e);
    if (!pt) return;
    setIsDrawing(true);
    currentPointsRef.current = [pt];
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pt = getCanvasCoords(e);
    if (!pt) return;

    currentPointsRef.current.push(pt);

    // Render active local stroke
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = isEraser ? '#0b0f19' : currentColor;
    ctx.lineWidth = isEraser ? currentWidth * 3 : currentWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pts = currentPointsRef.current;
    if (pts.length >= 2) {
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPointsRef.current.length > 1) {
      const newStroke: DrawStroke = {
        id: `stroke_${Date.now()}_${Math.random()}`,
        points: [...currentPointsRef.current],
        color: currentColor,
        width: isEraser ? currentWidth * 3 : currentWidth,
        isEraser,
      };
      onEmitStroke(newStroke);
    }
    currentPointsRef.current = [];
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `incognito_whiteboard_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-[#090b10] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Collaborative Ephemeral Whiteboard</h3>
            <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
              Live Real-time Sync
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadCanvas}
              title="Save doodle as PNG"
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
            <button
              onClick={onClearWhiteboard}
              title="Clear Whiteboard for both peers"
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-slate-950 border-b border-slate-800">
          {/* Tool selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEraser(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                !isEraser
                  ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
                  : 'border-slate-800 text-slate-400 hover:bg-slate-900'
              }`}
            >
              <PenTool className="h-3.5 w-3.5" />
              <span>Pen</span>
            </button>
            <button
              onClick={() => setIsEraser(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                isEraser
                  ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                  : 'border-slate-800 text-slate-400 hover:bg-slate-900'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Eraser</span>
            </button>
          </div>

          {/* Colors */}
          {!isEraser && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 mr-1">Color:</span>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrentColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-6 w-6 rounded-full transition-transform cursor-pointer ${
                    currentColor === c ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Stroke Width */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1">Size:</span>
            {BRUSH_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setCurrentWidth(size)}
                className={`h-7 w-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                  currentWidth === size
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                    : 'border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: `${size + 2}px`, height: `${size + 2}px` }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="relative flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-auto">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="rounded-xl border border-slate-800 shadow-inner cursor-crosshair max-w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
};
