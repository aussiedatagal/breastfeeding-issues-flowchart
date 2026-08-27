import { useCallback, useRef, useState } from "react";

export interface Viewport {
  x: number;
  y: number;
  k: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MIN_K = 0.2;
const MAX_K = 2.4;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

/**
 * Drag-to-pan, wheel-to-zoom (about the cursor) for an SVG viewport group.
 * Attach `handlers` to the <svg>; apply `transform` to the inner <g>.
 */
export function usePanZoom(initial: Viewport = { x: 0, y: 0, k: 1 }) {
  const [viewport, setViewport] = useState<Viewport>(initial);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    d.x = e.clientX;
    d.y = e.clientY;
    setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
    drag.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setViewport((v) => {
      const k = clampK(v.k * Math.exp(-e.deltaY * 0.0015));
      const scale = k / v.k;
      return { k, x: px - (px - v.x) * scale, y: py - (py - v.y) * scale };
    });
  }, []);

  /** true if the last pointer sequence was a real drag (so callers can ignore the click). */
  const consumedDrag = useCallback(() => (drag.current?.moved ?? 0) > 6, []);

  const fitTo = useCallback((bounds: Bounds, pad = 48) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    if (w <= 0 || h <= 0) return;
    const k = clampK(Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h, 1.1));
    setViewport({
      k,
      x: pad + (rect.width - pad * 2 - w * k) / 2 - bounds.minX * k,
      y: pad + (rect.height - pad * 2 - h * k) / 2 - bounds.minY * k,
    });
  }, []);

  const centerOn = useCallback((point: { x: number; y: number }, minK = 0.8) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setViewport((v) => {
      const k = Math.max(v.k, minK);
      return { k, x: rect.width * 0.4 - point.x * k, y: rect.height / 2 - point.y * k };
    });
  }, []);

  return {
    viewport,
    svgRef,
    transform: `translate(${viewport.x} ${viewport.y}) scale(${viewport.k})`,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onWheel,
    },
    consumedDrag,
    fitTo,
    centerOn,
  };
}
