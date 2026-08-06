import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAdminSections, updateAdminSection } from "@/lib/settings.functions";
import { getIcon } from "@/lib/icon-map";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Layers } from "lucide-react";
import { toast } from "sonner";

export const ADMIN_GROUP_ORDER = ["Conteúdo & IA", "Atendimento", "Pessoas", "Sistema"];

interface AdminSectionRow {
  id: string;
  tab_key: string;
  label: string;
  icon: string;
  group_name: string;
  position: number;
  visible: boolean;
}

export function AdminSectionsTab() {
  const list = useServerFn(listAdminSections);
  const update = useServerFn(updateAdminSection);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-sections"], queryFn: () => list({}) });
  const items = (q.data ?? []) as AdminSectionRow[];

  const mUp = useMutation({
    mutationFn: (v: { id: string; group_name?: string; position?: number; visible?: boolean }) => update({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sections"] }); qc.invalidateQueries({ queryKey: ["admin-sections-nav"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const changeGroup = (item: AdminSectionRow, group_name: string) => {
    mUp.mutate({ id: item.id, group_name, position: 999 });
  };

  const move = (item: AdminSectionRow, dir: -1 | 1) => {
    mUp.mutate({ id: item.id, position: item.position + dir * 5 });
  };

  const toggleVisible = (item: AdminSectionRow, visible: boolean) => {
    mUp.mutate({ id: item.id, visible });
  };

  const grouped = items.reduce<Record<string, AdminSectionRow[]>>((acc, it) => {
    (acc[it.group_name] ??= []).push(it);
    return acc;
  }, {});
  const orderedGroups = [...ADMIN_GROUP_ORDER, ...Object.keys(grouped).filter((g) => !ADMIN_GROUP_ORDER.includes(g))];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Layers className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Organização das abas do Painel Admin</h3>
      </div>
      <p className="px-4 pt-3 text-sm text-muted-foreground">
        Troque o grupo de qualquer item, reordene com as setas, ou oculte itens que você não usa. A barra lateral do Admin reflete na hora.
      </p>
      <div className="p-4 space-y-5">
        {orderedGroups.map((group) => {
          const list = grouped[group];
          if (!list?.length) return null;
          return (
            <div key={group}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{group}</p>
              <div className="space-y-1">
                {list.map((it) => {
                  const Icon = getIcon(it.icon);
                  return (
                    <div key={it.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/40">
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{it.label}</div>
                          {!it.visible && <Badge variant="secondary" className="text-[10px] mt-0.5">oculto na barra lateral</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select value={it.group_name} onValueChange={(v) => changeGroup(it, v)}>
                          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ADMIN_GROUP_ORDER.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(it, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(it, 1)}><ArrowDown className="h-4 w-4" /></Button>
                        <Switch checked={it.visible} onCheckedChange={(v) => toggleVisible(it, v)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
