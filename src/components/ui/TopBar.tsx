import type { ThemeChoice } from "../../hooks/useTheme.ts";
import styles from "./TopBar.module.css";

interface Props {
  /** small context label, e.g. the current problem area */
  eyebrow?: string;
  findingsCount: number;
  onFindings: () => void;
  onSources: () => void;
  onToggleMap: () => void;
  mapActive: boolean;
  theme: ThemeChoice;
  onCycleTheme: () => void;
}

const THEME_ICON: Record<ThemeChoice, string> = { system: "◐", light: "○", dark: "●" };

export function TopBar({
  eyebrow,
  findingsCount,
  onFindings,
  onSources,
  onToggleMap,
  mapActive,
  theme,
  onCycleTheme,
}: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.mark}>Breastfeeding</span>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.viewToggle}
          data-active={mapActive}
          onClick={onToggleMap}
        >
          {mapActive ? "Quiz" : "Map"}
        </button>
        {findingsCount > 0 && (
          <button type="button" className={styles.findings} onClick={onFindings}>
            Findings <span className={styles.count}>{findingsCount}</span>
          </button>
        )}
        <button
          type="button"
          className={styles.theme}
          onClick={onSources}
          aria-label="Sources and evidence"
          title="Sources"
        >
          ?
        </button>
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
