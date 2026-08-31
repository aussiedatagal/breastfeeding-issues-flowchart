import type { Area, Content } from "../../content/model.ts";
import styles from "./ScreeningScreen.module.css";

interface Props {
  content: Content;
  area: Area;
  ask: string;
  screenIndex: number;
  index: number;
  picked: Area[];
  first: boolean;
  findingsCount: number;
  onScreen: (areaId: string, screenIndex: number, yes: boolean) => void;
  onOpenSummary: () => void;
  onBack?: () => void;
}

export function ScreeningScreen({
  content,
  area,
  ask,
  screenIndex,
  index,
  picked,
  first,
  findingsCount,
  onScreen,
  onOpenSummary,
  onBack,
}: Props) {
  return (
    <section className={styles.section} key={`${area.id}:${screenIndex}`}>
      {first ? (
        <>
          <p className={styles.kicker}>Breastfeeding difficulty</p>
          <p className={styles.lede}>{content.intro}</p>
        </>
      ) : (
        <p className={styles.progress}>Screening · question {index}</p>
      )}

      <h1 className={styles.question}>{ask}</h1>

      {picked.length > 0 && (
        <p className={styles.picked}>So far: {picked.map((a) => a.short ?? a.label).join(", ")}</p>
      )}

      <div className={styles.spacer} />

      <div className={styles.answers}>
        <button
          type="button"
          className={styles.answer}
          data-answer="yes"
          onClick={() => onScreen(area.id, screenIndex, true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={styles.answer}
          data-answer="no"
          onClick={() => onScreen(area.id, screenIndex, false)}
        >
          No
        </button>
      </div>

      {first && findingsCount > 0 && (
        <button type="button" className={styles.findingsLink} onClick={onOpenSummary}>
          Your findings so far ({findingsCount}) →
        </button>
      )}

      {onBack && !first && (
        <button type="button" className={styles.stepBack} onClick={onBack}>
          ← Previous question
        </button>
      )}

      {first && (
        <p className={styles.note}>
          This helps work out what's happening with <em>breastfeeding</em>. Your baby's general
          health — feeding enough, weight, jaundice — is checked separately by your health
          professional.
        </p>
      )}
    </section>
  );
}
