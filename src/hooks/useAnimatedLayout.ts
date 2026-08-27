import { useEffect, useRef, useState } from "react";
import type { Layout } from "../graph/layout.ts";

const DURATION = 280;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

interface Pos {
  x: number;
  y: number;
}

/**
 * Keeps the layout *structure* in sync with `target` immediately (so the right
 * nodes always render), while tweening each placement's position over ~280ms.
 * Entering placements grow out of their parent's last position. Honours
 * prefers-reduced-motion.
 */
export function useAnimatedLayout(target: Layout): Layout {
  const reduced = usePrefersReducedMotion();
  const known = useRef(new Map<string, Pos>());
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced) {
      known.current = new Map(target.placements.map((p) => [p.id, { x: p.x, y: p.y }]));
      rerender();
      return;
    }

    const from = new Map<string, Pos>();
    for (const p of target.placements) {
      const seen = known.current.get(p.id);
      const parentSeen = p.parentId ? known.current.get(p.parentId) : undefined;
      from.set(p.id, seen ?? parentSeen ?? { x: p.x, y: p.y });
    }
    const to = new Map(target.placements.map((p) => [p.id, { x: p.x, y: p.y }]));
    const start = performance.now();

    const tick = (now: number) => {
      const e = easeInOut(Math.min(1, (now - start) / DURATION));
      const next = new Map<string, Pos>();
      for (const p of target.placements) {
        const a = from.get(p.id)!;
        const b = to.get(p.id)!;
        next.set(p.id, { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e });
      }
      known.current = next;
      rerender();
      if (e < 1) raf.current = requestAnimationFrame(tick);
    };
    // seed positions synchronously so structure never lags the rAF loop
    tick(start);
    return () => cancelAnimationFrame(raf.current);
  }, [target, reduced]);

  const placements = target.placements.map((p) => {
    const pos = known.current.get(p.id) ?? { x: p.x, y: p.y };
    return { ...p, x: pos.x, y: pos.y };
  });
  return { ...target, placements, byId: new Map(placements.map((p) => [p.id, p])) };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useEffect(() => {
    const mq = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
