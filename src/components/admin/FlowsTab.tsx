import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listFlows, getFlow, upsertFlow, deleteFlow, upsertNode, deleteNode } from "@/lib/flows.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Flow { id: string; title: string; description: string | null; is_training: boolean; }
interface Node {
  id: string; flow_id: string; parent_id: string | null;
  node_type: string; title: string; message: string | null; note: string | null; position: number;
}

const NODE_TYPES = [
  { value: "start", label: "Início" },
  { value: "step", label: "Etapa" },
  { value: "question", label: "Pergunta" },
  { value: "answer", label: "Resposta" },
  { value: "objection", label: "Objeção" },
  { value: "action", label: "Ação" },
  { value: "end", label: "Fim" },
];

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
    onSuccess: (r) => { toast.success("Salvo."); setEditFlow(null); qc.invalidateQueries({ queryKey: ["flows-all"] }); if (r?.id) setSelected(r.id); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const fDel = useMutation({
    mutationFn: (id: string) => delF({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); setSelected(null); qc.invalidateQueries({ queryKey: ["flows-all"] }); },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
      <Card className="p-3">
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

      <div>
        {!selected && <Card className="p-10 text-center text-muted-foreground">Selecione um fluxo ou crie um novo.</Card>}
        {selected && <FlowEditor flowId={selected} onEdit={(f) => setEditFlow({ id: f.id, title: f.title, description: f.description ?? "", is_training: f.is_training })} onDelete={(id) => confirm("Excluir fluxo?") && fDel.mutate(id)} />}
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

function FlowEditor({ flowId, onEdit, onDelete }: { flowId: string; onEdit: (f: Flow) => void; onDelete: (id: string) => void }) {
  const get = useServerFn(getFlow);
  const upN = useServerFn(upsertNode);
  const delN = useServerFn(deleteNode);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["flow-edit", flowId], queryFn: () => get({ data: { id: flowId } }) });

  const [editNode, setEditNode] = useState<null | { id?: string; parent_id: string | null; node_type: string; title: string; message: string; note: string; }>(null);

  const nUp = useMutation({
    mutationFn: () => upN({ data: {
      id: editNode!.id, flow_id: flowId, parent_id: editNode!.parent_id,
      node_type: editNode!.node_type as "step", title: editNode!.title,
      message: editNode!.message || null, note: editNode!.note || null, position: 0,
    } }),
    onSuccess: () => { toast.success("Nó salvo."); setEditNode(null); qc.invalidateQueries({ queryKey: ["flow-edit", flowId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const nDel = useMutation({
    mutationFn: (id: string) => delN({ data: { id } }),
    onSuccess: () => { toast.success("Nó removido."); qc.invalidateQueries({ queryKey: ["flow-edit", flowId] }); },
  });

  if (q.isLoading || !q.data) return <p className="text-muted-foreground">Carregando...</p>;
  const flow = q.data.flow as Flow;
  const nodes = q.data.nodes as Node[];
  const roots = nodes.filter((n) => !n.parent_id);

  return (
    <Card className="p-5">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <h2 className="text-xl font-bold">{flow.title}</h2>
          {flow.description && <p className="text-sm text-muted-foreground">{flow.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(flow)}>Editar fluxo</Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(flow.id)}>Excluir</Button>
          <Button size="sm" className="gap-1" onClick={() => setEditNode({ parent_id: null, node_type: "start", title: "", message: "", note: "" })}>
            <Plus className="h-4 w-4" /> Nó raiz
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {roots.length === 0 && <p className="text-sm text-muted-foreground">Adicione o primeiro nó (Início).</p>}
        {roots.map((r) => <EditNode key={r.id} node={r} all={nodes} depth={0}
          onAddChild={(parent) => setEditNode({ parent_id: parent.id, node_type: "step", title: "", message: "", note: "" })}
          onEditNode={(n) => setEditNode({ id: n.id, parent_id: n.parent_id, node_type: n.node_type, title: n.title, message: n.message ?? "", note: n.note ?? "" })}
          onDelNode={(id) => confirm("Excluir nó e filhos?") && nDel.mutate(id)}
        />)}
      </div>

      <Dialog open={!!editNode} onOpenChange={(v) => !v && setEditNode(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editNode?.id ? "Editar nó" : "Novo nó"}</DialogTitle></DialogHeader>
          {editNode && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={editNode.node_type} onValueChange={(v) => setEditNode({ ...editNode, node_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{NODE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Título</Label><Input value={editNode.title} onChange={(e) => setEditNode({ ...editNode, title: e.target.value })} /></div>
              </div>
              <div><Label>Mensagem sugerida</Label><Textarea rows={5} value={editNode.message} onChange={(e) => setEditNode({ ...editNode, message: e.target.value })} /></div>
              <div><Label>Observação interna</Label><Input value={editNode.note} onChange={(e) => setEditNode({ ...editNode, note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => nUp.mutate()} disabled={nUp.isPending || !editNode?.title}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EditNode({ node, all, depth, onAddChild, onEditNode, onDelNode }: {
  node: Node; all: Node[]; depth: number;
  onAddChild: (n: Node) => void; onEditNode: (n: Node) => void; onDelNode: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const children = all.filter((n) => n.parent_id === node.id);
  return (
    <div style={{ marginLeft: depth * 20 }}>
      <Card className="p-3">
        <div className="flex items-start gap-2">
          <button onClick={() => setOpen(!open)} className="mt-1 text-muted-foreground" disabled={children.length === 0}>
            {children.length > 0 ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{NODE_TYPES.find((t) => t.value === node.node_type)?.label ?? node.node_type}</Badge>
              <span className="font-medium text-sm">{node.title}</span>
            </div>
            {node.message && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{node.message}</p>}
          </div>
          <div className="space-x-1">
            <Button size="icon" variant="ghost" onClick={() => onAddChild(node)} title="Adicionar filho"><Plus className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => onEditNode(node)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => onDelNode(node.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
      </Card>
      {open && children.length > 0 && (
        <div className="mt-2 space-y-2 border-l-2 border-dashed border-border pl-2">
          {children.map((c) => <EditNode key={c.id} node={c} all={all} depth={depth + 1}
            onAddChild={onAddChild} onEditNode={onEditNode} onDelNode={onDelNode} />)}
        </div>
      )}
    </div>
  );
}
