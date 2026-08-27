import styles from "./ZoomControls.module.css";

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControls({ onZoomIn, onZoomOut }: Props) {
  return (
    <div className={styles.controls}>
      <button type="button" onClick={onZoomIn} aria-label="Zoom in">
        +
      </button>
      <button type="button" onClick={onZoomOut} aria-label="Zoom out">
        −
      </button>
    </div>
  );
}
