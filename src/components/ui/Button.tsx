import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "quiet";
type Size = "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** stretch to the full width of the container */
  block?: boolean;
  children: ReactNode;
}

/** The one button in the app. Variants cover primary actions, secondary
 *  choices, and low-emphasis links-that-act. */
export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  type = "button",
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={[styles.btn, styles[variant], styles[size], block ? styles.block : "", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
