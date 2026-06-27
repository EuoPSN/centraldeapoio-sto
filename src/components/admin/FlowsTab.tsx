import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listFlows, upsertFlow, deleteFlow } from "@/lib/flows.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { FlowEditor } from "@/components/FlowEditor";

interface Flow { id: string; title: string; description: string | null; is_training: boolean; }

export function FlowsTab() {
  const listFn = useServerFn(listFlows);
  const upFlow = useServerFn(upsertFlow);
  const delF = useServerFn(deleteFlow);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["flows-all"], queryFn: () => listFn({ data: {} }) });
  const flows = (q.data ?? []) as Flow[];

  const [selected, setSelected] = useState<string | null>(null);
  const [editFlow, setEditFlow] = useState<null | { id?: string; title: string; description: string; is_training: boolean; }>(null);

  const fUp = useMutation({
    mutationFn: () => upFlow({ data: {
      id: editFlow!.id, title: editFlow!.title, description: editFlow!.description || null,
      is_training: editFlow!.is_training, position: 0,
    } }),
    onSuccess: (r) => {
      toast.success("Salvo.");
      setEditFlow(null);
      qc.invalidateQueries({ queryKey: ["flows-all"] });
      if (r?.id) setSelected(r.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const fDel = useMutation({
    mutationFn: (id: string) => delF({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); setSelected(null); qc.invalidateQueries({ queryKey: ["flows-all"] }); },
  });

  const currentFlow = flows.find((f) => f.id === selected);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      <Card className="p-3 h-fit">
        <div className="flex justify-between items-center mb-2 px-2">
          <h3 className="font-semibold text-sm">Fluxos</h3>
          <Button size="sm" variant="ghost" className="gap-1" onClick={() => setEditFlow({ title: "", description: "", is_training: false })}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
        <div className="space-y-1">
          {flows.map((f) => (
            <button key={f.id} onClick={() => setSelected(f.id)}
              className={`w-full text-left p-2 rounded-md text-sm transition ${selected === f.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate flex-1">{f.title}</span>
                {f.is_training && <Badge variant="outline" className="text-[10px]">Treino</Badge>}
              </div>
            </button>
          ))}
          {flows.length === 0 && <p className="text-xs text-muted-foreground p-2">Crie seu primeiro fluxo.</p>}
        </div>
      </Card>

      <div className="min-w-0">
        {!currentFlow && <Card className="p-10 text-center text-muted-foreground">Selecione um fluxo ou crie um novo para abrir o editor visual.</Card>}
        {currentFlow && (
          <Card className="p-2">
            <div className="flex justify-between items-start p-2 gap-2">
              <div>
                <h2 className="text-lg font-bold">{currentFlow.title}</h2>
                {currentFlow.description && <p className="text-xs text-muted-foreground">{currentFlow.description}</p>}
                {currentFlow.is_training && <Badge variant="outline" className="text-[10px] mt-1">Cenário de treinamento</Badge>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditFlow({
                  id: currentFlow.id, title: currentFlow.title,
                  description: currentFlow.description ?? "", is_training: currentFlow.is_training,
                })}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => confirm("Excluir fluxo e todos os blocos?") && fDel.mutate(currentFlow.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" /> Excluir
                </Button>
              </div>
            </div>
            <FlowEditor flowId={currentFlow.id} canEdit />
          </Card>
        )}
      </div>

      <Dialog open={!!editFlow} onOpenChange={(v) => !v && setEditFlow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editFlow?.id ? "Editar fluxo" : "Novo fluxo"}</DialogTitle></DialogHeader>
          {editFlow && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editFlow.title} onChange={(e) => setEditFlow({ ...editFlow, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea rows={3} value={editFlow.description} onChange={(e) => setEditFlow({ ...editFlow, description: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Cenário de treinamento</Label>
                  <p className="text-xs text-muted-foreground">Aparece no Simulador em vez da Central de Fluxos.</p>
                </div>
                <Switch checked={editFlow.is_training} onCheckedChange={(v) => setEditFlow({ ...editFlow, is_training: v })} />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => fUp.mutate()} disabled={fUp.isPending || !editFlow?.title}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
