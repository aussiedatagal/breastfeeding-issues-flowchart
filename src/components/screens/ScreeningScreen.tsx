import type { Area, Content } from "../../content/model.ts";
import styles from "./ScreeningScreen.module.css";

interface Props {
  content: Content;
  area: Area;
  index: number;
  total: number;
  picked: Area[];
  first: boolean;
  findingsCount: number;
  onGate: (areaId: string, include: boolean) => void;
  onOpenSummary: () => void;
}

export function ScreeningScreen({
  content,
  area,
  index,
  total,
  picked,
  first,
  findingsCount,
  onGate,
  onOpenSummary,
}: Props) {
  return (
    <section className={styles.section} key={area.id}>
      {first ? (
        <>
          <p className={styles.kicker}>Breastfeeding difficulty</p>
          <h1 className={styles.title}>What's going on?</h1>
          <p className={styles.lede}>{content.intro}</p>
        </>
      ) : (
        <p className={styles.progress}>
          Screening · {index} of {total}
        </p>
      )}

      <h2 className={styles.question}>{area.ask ?? `${area.label}?`}</h2>

      {picked.length > 0 && (
        <p className={styles.picked}>
          So far: {picked.map((a) => a.short ?? a.label).join(", ")}
        </p>
      )}

      <div className={styles.spacer} />

      <div className={styles.answers}>
        <button
          type="button"
          className={styles.answer}
          data-answer="yes"
          onClick={() => onGate(area.id, true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={styles.answer}
          data-answer="no"
          onClick={() => onGate(area.id, false)}
        >
          No
        </button>
      </div>

      {first && findingsCount > 0 && (
        <button type="button" className={styles.findingsLink} onClick={onOpenSummary}>
          Your findings so far ({findingsCount}) →
        </button>
      )}

      {first && (
        <p className={styles.note}>
          Educational, for clinicians. It works up the <em>breastfeeding</em> problem — the infant's
          clinical care is assessed separately.
        </p>
      )}
    </section>
  );
}
