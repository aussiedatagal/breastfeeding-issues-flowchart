import type { Content } from "../../content/model.ts";
import styles from "./StartScreen.module.css";

interface Props {
  content: Content;
  findingsCount: number;
  onPickArea: (areaId: string) => void;
  onOpenSummary: () => void;
}

export function StartScreen({ content, findingsCount, onPickArea, onOpenSummary }: Props) {
  return (
    <section>
      <p className={styles.kicker}>Breastfeeding difficulty</p>
      <h1 className={styles.title}>Where is the problem showing up?</h1>
      <p className={styles.lede}>{content.intro}</p>

      <ul className={styles.areas}>
        {content.areas.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className={styles.area}
              data-area={a.id}
              aria-label={a.short ?? a.label}
              onClick={() => onPickArea(a.id)}
            >
              <span className={styles.areaText}>
                <span className={styles.areaName}>{a.short ?? a.label}</span>
                <span className={styles.areaHint}>{a.label}</span>
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
