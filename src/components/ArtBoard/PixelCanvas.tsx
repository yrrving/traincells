import React, { useRef, useEffect, useCallback } from 'react';
import { ART_SIZE } from '../../models/types';
import type { DrawTool } from '../../models/types';

const CELL_PX = 32; // Internal canvas pixels per art pixel
const CANVAS_PX = ART_SIZE * CELL_PX; // 13 * 32 = 416

interface Props {
  pixels: string[];
  tool: DrawTool;
  selectedColor: string;
  onDraw: (index: number, color: string) => void;
  onFill: (index: number, color: string) => void;
  onEyedropper: (color: string) => void;
}

export const PixelCanvas: React.FC<Props> = ({
  pixels,
  tool,
  selectedColor,
  onDraw,
  onFill,
  onEyedropper,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastIndex = useRef<number>(-1);

  // ── Render ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Checkerboard background (shows transparency)
    for (let py = 0; py < ART_SIZE; py++) {
      for (let px = 0; px < ART_SIZE; px++) {
        const checker = (px + py) % 2 === 0;
        ctx.fillStyle = checker ? '#2a2848' : '#1e1c38';
        ctx.fillRect(px * CELL_PX, py * CELL_PX, CELL_PX, CELL_PX);
      }
    }

    // Draw pixels
    for (let i = 0; i < pixels.length; i++) {
      const color = pixels[i];
      if (!color) continue;
      const px = i % ART_SIZE;
      const py = Math.floor(i / ART_SIZE);
      ctx.fillStyle = color;
      ctx.fillRect(px * CELL_PX, py * CELL_PX, CELL_PX, CELL_PX);
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= ART_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_PX, 0);
      ctx.lineTo(i * CELL_PX, CANVAS_PX);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_PX);
      ctx.lineTo(CANVAS_PX, i * CELL_PX);
      ctx.stroke();
    }
  }, [pixels]);

  // ── Coordinate helpers ───────────────────────────────────────────────────────
  const getIndex = useCallback(
    (clientX: number, clientY: number): number | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_PX / rect.width;
      const scaleY = CANVAS_PX / rect.height;
      const px = Math.floor(((clientX - rect.left) * scaleX) / CELL_PX);
      const py = Math.floor(((clientY - rect.top) * scaleY) / CELL_PX);
      if (px < 0 || px >= ART_SIZE || py < 0 || py >= ART_SIZE) return null;
      return py * ART_SIZE + px;
    },
    []
  );

  const handleDraw = useCallback(
    (idx: number) => {
      if (idx === lastIndex.current) return;
      lastIndex.current = idx;
      if (tool === 'pen') onDraw(idx, selectedColor);
      else if (tool === 'eraser') onDraw(idx, '');
      else if (tool === 'eyedropper') {
        const c = pixels[idx];
        if (c) onEyedropper(c);
      }
    },
    [tool, selectedColor, pixels, onDraw, onEyedropper]
  );

  // ── Mouse Events ─────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const idx = getIndex(e.clientX, e.clientY);
    if (idx === null) return;
    if (tool === 'fill') {
      onFill(idx, selectedColor);
      return;
    }
    isDrawing.current = true;
    lastIndex.current = -1;
    handleDraw(idx);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    const idx = getIndex(e.clientX, e.clientY);
    if (idx !== null) handleDraw(idx);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    lastIndex.current = -1;
  };

  // ── Touch Events ─────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const idx = getIndex(touch.clientX, touch.clientY);
    if (idx === null) return;
    if (tool === 'fill') {
      onFill(idx, selectedColor);
      return;
    }
    isDrawing.current = true;
    lastIndex.current = -1;
    handleDraw(idx);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const touch = e.touches[0];
    const idx = getIndex(touch.clientX, touch.clientY);
    if (idx !== null) handleDraw(idx);
  };

  const onTouchEnd = () => {
    isDrawing.current = false;
    lastIndex.current = -1;
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_PX}
      height={CANVAS_PX}
      className="draw-canvas"
      style={{
        width: '100%',
        maxWidth: CANVAS_PX,
        aspectRatio: '1',
        borderRadius: 8,
        cursor:
          tool === 'eyedropper' ? 'crosshair' :
          tool === 'fill' ? 'cell' :
          tool === 'eraser' ? 'cell' :
          'crosshair',
        imageRendering: 'pixelated',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    />
  );
};
