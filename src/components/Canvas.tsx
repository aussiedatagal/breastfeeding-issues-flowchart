import { useRef } from "react";
import type { Graph } from "../graph/types.ts";
import type { Layout, Placement } from "../graph/layout.ts";
import type { Answer } from "../graph/types.ts";
import type { usePanZoom } from "../hooks/usePanZoom.ts";
import { NodeShape } from "./nodes/NodeShape.tsx";
import { StubShape } from "./nodes/StubShape.tsx";
import { Connectors } from "./edges/Connectors.tsx";
import "./map.css";

interface Props {
  graph: Graph;
  layout: Layout;
  selectedId: string;
  activeIds: ReadonlySet<string>;
  panZoom: ReturnType<typeof usePanZoom>;
  onSelectNode: (id: string) => void;
  onStubActivate: (placement: Placement) => void;
  onUndo: (questionId: string, answer: Answer) => void;
  onBackground: () => void;
}

export function Canvas({
  graph,
  layout,
  selectedId,
  activeIds,
  panZoom,
  onSelectNode,
  onStubActivate,
  onUndo,
  onBackground,
}: Props) {
  const panning = useRef(false);

  return (
    <svg
      ref={panZoom.svgRef}
      className={`dm-canvas${panning.current ? " is-panning" : ""}`}
      {...panZoom.handlers}
      onPointerDown={(e) => {
        panning.current = true;
        panZoom.handlers.onPointerDown(e);
      }}
      onPointerUp={(e) => {
        panning.current = false;
        panZoom.handlers.onPointerUp(e);
      }}
      onClick={() => {
        if (!panZoom.consumedDrag()) onBackground();
      }}
    >
      <g transform={panZoom.transform}>
        <Connectors layout={layout} activeIds={activeIds} onUndo={onUndo} />
        {layout.placements.map((p) => {
          if (p.kind === "stub") {
            return <StubShape key={p.id} placement={p} onActivate={onStubActivate} />;
          }
          const node = graph.nodes.get(p.nodeId);
          if (!node) return null;
          return (
            <NodeShape
              key={p.id}
              placement={p}
              node={node}
              selected={p.nodeId === selectedId}
              onSelect={onSelectNode}
            />
          );
        })}
      </g>
    </svg>
  );
}
