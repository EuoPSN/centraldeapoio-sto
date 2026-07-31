export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  sidebar: string;
  sidebarText: string;
}

export const THEMES: ThemePreset[] = [
  {
    id: "verde-padrao",
    name: "Verde Cartão de Todos",
    description: "Tema padrão da plataforma",
    primary: "177 100% 32%",
    primaryForeground: "0 0% 100%",
    accent: "89 72% 48%",
    accentForeground: "140 40% 15%",
    sidebar: "0 0% 100%",
    sidebarText: "220 15% 30%",
  },
  {
    id: "azul-corporativo",
    name: "Azul Corporativo",
    description: "Tom profissional e confiável",
    primary: "221 83% 53%",
    primaryForeground: "0 0% 100%",
    accent: "213 94% 68%",
    accentForeground: "222 47% 15%",
    sidebar: "222 47% 11%",
    sidebarText: "210 30% 92%",
  },
  {
    id: "roxo-moderno",
    name: "Roxo Moderno",
    description: "Visual tecnológico e criativo",
    primary: "262 83% 58%",
    primaryForeground: "0 0% 100%",
    accent: "270 91% 65%",
    accentForeground: "263 54% 15%",
    sidebar: "263 54% 13%",
    sidebarText: "270 30% 92%",
  },
  {
    id: "laranja-energia",
    name: "Laranja Energia",
    description: "Vibrante e motivador",
    primary: "24 95% 53%",
    primaryForeground: "0 0% 100%",
    accent: "38 92% 50%",
    accentForeground: "20 50% 15%",
    sidebar: "20 50% 12%",
    sidebarText: "30 30% 92%",
  },
  {
    id: "cinza-elegante",
    name: "Cinza Elegante",
    description: "Minimalista e sofisticado",
    primary: "220 14% 40%",
    primaryForeground: "0 0% 100%",
    accent: "215 20% 65%",
    accentForeground: "222 20% 15%",
    sidebar: "222 20% 12%",
    sidebarText: "210 20% 92%",
  },
];

export const DEFAULT_THEME_ID = "verde-padrao";

export function getTheme(id: string | null | undefined): ThemePreset {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

/** Aplica as variáveis CSS do tema no elemento :root. */
export function applyThemeVars(theme: ThemePreset) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", theme.primary);
  root.style.setProperty("--theme-primary-foreground", theme.primaryForeground);
  root.style.setProperty("--theme-accent", theme.accent);
  root.style.setProperty("--theme-accent-foreground", theme.accentForeground);
  root.style.setProperty("--theme-sidebar-bg", theme.sidebar);
  root.style.setProperty("--theme-sidebar-text", theme.sidebarText);
}
