import { NODE_W } from "../../graph/layout.ts";
import type { Layout, Placement } from "../../graph/layout.ts";
import type { Answer } from "../../graph/types.ts";

interface Props {
  layout: Layout;
  activeIds: ReadonlySet<string>;
  onUndo: (questionId: string, answer: Answer) => void;
}

function anchorRight(p: Placement) {
  return { x: p.x + (p.kind === "stub" ? p.w : NODE_W), y: p.y };
}
function anchorLeft(p: Placement) {
  return { x: p.x, y: p.y };
}
function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

export function Connectors({ layout, activeIds, onUndo }: Props) {
  const links: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];

  for (const c of layout.connectors) {
    const from = layout.byId.get(c.fromId);
    const to = layout.byId.get(c.toId);
    if (!from || !to) continue;

    const a = anchorRight(from);
    const b = anchorLeft(to);
    const active = c.kind === "canonical" && activeIds.has(c.fromId) && activeIds.has(to.nodeId);

    links.push(
      <path
        key={c.id}
        className={[
          "dm-link",
          c.kind === "stub" ? "dm-link--stub" : "",
          c.kind === "merge" ? "dm-link--merge" : "",
          c.kind === "domain" ? "dm-link--domain" : "",
          active ? "dm-link--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        d={curve(a, b)}
      />,
    );

    // an opened branch carries its answer on the edge; click to fold it back
    if (c.kind === "canonical" && c.answer) {
      const answer = c.answer;
      const lx = a.x + (b.x - a.x) * 0.5;
      const ly = a.y + (b.y - a.y) * 0.5;
      const text = answer === "yes" ? "YES" : "NO";
      const width = answer === "yes" ? 30 : 24;
      labels.push(
        <g
          key={`${c.id}-label`}
          className={`dm-elabel dm-elabel--${answer}`}
          transform={`translate(${lx} ${ly})`}
          role="button"
          tabIndex={0}
          aria-label={`Undo the "${answer}" answer at this question`}
          onClick={(e) => {
            e.stopPropagation();
            onUndo(c.fromId, answer);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onUndo(c.fromId, answer);
            }
          }}
        >
          <rect className="dm-elabel__bg" x={-width / 2} y={-9} width={width} height={18} rx={4} />
          <text
            className="dm-elabel__text"
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {text}
          </text>
        </g>,
      );
    }
  }

  return (
    <g>
      <g>{links}</g>
      <g>{labels}</g>
    </g>
  );
}
