import { useEffect, useRef } from "react";
import type { Answer, Graph, GraphNode } from "../graph/types.ts";
import { isQuestion } from "../graph/types.ts";
import type { PathStep } from "../graph/traversal.ts";
import styles from "./DetailPanel.module.css";

const FLAG_LABEL: Record<string, string> = {
  "do-not-miss": "Do not miss",
  "likely-normal": "Likely normal",
  "often-mislabelled": "Commonly mislabelled",
};

interface Props {
  graph: Graph;
  node: GraphNode | null;
  path: PathStep[];
  openIds: ReadonlySet<string>;
  isOpen: boolean;
  compact: boolean;
  onClose: () => void;
  onAnswer: (questionId: string, choice: Answer) => void;
  onGoTo: (nodeId: string) => void;
}

export function DetailPanel({ isOpen, onClose, compact, ...rest }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, rest.node?.id]);

  return (
    <>
      {/* Modal backdrop only for the mobile bottom sheet; on desktop the drawer
          is non-modal so the map and breadcrumb stay usable. */}
      {compact && <div className={styles.scrim} data-open={isOpen} onClick={onClose} />}
      <aside
        className={styles.panel}
        data-open={isOpen}
        data-compact={compact}
        aria-label="Details"
        inert={!isOpen}
      >
        {rest.node && (
          <PanelContent {...rest} onClose={onClose} node={rest.node} closeRef={closeRef} />
        )}
      </aside>
    </>
  );
}

function PanelContent({
  graph,
  node,
  path,
  openIds,
  onClose,
  onAnswer,
  onGoTo,
  closeRef,
}: Omit<Props, "isOpen" | "compact"> & {
  node: GraphNode;
  closeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const question = isQuestion(node);
  const mergeParents = node.parents.filter((p) => p.merge);

  return (
    <>
      <div className={styles.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className={styles.kicker}>
            {node.id === graph.entry ? "Start here" : question ? "Question" : "Working diagnosis"}
          </p>
          <h2 className={styles.title}>{question ? node.ask : node.name}</h2>
          {!question && node.flag && (
            <span className={styles.badge} data-flag={node.flag}>
              {FLAG_LABEL[node.flag]}
            </span>
          )}
        </div>
        <button
          ref={closeRef}
          className={styles.close}
          onClick={onClose}
          aria-label="Close details"
        >
          ×
        </button>
      </div>

      <div className={styles.body}>
        {question ? (
          <>
            <div className={styles.choices}>
              {(["yes", "no"] as const).map((choice) => {
                const edge = node.edges[choice];
                const chosen = !edge.merge && openIds.has(edge.to);
                return (
                  <button
                    key={choice}
                    data-yes={choice === "yes"}
                    aria-pressed={chosen}
                    onClick={() => onAnswer(node.id, choice)}
                  >
                    {choice === "yes" ? "Yes" : "No"}
                  </button>
                );
              })}
            </div>
            <p className={styles.note}>
              …or tap the <b>Yes</b> / <b>No</b> node on the map. Once a branch is open its answer
              sits on the edge — tap that to undo it.
            </p>
            {node.assess && (
              <>
                <h3>How to assess</h3>
                <p className={styles.assess}>{node.assess}</p>
              </>
            )}
          </>
        ) : (
          <>
            {path.length > 0 && (
              <>
                <h3>Path taken</h3>
                <p className={styles.pathline}>
                  {path.map((step, i) => (
                    <span key={i}>
                      {i > 0 && "  ›  "}
                      {step.question.short} — <b>{step.answer}</b>
                    </span>
                  ))}
                </p>
              </>
            )}
            {node.note && <p className={styles.note}>{node.note}</p>}
            <List title="What points to it" items={node.points} />
            <List title="First steps for the feeding problem" items={node.steps} />
          </>
        )}

        {mergeParents.length > 0 && (
          <>
            <h3>Also reached from</h3>
            <ul>
              {mergeParents.map((p, i) => {
                const from = graph.nodes.get(p.from);
                return (
                  <li key={i}>
                    {from?.short ?? p.from} — {p.answer}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {!question && node.seeAlso.length > 0 && (
          <>
            <h3>Related</h3>
            <div className={styles.chips}>
              {node.seeAlso.map((id) => {
                const target = graph.nodes.get(id);
                if (!target) return null;
                return (
                  <button key={id} className={styles.chip} onClick={() => onGoTo(id)}>
                    {target.kind === "question" ? target.short : target.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3>{title}</h3>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </>
  );
}
