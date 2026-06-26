import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listNavItems, upsertNavItem, deleteNavItem } from "@/lib/settings.functions";
import { ICON_NAMES, getIcon } from "@/lib/icon-map";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

interface NavRow {
  id: string; label: string; icon: string; route: string;
  section: string; position: number; visible: boolean; admin_only: boolean;
}

export function MenuTab() {
  const list = useServerFn(listNavItems);
  const upsert = useServerFn(upsertNavItem);
  const del = useServerFn(deleteNavItem);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["nav-items"], queryFn: () => list({}) });
  const items = (q.data ?? []) as NavRow[];

  const [edit, setEdit] = useState<null | NavRow & { isNew?: boolean }>(null);

  const mUp = useMutation({
    mutationFn: (v: Partial<NavRow> & { id?: string }) => upsert({ data: v as { id?: string; label: string; icon: string; route: string; section: string; position: number; visible: boolean; admin_only: boolean } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["nav-items"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["nav-items"] }); },
  });

  const move = (item: NavRow, dir: -1 | 1) => {
    mUp.mutate({ id: item.id, label: item.label, icon: item.icon, route: item.route, section: item.section, visible: item.visible, admin_only: item.admin_only, position: item.position + dir * 5 });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Itens do menu ({items.length})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ id: "", label: "", icon: "Folder", route: "/", section: "main", position: 100, visible: true, admin_only: false, isNew: true })}>
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>
      <div className="p-4 space-y-1">
        {items.map((it) => {
          const Icon = getIcon(it.icon);
          return (
            <div key={it.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40">
              <div className="flex items-center gap-3 min-w-0">
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{it.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{it.route} · seção: {it.section}</div>
                </div>
                {it.admin_only && <Badge variant="outline" className="text-[10px]">admin</Badge>}
                {!it.visible && <Badge variant="secondary" className="text-[10px]">oculto</Badge>}
              </div>
              <div className="space-x-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => move(it, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(it, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setEdit({ ...it })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && mDel.mutate(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.isNew ? "Novo item de menu" : "Editar item"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Rótulo</Label><Input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></div>
              <div><Label>Rota (ex: /sugestoes)</Label><Input value={edit.route} onChange={(e) => setEdit({ ...edit, route: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ícone</Label>
                  <Select value={edit.icon} onValueChange={(v) => setEdit({ ...edit, icon: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-80">
                      {ICON_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Seção</Label>
                  <Select value={edit.section} onValueChange={(v) => setEdit({ ...edit, section: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Central</SelectItem>
                      <SelectItem value="ai">Inteligência</SelectItem>
                      <SelectItem value="admin">Administração</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Visível</Label>
                <Switch checked={edit.visible} onCheckedChange={(v) => setEdit({ ...edit, visible: v })} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Apenas admin</Label>
                <Switch checked={edit.admin_only} onCheckedChange={(v) => setEdit({ ...edit, admin_only: v })} />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => edit && mUp.mutate({
            id: edit.isNew ? undefined : edit.id,
            label: edit.label, icon: edit.icon, route: edit.route, section: edit.section,
            position: edit.position, visible: edit.visible, admin_only: edit.admin_only,
          })} disabled={mUp.isPending || !edit?.label || !edit?.route}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
