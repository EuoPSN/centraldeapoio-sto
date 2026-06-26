import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  platform_name: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  active_theme: string;
  favicon_url: string | null;
}

async function fetchSettings(): Promise<AppSettings | null> {
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  return data as AppSettings | null;
}

function hexToOklchVar(hex: string): string {
  // Quick & dirty: just emit the hex; modern browsers accept hex in color tokens that compute against oklch sources.
  // Tailwind's color utilities will use the value directly since CSS variables are passthrough.
  return hex;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({ queryKey: ["app-settings"], queryFn: fetchSettings, staleTime: 60_000 });

  useEffect(() => {
    if (!data) return;
    const root = document.documentElement;
    if (data.active_theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");

    if (data.primary_color) root.style.setProperty("--primary", hexToOklchVar(data.primary_color));
    if (data.accent_color) root.style.setProperty("--accent", hexToOklchVar(data.accent_color));
    if (data.secondary_color) root.style.setProperty("--secondary", hexToOklchVar(data.secondary_color));
    if (data.background_color) root.style.setProperty("--background", hexToOklchVar(data.background_color));

    if (data.platform_name) document.title = data.platform_name;
    if (data.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = data.favicon_url;
    }
  }, [data]);

  return <>{children}</>;
}
