import type { GraphNode } from "../../graph/types.ts";
import type { Placement } from "../../graph/layout.ts";

interface Props {
  placement: Placement;
  node: GraphNode | null;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** A full question or diagnosis card in the diagram. */
export function NodeShape({ placement, node, selected, onSelect }: Props) {
  const { x, y, w, h, lines } = placement;
  const isRoot = placement.kind === "root";
  const isDiagnosis = node?.kind === "diagnosis";
  const flag = isDiagnosis ? node.flag : undefined;

  const className = [
    "dm-node",
    isRoot ? "dm-node--root" : isDiagnosis ? "dm-node--diagnosis" : "dm-node--question",
    flag ? `dm-node--flag-${flag}` : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const targetId = isRoot || !node ? "__root__" : node.id;
  const kicker = isRoot
    ? "Start here"
    : placement.domainShort
      ? placement.domainShort
      : isDiagnosis
        ? "Working diagnosis"
        : "Question";
  const ariaLabel =
    isRoot || !node
      ? "Start: what is the dyad dealing with?"
      : `${node.kind === "diagnosis" ? "Diagnosis" : "Question"}: ${
          node.kind === "question" ? node.ask : node.name
        }`;

  const activate = () => onSelect(targetId);

  return (
    <g
      className={className}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={ariaLabel}
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
      <rect className="dm-node__box" x={0} y={-h / 2} width={w} height={h} rx={14} />
      <text className="dm-node__kicker" x={16} y={-h / 2 + 17}>
        {kicker}
      </text>
      <text className="dm-node__label" x={16} y={-h / 2 + 35}>
        {lines.map((line, i) => (
          <tspan key={i} x={16} dy={i === 0 ? 0 : 16}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
