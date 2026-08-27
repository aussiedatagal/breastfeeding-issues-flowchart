import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ROOT_ID, type Graph } from "../graph/types.ts";
import { computeLayout } from "../graph/layout.ts";
import type { Placement } from "../graph/layout.ts";
import { canonicalChain, expandAll } from "../graph/traversal.ts";
import { useDecisionState } from "../hooks/useDecisionState.ts";
import { usePanZoom } from "../hooks/usePanZoom.ts";
import { useAnimatedLayout } from "../hooks/useAnimatedLayout.ts";
import { useTheme } from "../hooks/useTheme.ts";
import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import { Toolbar } from "./Toolbar.tsx";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { FindingsTray } from "./FindingsTray.tsx";
import { Canvas } from "./Canvas.tsx";
import { DetailPanel } from "./DetailPanel.tsx";
import { Legend } from "./Legend.tsx";
import { ZoomControls } from "./ZoomControls.tsx";
import styles from "./DecisionMap.module.css";

const PANEL_WIDTH = 420;

export function DecisionMap({ graph }: { graph: Graph }) {
  const { open, selectedId, selected, path, findings, actions } = useDecisionState(graph);
  const panZoom = usePanZoom();
  const theme = useTheme();
  const compact = useMediaQuery("(max-width: 720px)");

  const targetLayout = useMemo(() => computeLayout(graph, open), [graph, open]);
  const layout = useAnimatedLayout(targetLayout);

  const activeIds = useMemo(
    () => new Set(canonicalChain(graph, selectedId).map((n) => n.id)),
    [graph, selectedId],
  );

  const [panelOpen, setPanelOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  const { fitTo, centerOn, ensureVisible } = panZoom;
  const inset = useMemo(
    () => (panelOpen && !compact ? { right: PANEL_WIDTH } : undefined),
    [panelOpen, compact],
  );

  // The node together with the row directly below it (its Yes/No stubs and any
  // opened child, or — for the root — the problem-area columns), framed as one.
  const groupOf = useCallback(
    (id: string) => {
      const p = targetLayout.byId.get(id);
      if (!p) return null;
      let minX = p.x;
      let maxX = p.x + p.w;
      let minY = p.y - p.h / 2;
      let maxY = p.y + p.h / 2;
      for (const q of targetLayout.placements) {
        const touches =
          q.parentId === id ||
          targetLayout.connectors.some((c) => c.fromId === id && c.toId === q.id);
        if (!touches) continue;
        minX = Math.min(minX, q.x);
        maxX = Math.max(maxX, q.x + q.w);
        minY = Math.min(minY, q.y - q.h / 2);
        maxY = Math.max(maxY, q.y + q.h / 2);
      }
      const w = Math.max(maxX - minX, 320);
      const h = Math.max(maxY - minY, 120);
      return {
        rect: { x: minX, y: minY, w, h },
        center: { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 },
        size: { w, h },
      };
    },
    [targetLayout],
  );

  const focusGroup = useCallback(
    (id: string, animate = true) => {
      const g = groupOf(id);
      if (!g) return;
      if (compact) {
        // keep the group in the strip above the bottom-sheet when it is open
        const bottom = panelOpen ? Math.min(window.innerHeight * 0.6, 420) : 0;
        centerOn(g.center, { fit: g.size, minK: 0.55, maxK: 1, animate, inset: { bottom } });
      } else {
        ensureVisible(g.rect, { inset, align: 0.5 });
      }
    },
    [groupOf, compact, panelOpen, centerOn, ensureVisible, inset],
  );

  // Open the panel on a deliberate node click, or when a path lands on a diagnosis.
  const openPanelFor = useCallback(
    (id: string) => {
      actions.select(id);
      setPanelOpen(true);
    },
    [actions],
  );
  useEffect(() => {
    if (selected?.kind === "diagnosis" && selected.depth >= 0) setPanelOpen(true);
  }, [selected]);

  // Show the picker on first load if nothing has been opened yet.
  const introShown = useRef(false);
  useEffect(() => {
    if (introShown.current) return;
    introShown.current = true;
    if (selectedId === ROOT_ID && open.size === 0) setPanelOpen(true);
  }, [selectedId, open.size]);

  // First paint: a readable view of the root / current group.
  const positioned = useRef(false);
  useEffect(() => {
    if (positioned.current) return;
    const g = groupOf(selectedId === ROOT_ID ? ROOT_ID : selectedId);
    if (!g) return;
    positioned.current = true;
    const place = () => centerOn(g.center, { fit: g.size, minK: 0.5, maxK: 1, animate: false });
    place();
    requestAnimationFrame(place); // once the SVG has real dimensions
  }, [selectedId, groupOf, centerOn]);

  // Follow the selection as the user moves through the graph.
  const prevSelected = useRef(selectedId);
  useEffect(() => {
    if (prevSelected.current === selectedId) return;
    prevSelected.current = selectedId;
    focusGroup(selectedId);
  }, [selectedId, focusGroup]);

  // When the panel opens, re-frame so the current group clears it.
  useEffect(() => {
    if (!panelOpen) return;
    if (compact) {
      const g = groupOf(selectedId);
      if (g)
        centerOn(g.center, {
          fit: g.size,
          minK: 0.55,
          maxK: 1,
          inset: { bottom: Math.min(window.innerHeight * 0.6, 420) },
        });
    } else {
      const g = groupOf(selectedId);
      if (g) ensureVisible(g.rect, { inset: { right: PANEL_WIDTH }, align: 0.5 });
    }
  }, [panelOpen, compact, selectedId, groupOf, ensureVisible, centerOn]);

  const onStubActivate = useCallback(
    (p: Placement) => {
      setHintDismissed(true);
      if (p.kind === "domain") actions.openDomain(p.nodeId);
      else if (p.merge) actions.goTo(p.nodeId);
      else if (p.parentId && p.answer) actions.answer(p.parentId, p.answer);
    },
    [actions],
  );

  const fitCurrent = useCallback(() => {
    fitTo(computeLayout(graph, open).bounds, { inset });
  }, [graph, open, fitTo, inset]);

  const onExpandAll = useCallback(() => {
    actions.expandEverything();
    setPanelOpen(false);
    requestAnimationFrame(() => fitTo(computeLayout(graph, expandAll(graph)).bounds));
  }, [actions, graph, fitTo]);

  const onRestart = useCallback(() => {
    actions.restart();
    setPanelOpen(true);
    requestAnimationFrame(() => focusGroup(ROOT_ID, false));
  }, [actions, focusGroup]);

  return (
    <div className={styles.app}>
      <Toolbar
        title={graph.title}
        {...(graph.subtitle !== undefined ? { subtitle: graph.subtitle } : {})}
        theme={theme.choice}
        compact={compact}
        onRestart={onRestart}
        onExpandAll={onExpandAll}
        onFit={fitCurrent}
        onToggleLegend={() => setLegendOpen((v) => !v)}
        onCycleTheme={theme.cycle}
      />
      <Breadcrumb
        path={path}
        selected={selected}
        onJump={(id) => {
          actions.rewindTo(id);
          setPanelOpen(false);
        }}
      />
      <FindingsTray
        graph={graph}
        findings={findings}
        onOpen={(id) => {
          actions.goTo(id);
          setPanelOpen(true);
        }}
        onRemove={actions.unpinFinding}
        onClear={actions.clearFindings}
      />
      <div className={styles.stage}>
        <Canvas
          graph={graph}
          layout={layout}
          selectedId={selectedId}
          activeIds={activeIds}
          panZoom={panZoom}
          onInspectNode={openPanelFor}
          onStubActivate={onStubActivate}
          onUndo={actions.undoAnswer}
          onBackground={() => {
            setPanelOpen(false);
            setLegendOpen(false);
          }}
        />
        <Legend open={legendOpen} onClose={() => setLegendOpen(false)} />
        <ZoomControls
          onZoomIn={() => panZoom.zoomBy(1.3)}
          onZoomOut={() => panZoom.zoomBy(1 / 1.3)}
        />
        {!hintDismissed && (
          <button
            type="button"
            className={styles.hint}
            onClick={() => setHintDismissed(true)}
            title="Dismiss"
          >
            Tap a <b>Yes</b> / <b>No</b> node to open that branch. Tap an edge label to undo. Drag
            to pan.
          </button>
        )}
        <DetailPanel
          graph={graph}
          node={selected}
          rootSelected={selectedId === ROOT_ID}
          path={path}
          openIds={open}
          findings={findings}
          isOpen={panelOpen && (selected !== null || selectedId === ROOT_ID)}
          compact={compact}
          onClose={() => setPanelOpen(false)}
          onAnswer={actions.answer}
          onGoTo={actions.goTo}
          onPin={actions.pinFinding}
          onUnpin={actions.unpinFinding}
          onToggleDomain={(entryId, willOpen) =>
            willOpen ? actions.openDomain(entryId) : actions.closeDomain(entryId)
          }
        />
      </div>
    </div>
  );
}
