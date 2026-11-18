import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Aplica o nome da plataforma e o favicon definidos no Painel Admin.
//
// Temas de cores: o seletor de temas (antigo ThemeProvider + src/lib/themes.ts)
// foi removido no redesign de 18/11/2026 e volta numa atualização futura.
// Até lá, as cores vêm só de src/styles.css: o active_theme e as cores
// salvas em app_settings ficam no banco, mas não alteram a aparência.

interface AppSettings {
  platform_name: string;
  favicon_url: string | null;
}

async function fetchSettings(): Promise<AppSettings | null> {
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  return data as AppSettings | null;
}

export function AppSettingsEffects() {
  const { data } = useQuery({ queryKey: ["app-settings"], queryFn: fetchSettings, staleTime: 60_000 });

  useEffect(() => {
    if (!data) return;
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

  return null;
}
