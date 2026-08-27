import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "bdm.theme";
const order: ThemeChoice[] = ["system", "light", "dark"];

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* storage unavailable */
  }
  return "system";
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* ignore */
    }
  }, [choice]);

  const cycle = useCallback(() => {
    setChoice((c) => order[(order.indexOf(c) + 1) % order.length]!);
  }, []);

  return { choice, setChoice, cycle };
}
