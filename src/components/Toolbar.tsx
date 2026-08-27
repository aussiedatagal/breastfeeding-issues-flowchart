import { useEffect, useRef, useState } from "react";
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
  compact: boolean;
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
  compact,
  onRestart,
  onExpandAll,
  onFit,
  onToggleLegend,
  onCycleTheme,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [menuOpen]);

  return (
    <header className={styles.bar}>
      <div className={styles.titleGroup}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      <div className={styles.actions} ref={menuRef}>
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            setMenuOpen(false);
            onRestart();
          }}
        >
          Start over
        </button>
        {!compact && (
          <button type="button" className={styles.action} onClick={onExpandAll}>
            Expand all
          </button>
        )}
        {compact ? (
          <>
            <button
              type="button"
              className={styles.action}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              More ▾
            </button>
            {menuOpen && (
              <div className={styles.menu} role="menu">
                <button role="menuitem" onClick={() => run(onExpandAll, setMenuOpen)}>
                  Show the whole map
                </button>
                <button role="menuitem" onClick={() => run(onFit, setMenuOpen)}>
                  Fit to screen
                </button>
                <button role="menuitem" onClick={() => run(onCycleTheme, setMenuOpen)}>
                  {THEME_LABEL[theme]}
                </button>
                <button role="menuitem" onClick={() => run(onToggleLegend, setMenuOpen)}>
                  Legend
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <button type="button" className={styles.action} onClick={onFit}>
              Fit
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={onCycleTheme}
              aria-label={`Change theme (currently ${THEME_LABEL[theme].toLowerCase()})`}
            >
              {THEME_LABEL[theme]}
            </button>
            <button
              type="button"
              className={`${styles.action} ${styles.ghost}`}
              onClick={onToggleLegend}
            >
              Legend
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function run(fn: () => void, close: (v: boolean) => void) {
  fn();
  close(false);
}
