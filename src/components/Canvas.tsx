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
  onInspectNode: (id: string) => void;
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
  onInspectNode,
  onStubActivate,
  onUndo,
  onBackground,
}: Props) {
  return (
    <svg
      ref={panZoom.svgRef}
      className="dm-canvas"
      role="application"
      aria-roledescription="decision map"
      aria-label="Breastfeeding difficulty decision map. Pan by dragging, zoom with the scroll wheel."
      {...panZoom.handlers}
      onClick={() => {
        if (!panZoom.consumedDrag()) onBackground();
      }}
    >
      <title>Breastfeeding difficulty decision map</title>
      <g transform={panZoom.transform}>
        <Connectors layout={layout} activeIds={activeIds} onUndo={onUndo} />
        {layout.placements.map((p) => {
          if (p.kind === "stub" || p.kind === "domain") {
            const parent = p.parentId ? graph.nodes.get(p.parentId) : undefined;
            return (
              <StubShape
                key={p.id}
                placement={p}
                parentLabel={parent?.short ?? "this question"}
                onActivate={onStubActivate}
              />
            );
          }
          if (p.kind === "root") {
            return (
              <NodeShape
                key={p.id}
                placement={p}
                node={null}
                selected={selectedId === "__root__"}
                onSelect={onInspectNode}
              />
            );
          }
          const node = graph.nodes.get(p.nodeId);
          if (!node) return null;
          return (
            <NodeShape
              key={p.id}
              placement={p}
              node={node}
              selected={p.nodeId === selectedId}
              onSelect={onInspectNode}
            />
          );
        })}
      </g>
    </svg>
  );
}
