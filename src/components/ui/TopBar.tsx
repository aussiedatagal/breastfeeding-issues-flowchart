import type { ThemeChoice } from "../../hooks/useTheme.ts";
import styles from "./TopBar.module.css";

interface Props {
  /** shown when there is somewhere to go back to */
  onBack?: () => void;
  /** small context label, e.g. the current problem area */
  eyebrow?: string;
  findingsCount: number;
  onFindings: () => void;
  theme: ThemeChoice;
  onCycleTheme: () => void;
}

const THEME_ICON: Record<ThemeChoice, string> = { system: "◐", light: "○", dark: "●" };

export function TopBar({ onBack, eyebrow, findingsCount, onFindings, theme, onCycleTheme }: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        {onBack ? (
          <button type="button" className={styles.back} onClick={onBack} aria-label="Back">
            <span className={styles.arrow} aria-hidden="true" />
          </button>
        ) : (
          <span className={styles.mark}>Breastfeeding</span>
        )}
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      </div>

      <div className={styles.right}>
        {findingsCount > 0 && (
          <button type="button" className={styles.findings} onClick={onFindings}>
            Findings <span className={styles.count}>{findingsCount}</span>
          </button>
        )}
        <button
          type="button"
          className={styles.theme}
          onClick={onCycleTheme}
          aria-label={`Theme: ${theme}. Tap to change.`}
          title={`Theme: ${theme}`}
        >
          {THEME_ICON[theme]}
        </button>
      </div>
    </header>
  );
}
