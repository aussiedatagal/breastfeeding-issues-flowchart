import type { Placement } from "../../graph/layout.ts";

interface Props {
  placement: Placement;
  parentLabel: string;
  onActivate: (placement: Placement) => void;
}

/**
 * A small clickable pill: a "Yes" / "No" branch that hasn't been opened, or a
 * problem-area chip hanging off the root.
 */
export function StubShape({ placement, parentLabel, onActivate }: Props) {
  const { x, y, w, h, answer, merge, lines } = placement;
  const isDomain = placement.kind === "domain";

  const label = isDomain
    ? (placement.domainLabel ?? "Area")
    : (answer === "yes" ? "Yes" : "No") + (merge ? " ↗" : "");

  const className = [
    "dm-stub",
    isDomain ? "dm-stub--domain" : answer === "yes" ? "dm-stub--yes" : "dm-stub--no",
    merge ? "dm-stub--merge" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ariaLabel = isDomain
    ? `Open the "${label}" area`
    : merge
      ? `Answer ${answer} to "${parentLabel}" — jumps to a shared step`
      : `Answer ${answer} and open the next question after "${parentLabel}"`;

  return (
    <g
      className={className}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onActivate(placement);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(placement);
        }
      }}
    >
      <rect className="dm-stub__box" x={0} y={-h / 2} width={w} height={h} rx={4} />
      {isDomain ? (
        <text
          className="dm-stub__label"
          x={14}
          y={-((lines.length - 1) * 8)}
          dominantBaseline="central"
        >
          {lines.map((line, i) => (
            <tspan key={i} x={14} dy={i === 0 ? 0 : 16}>
              {i === 0 && <tspan className="dm-stub__plus">＋ </tspan>}
              {line}
            </tspan>
          ))}
        </text>
      ) : (
        <text
          className="dm-stub__label"
          x={w / 2}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      )}
    </g>
  );
}
