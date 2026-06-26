import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { updateAppSettings } from "@/lib/settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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
      toast.success("Aparência atualizada. Recarregue para ver as cores.");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      qc.invalidateQueries({ queryKey: ["app-settings-admin"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (!form) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Identidade</h3>
        <div><Label>Nome da plataforma</Label><Input value={form.platform_name} onChange={(e) => setForm({ ...form, platform_name: e.target.value })} /></div>
        <div><Label>Tagline</Label><Input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value || null })} /></div>
        <div><Label>URL da logo</Label><Input value={form.logo_url ?? ""} onChange={(e) => setForm({ ...form, logo_url: e.target.value || null })} placeholder="https://..." /></div>
        <div><Label>URL do favicon</Label><Input value={form.favicon_url ?? ""} onChange={(e) => setForm({ ...form, favicon_url: e.target.value || null })} /></div>
        <div><Label>URL da imagem de capa</Label><Input value={form.cover_url ?? ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value || null })} /></div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Tema & Cores</h3>
        <div>
          <Label>Tema ativo</Label>
          <Select value={form.active_theme} onValueChange={(v) => setForm({ ...form, active_theme: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="corporate">Corporativo</SelectItem>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="dark">Escuro</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Primária" value={form.primary_color} onChange={(v) => setForm({ ...form, primary_color: v })} />
          <ColorField label="Secundária" value={form.secondary_color} onChange={(v) => setForm({ ...form, secondary_color: v })} />
          <ColorField label="Destaque" value={form.accent_color} onChange={(v) => setForm({ ...form, accent_color: v })} />
          <ColorField label="Fundo" value={form.background_color} onChange={(v) => setForm({ ...form, background_color: v })} />
        </div>
        <p className="text-xs text-muted-foreground">Use formato hex (#00A19A). Para tema "Personalizado" as cores acima sobrescrevem o padrão.</p>
      </Card>

      <div className="lg:col-span-2 flex justify-end">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar aparência</Button>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input type="color" value={value ?? "#00A19A"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border" />
        <Input value={value ?? ""} placeholder="auto" onChange={(e) => onChange(e.target.value || null)} className="flex-1" />
      </div>
    </div>
  );
}
