import type { ThemeChoice } from "../hooks/useTheme.ts";
import styles from "./Toolbar.module.css";

const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "Theme: auto",
  light: "Theme: light",
  dark: "Theme: dark",
};

interface Props {
  title: string;
  subtitle?: string;
  theme: ThemeChoice;
  onRestart: () => void;
  onExpandAll: () => void;
  onFit: () => void;
  onToggleLegend: () => void;
  onCycleTheme: () => void;
}

export function Toolbar({
  title,
  subtitle,
  theme,
  onRestart,
  onExpandAll,
  onFit,
  onToggleLegend,
  onCycleTheme,
}: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.titleGroup}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <div className={styles.spacer} />
      <div className={styles.actions}>
        <button onClick={onRestart}>Start over</button>
        <button onClick={onExpandAll}>Expand all</button>
        <button onClick={onFit}>Fit</button>
        <button onClick={onCycleTheme}>{THEME_LABEL[theme]}</button>
        <button className={styles.ghost} onClick={onToggleLegend}>
          Legend
        </button>
      </div>
    </header>
  );
}
