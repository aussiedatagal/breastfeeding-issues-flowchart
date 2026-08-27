import type { GraphNode } from "../../graph/types.ts";
import type { Placement } from "../../graph/layout.ts";

interface Props {
  placement: Placement;
  node: GraphNode;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** A full question or diagnosis card in the diagram. */
export function NodeShape({ placement, node, selected, onSelect }: Props) {
  const { x, y, w, h, lines } = placement;
  const isDiagnosis = node.kind === "diagnosis";
  const flag = isDiagnosis ? node.flag : undefined;

  const className = [
    "dm-node",
    isDiagnosis ? "dm-node--diagnosis" : "dm-node--question",
    flag ? `dm-node--flag-${flag}` : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const activate = () => onSelect(node.id);

  return (
    <g
      className={className}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${isDiagnosis ? "Diagnosis" : "Question"}: ${
        node.kind === "question" ? node.ask : node.name
      }`}
      onClick={(e) => {
        e.stopPropagation();
        activate();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
    >
      <rect className="dm-node__box" x={0} y={-h / 2} width={w} height={h} rx={4} />
      <text className="dm-node__kicker" x={14} y={-h / 2 + 14}>
        {isDiagnosis ? "DIAGNOSIS" : "QUESTION"}
      </text>
      <text className="dm-node__label" x={14} y={-h / 2 + 30}>
        {lines.map((line, i) => (
          <tspan key={i} x={14} dy={i === 0 ? 0 : 16}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
