import { useCallback, useEffect, useState } from "react";
import { applyThemeVars, DEFAULT_THEME_ID, getTheme, THEMES } from "@/lib/themes";

const STORAGE_KEY = "cdt-theme-id";

function readStored(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function useTheme() {
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID);

  // Hidrata após a montagem (evita mismatch de SSR)
  useEffect(() => {
    const stored = readStored();
    setThemeId(stored);
    applyThemeVars(getTheme(stored));
  }, []);

  const setTheme = useCallback((id: string) => {
    const theme = getTheme(id);
    applyThemeVars(theme);
    setThemeId(theme.id);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme.id);
    } catch {
      /* storage indisponível */
    }
  }, []);

  return { themeId, setTheme, themes: THEMES };
}

export { STORAGE_KEY as THEME_STORAGE_KEY };
