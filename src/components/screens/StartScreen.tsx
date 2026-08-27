import type { Graph } from "../../graph/types.ts";
import styles from "./StartScreen.module.css";

interface Props {
  graph: Graph;
  findingsCount: number;
  onPickArea: (areaId: string) => void;
  onOpenSummary: () => void;
}

export function StartScreen({ graph, findingsCount, onPickArea, onOpenSummary }: Props) {
  return (
    <section>
      <p className={styles.kicker}>Breastfeeding difficulty</p>
      <h1 className={styles.title}>Where is the problem showing up?</h1>
      <p className={styles.lede}>{graph.rootPrompt}</p>

      <ul className={styles.areas}>
        {graph.domains.map((d) => (
          <li key={d.id}>
            <button type="button" className={styles.area} onClick={() => onPickArea(d.id)}>
              <span className={styles.areaText}>
                <span className={styles.areaName}>{d.short ?? d.label}</span>
                <span className={styles.areaHint}>{d.label}</span>
              </span>
              <span className={styles.go} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {findingsCount > 0 && (
        <button type="button" className={styles.findingsLink} onClick={onOpenSummary}>
          Your findings so far ({findingsCount}) →
        </button>
      )}

      <p className={styles.note}>
        Educational, for clinicians. It works up the <em>breastfeeding</em> problem — the infant's
        clinical care is assessed separately.
      </p>
    </section>
  );
}
