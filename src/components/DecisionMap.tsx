import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Graph } from "../graph/types.ts";
import { computeLayout } from "../graph/layout.ts";
import type { Placement } from "../graph/layout.ts";
import { canonicalChain } from "../graph/traversal.ts";
import { useDecisionState } from "../hooks/useDecisionState.ts";
import { usePanZoom } from "../hooks/usePanZoom.ts";
import { useAnimatedLayout } from "../hooks/useAnimatedLayout.ts";
import { useTheme } from "../hooks/useTheme.ts";
import { Toolbar } from "./Toolbar.tsx";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { Canvas } from "./Canvas.tsx";
import { DetailPanel } from "./DetailPanel.tsx";
import { Legend } from "./Legend.tsx";
import styles from "./DecisionMap.module.css";

export function DecisionMap({ graph }: { graph: Graph }) {
  const { open, selectedId, selected, path, actions } = useDecisionState(graph);
  const panZoom = usePanZoom();
  const theme = useTheme();

  const targetLayout = useMemo(() => computeLayout(graph, open), [graph, open]);
  const layout = useAnimatedLayout(targetLayout);

  const activeIds = useMemo(
    () => new Set(canonicalChain(graph, selectedId).map((n) => n.id)),
    [graph, selectedId],
  );

  const [panelOpen, setPanelOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => setPanelOpen(true), [selectedId]);
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 6500);
    return () => clearTimeout(t);
  }, []);

  const { fitTo, centerOn } = panZoom;
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      fitTo(targetLayout.bounds);
      return;
    }
    const spot = targetLayout.byId.get(selectedId);
    if (spot) centerOn({ x: spot.x + spot.w / 2, y: spot.y });
  }, [selectedId, targetLayout, fitTo, centerOn]);

  const onStubActivate = useCallback(
    (p: Placement) => {
      if (p.merge) actions.goTo(p.nodeId);
      else if (p.parentId && p.answer) actions.answer(p.parentId, p.answer);
    },
    [actions],
  );

  const fitAll = useCallback(() => {
    panZoom.fitTo(computeLayout(graph, open).bounds);
  }, [graph, open, panZoom]);

  return (
    <div className={styles.app}>
      <Toolbar
        title={graph.title}
        {...(graph.subtitle !== undefined ? { subtitle: graph.subtitle } : {})}
        theme={theme.choice}
        onRestart={() => {
          actions.restart();
          setTimeout(() => panZoom.fitTo(computeLayout(graph, new Set([graph.entry])).bounds), 60);
        }}
        onExpandAll={() => {
          actions.expandEverything();
          setPanelOpen(false);
        }}
        onFit={fitAll}
        onToggleLegend={() => setLegendOpen((v) => !v)}
        onCycleTheme={theme.cycle}
      />
      <Breadcrumb path={path} selected={selected} onJump={actions.goTo} />
      <div className={styles.stage}>
        <Canvas
          graph={graph}
          layout={layout}
          selectedId={selectedId}
          activeIds={activeIds}
          panZoom={panZoom}
          onSelectNode={actions.select}
          onStubActivate={onStubActivate}
          onUndo={actions.undoAnswer}
          onBackground={() => setPanelOpen(false)}
        />
        <Legend open={legendOpen} />
        <p className={styles.hint} style={{ opacity: hintVisible ? 1 : 0 }}>
          tap a Yes / No node · tap an edge label to undo · drag to pan, scroll to zoom
        </p>
      </div>
      <DetailPanel
        graph={graph}
        node={selected}
        path={path}
        openIds={open}
        isOpen={panelOpen && selected !== null}
        onClose={() => setPanelOpen(false)}
        onAnswer={actions.answer}
        onGoTo={actions.goTo}
      />
    </div>
  );
}
