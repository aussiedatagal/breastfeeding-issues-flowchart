import styles from "./Legend.module.css";

const rows: { swatch: React.CSSProperties; label: React.ReactNode }[] = [
  {
    swatch: { background: "var(--surface)", borderColor: "var(--hairline-strong)" },
    label: "A question — its branches are Yes / No nodes",
  },
  {
    swatch: { background: "var(--surface-raised)", borderColor: "var(--calm)" },
    label: "Tap a Yes / No node to open that branch",
  },
  {
    swatch: { background: "var(--accent-wash)", borderColor: "var(--accent)" },
    label: "Working diagnosis — the end of a path",
  },
  {
    swatch: { background: "transparent", borderColor: "var(--accent)", borderStyle: "dashed" },
    label: "↗ jumps to a shared step (several paths, one outcome)",
  },
  {
    swatch: { background: "var(--danger-wash)", borderColor: "var(--danger)" },
    label: "Do not miss",
  },
  {
    swatch: { background: "var(--calm-wash)", borderColor: "var(--calm)" },
    label: "Likely normal",
  },
  {
    swatch: { background: "var(--surface)", borderColor: "var(--caution)" },
    label: "Commonly mislabelled",
  },
];

export function Legend({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className={styles.legend} role="note">
      <div className={styles.head}>
        <p className={styles.title}>How to read it</p>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close legend">
          ×
        </button>
      </div>
      {rows.map((row, i) => (
        <div className={styles.row} key={i}>
          <span className={styles.swatch} style={row.swatch} />
          <span>{row.label}</span>
        </div>
      ))}
      <p className={styles.hint}>
        Once a branch is open, its answer moves onto the edge — tap the YES / NO edge label to undo
        it.
      </p>
    </div>
  );
}
