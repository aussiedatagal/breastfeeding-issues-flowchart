import type { Placement } from "../../graph/layout.ts";

interface Props {
  placement: Placement;
  onActivate: (placement: Placement) => void;
}

/** A small "Yes" / "No" pill for a branch that has not been opened yet. */
export function StubShape({ placement, onActivate }: Props) {
  const { x, y, w, h, answer, merge } = placement;
  const label = (answer === "yes" ? "Yes" : "No") + (merge ? " ↗" : "");

  const className = [
    "dm-stub",
    answer === "yes" ? "dm-stub--yes" : "dm-stub--no",
    merge ? "dm-stub--merge" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <g
      className={className}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={
        merge ? `${label}, jump to shared step` : `Answer ${answer} and open the next question`
      }
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
      <text
        className="dm-stub__label"
        x={w / 2}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}
