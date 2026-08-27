import type { Graph } from "../graph/types.ts";
import { isDiagnosis } from "../graph/types.ts";
import styles from "./FindingsTray.module.css";

interface Props {
  graph: Graph;
  findings: string[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

/**
 * The running problem list. A parent often has more than one contributing factor at play;
 * you pin each one as you find it, then rewind and work another branch.
 */
export function FindingsTray({ graph, findings, onOpen, onRemove, onClear }: Props) {
  if (findings.length === 0) return null;
  return (
    <div className={styles.tray} role="region" aria-label={`Findings (${findings.length})`}>
      <span className={styles.lead}>Findings</span>
      {findings.map((id) => {
        const node = graph.nodes.get(id);
        if (!node || !isDiagnosis(node)) return null;
        return (
          <span className={styles.chip} key={id}>
            <span className={styles.dot} data-flag={node.flag ?? ""} />
            <button className={styles.name} onClick={() => onOpen(id)}>
              {node.short}
            </button>
            <button
              className={styles.remove}
              onClick={() => onRemove(id)}
              aria-label={`Remove ${node.short} from findings`}
            >
              ×
            </button>
          </span>
        );
      })}
      {findings.length > 1 && (
        <button className={styles.clear} onClick={onClear}>
          clear
        </button>
      )}
    </div>
  );
}
