import type { GraphNode } from "../graph/types.ts";
import { isDiagnosis } from "../graph/types.ts";
import type { PathStep } from "../graph/traversal.ts";
import styles from "./Breadcrumb.module.css";

interface Props {
  path: PathStep[];
  selected: GraphNode | null;
  onJump: (questionId: string) => void;
}

export function Breadcrumb({ path, selected, onJump }: Props) {
  if (path.length === 0) return null;
  return (
    <nav className={styles.bar} aria-label="Answers so far">
      <span className={styles.lead}>Path</span>
      {path.map((step, i) => (
        <button key={i} className={styles.crumb} onClick={() => onJump(step.question.id)}>
          {step.question.short} <b>{step.answer}</b>
        </button>
      ))}
      {selected && isDiagnosis(selected) && (
        <span className={styles.terminal}>{selected.short}</span>
      )}
    </nav>
  );
}
