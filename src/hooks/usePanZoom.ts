import { useCallback, useEffect, useRef, useState } from "react";

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

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Inset {
  right?: number;
  bottom?: number;
}

const MIN_K = 0.18;
const MAX_K = 2.4;
const DRAG_THRESHOLD = 4;
const TWEEN_MS = 260;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Pan (drag) and zoom (wheel/pinch, about the cursor) for an SVG viewport group.
 * Direct gestures update immediately; programmatic moves (fit / center / zoom
 * buttons) tween. Pointer capture is taken only once a drag actually starts, so
 * taps on child nodes still register.
 */
export function usePanZoom(initial: Viewport = { x: 0, y: 0, k: 1 }) {
  const [viewport, setViewport] = useState<Viewport>(initial);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const view = useRef(initial);
  view.current = viewport;

  const gesture = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    pointerId: number;
    dragging: boolean;
  } | null>(null);
  const draggedRef = useRef(false);
  const tweenId = useRef(0);
  const reduced = useRef(
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  const stopTween = () => cancelAnimationFrame(tweenId.current);

  const glideTo = useCallback((next: Viewport, animate = true) => {
    stopTween();
    if (!animate || reduced.current) {
      setViewport(next);
      return;
    }
    const from = view.current;
    const start = performance.now();
    const frame = (now: number) => {
      const t = easeInOut(Math.min(1, (now - start) / TWEEN_MS));
      setViewport({
        x: lerp(from.x, next.x, t),
        y: lerp(from.y, next.y, t),
        k: lerp(from.k, next.k, t),
      });
      if (t < 1) tweenId.current = requestAnimationFrame(frame);
    };
    tweenId.current = requestAnimationFrame(frame);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopTween();
    draggedRef.current = false;
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      pointerId: e.pointerId,
      dragging: false,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.dragging) {
      const moved = Math.abs(e.clientX - g.startX) + Math.abs(e.clientY - g.startY);
      if (moved < DRAG_THRESHOLD) return;
      g.dragging = true;
      draggedRef.current = true;
      try {
        e.currentTarget.setPointerCapture(g.pointerId);
      } catch {
        /* capture unavailable */
      }
    }
    const dx = e.clientX - g.lastX;
    const dy = e.clientY - g.lastY;
    g.lastX = e.clientX;
    g.lastY = e.clientY;
    setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, []);

  const endGesture = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (g?.dragging) {
      try {
        e.currentTarget.releasePointerCapture(g.pointerId);
      } catch {
        /* already released */
      }
    }
    gesture.current = null;
  }, []);

  // Native wheel listener: React binds onWheel passively, so preventDefault there is a no-op.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopTween();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setViewport((v) => {
        const k = clampK(v.k * Math.exp(-e.deltaY * 0.0015));
        const scale = k / v.k;
        return { k, x: px - (px - v.x) * scale, y: py - (py - v.y) * scale };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => () => stopTween(), []);

  /** true when the last pointer sequence was a drag — callers ignore the trailing click. */
  const consumedDrag = useCallback(() => draggedRef.current, []);

  const rectOf = () => svgRef.current?.getBoundingClientRect() ?? null;

  const fitTo = useCallback(
    (bounds: Bounds, opts?: { padding?: number; inset?: Inset; animate?: boolean }) => {
      const rect = rectOf();
      if (!rect) return;
      const pad = opts?.padding ?? 40;
      const availW = rect.width - (opts?.inset?.right ?? 0) - pad * 2;
      const availH = rect.height - pad * 2;
      const w = bounds.maxX - bounds.minX;
      const h = bounds.maxY - bounds.minY;
      if (w <= 0 || h <= 0 || availW <= 0 || availH <= 0) return;
      const k = clampK(Math.min(availW / w, availH / h, 1.05));
      glideTo(
        {
          k,
          x: pad + (availW - w * k) / 2 - bounds.minX * k,
          y: pad + (availH - h * k) / 2 - bounds.minY * k,
        },
        opts?.animate,
      );
    },
    [glideTo],
  );

  const centerOn = useCallback(
    (
      point: { x: number; y: number },
      opts?: {
        minK?: number;
        maxK?: number;
        inset?: Inset;
        animate?: boolean;
        /** if given, zoom so this world-size region fits the available viewport */
        fit?: { w: number; h: number };
      },
    ) => {
      const rect = rectOf();
      if (!rect) return;
      const availW = rect.width - (opts?.inset?.right ?? 0);
      const availH = rect.height - (opts?.inset?.bottom ?? 0);
      const cx = availW / 2;
      const cy = availH / 2;
      let k = Math.max(view.current.k, opts?.minK ?? 0.7);
      if (opts?.fit) {
        const pad = 32;
        k = Math.min(
          (availW - pad * 2) / opts.fit.w,
          (availH - pad * 2) / opts.fit.h,
          opts?.maxK ?? 1.15,
        );
      }
      k = Math.min(Math.max(k, opts?.minK ?? 0.5), opts?.maxK ?? 1.15);
      glideTo({ k, x: cx - point.x * k, y: cy - point.y * k }, opts?.animate);
    },
    [glideTo],
  );

  /** Pan (keeping zoom) only if `rect` isn't comfortably in view. */
  const ensureVisible = useCallback(
    (rect: WorldRect, opts?: { inset?: Inset; align?: number }) => {
      const vp = rectOf();
      if (!vp) return;
      const v = view.current;
      const insetR = opts?.inset?.right ?? 0;
      const margin = 44;
      const sx = rect.x * v.k + v.x;
      const sy = rect.y * v.k + v.y;
      const sw = rect.w * v.k;
      const sh = rect.h * v.k;
      const left = margin;
      const right = vp.width - insetR - margin;
      if (sx >= left && sx + sw <= right && sy >= margin && sy + sh <= vp.height - margin) return;
      const align = opts?.align ?? 0.42;
      const span = Math.max(0, right - left - sw);
      const targetX = left + span * align;
      glideTo({
        ...v,
        x: targetX - rect.x * v.k,
        y: vp.height / 2 - (rect.y + rect.h / 2) * v.k,
      });
    },
    [glideTo],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const rect = rectOf();
      if (!rect) return;
      const px = rect.width / 2;
      const py = rect.height / 2;
      const v = view.current;
      const k = clampK(v.k * factor);
      const scale = k / v.k;
      glideTo({ k, x: px - (px - v.x) * scale, y: py - (py - v.y) * scale });
    },
    [glideTo],
  );

  return {
    viewport,
    svgRef,
    transform: `translate(${viewport.x} ${viewport.y}) scale(${viewport.k})`,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endGesture,
      onPointerCancel: endGesture,
    },
    consumedDrag,
    fitTo,
    centerOn,
    ensureVisible,
    zoomBy,
  };
}
