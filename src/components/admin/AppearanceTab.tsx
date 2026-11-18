import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { updateAppSettings } from "@/lib/settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Palette } from "lucide-react";

// Temas de cores: removidos no redesign de 18/11/2026; voltam numa atualização
// futura. As cores e o active_theme continuam salvos em app_settings (o
// formulário reenvia os valores atuais sem mudança), mas não alteram o visual.


interface Settings {
  platform_name: string; tagline: string | null;
  logo_url: string | null; favicon_url: string | null; cover_url: string | null;
  primary_color: string | null; secondary_color: string | null; accent_color: string | null; background_color: string | null;
  active_theme: string;
}

async function fetchSettings() {
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  return data as Settings | null;
}

export function AppearanceTab() {
  const update = useServerFn(updateAppSettings);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["app-settings-admin"], queryFn: fetchSettings });
  const [form, setForm] = useState<Settings | null>(null);

  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  const mut = useMutation({
    mutationFn: () => update({ data: {
      platform_name: form!.platform_name, tagline: form!.tagline,
      logo_url: form!.logo_url, favicon_url: form!.favicon_url, cover_url: form!.cover_url,
      primary_color: form!.primary_color, secondary_color: form!.secondary_color,
      accent_color: form!.accent_color, background_color: form!.background_color,
      active_theme: form!.active_theme,
    } }),
    onSuccess: () => {
      toast.success("Identidade atualizada.");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      qc.invalidateQueries({ queryKey: ["app-settings-admin"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (!form) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <Palette className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Temas de cores voltam numa atualização futura</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Nesta versão a Central usa um visual único para todos. As cores salvas antes continuam guardadas, mas não mudam a aparência.
          </p>
        </div>
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Identidade</h3>
        <div><Label>Nome da plataforma</Label><Input value={form.platform_name} onChange={(e) => setForm({ ...form, platform_name: e.target.value })} /></div>
        <div><Label>Tagline</Label><Input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value || null })} /></div>
        <div><Label>URL da logo</Label><Input value={form.logo_url ?? ""} onChange={(e) => setForm({ ...form, logo_url: e.target.value || null })} placeholder="https://..." /></div>
        <div><Label>URL do favicon</Label><Input value={form.favicon_url ?? ""} onChange={(e) => setForm({ ...form, favicon_url: e.target.value || null })} /></div>
        <div><Label>URL da imagem de capa</Label><Input value={form.cover_url ?? ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value || null })} /></div>
      </Card>

      <div className="lg:col-span-2 flex justify-end">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar identidade</Button>
      </div>
    </div>
    </div>
  );
}
