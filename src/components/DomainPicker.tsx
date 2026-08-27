import type { Graph } from "../graph/types.ts";
import { domainOf } from "../graph/types.ts";
import styles from "./DomainPicker.module.css";

interface Props {
  graph: Graph;
  openIds: ReadonlySet<string>;
  findings: string[];
  onToggle: (entryId: string, open: boolean) => void;
  onGoToDomain: (entryId: string) => void;
}

export function DomainPicker({ graph, openIds, findings, onToggle, onGoToDomain }: Props) {
  const findingsByDomain = new Map<string, number>();
  for (const id of findings) {
    const d = domainOf(graph, id);
    if (d) findingsByDomain.set(d.id, (findingsByDomain.get(d.id) ?? 0) + 1);
  }

  return (
    <div className={styles.picker}>
      <p className={styles.prompt}>{graph.rootPrompt}</p>
      <ul className={styles.list}>
        {graph.domains.map((d) => {
          const isOpen = openIds.has(d.entry);
          const count = findingsByDomain.get(d.id) ?? 0;
          return (
            <li key={d.id} className={styles.item} data-open={isOpen}>
              <button
                className={styles.label}
                onClick={() => (isOpen ? onGoToDomain(d.entry) : onToggle(d.entry, true))}
              >
                <span className={styles.state} aria-hidden="true">
                  {isOpen ? "✓" : "+"}
                </span>
                <span>{d.label}</span>
                {count > 0 && (
                  <span className={styles.count}>
                    {count} finding{count > 1 ? "s" : ""}
                  </span>
                )}
              </button>
              {isOpen && (
                <button
                  className={styles.remove}
                  onClick={() => onToggle(d.entry, false)}
                  aria-label={`Close ${d.label}`}
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.hint}>
        Each area is worked on its own; findings from all of them build one problem list.
      </p>
    </div>
  );
}
