import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMotors,
  upsertMotor,
  deleteMotor,
  getMotorFull,
  upsertNode,
  deleteNode,
  upsertEdge,
  deleteEdge,
} from "@/lib/motor-decisao.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, ChevronRight, ArrowLeft, Zap } from "lucide-react";
import { toast } from "sonner";

const EMPTY_MOTOR = { name: "", category: "", description: "", is_active: true };
const EMPTY_NODE = {
  type: "question",
  title: "",
  question_type: "yes_no",
  processo: "",
  mensagem: "",
  documentos: "",
  orientacoes: "",
  observacoes: "",
  is_start: false,
};
const EMPTY_EDGE = { from_node_id: "", to_node_id: "", label: "" };

export function MotorDecisaoAdminTab() {
  // Server functions
  const listFn = useServerFn(listMotors);
  const upsertMotorFn = useServerFn(upsertMotor);
  const deleteMotorFn = useServerFn(deleteMotor);
  const getFullFn = useServerFn(getMotorFull);
  const upsertNodeFn = useServerFn(upsertNode);
  const deleteNodeFn = useServerFn(deleteNode);
  const upsertEdgeFn = useServerFn(upsertEdge);
  const deleteEdgeFn = useServerFn(deleteEdge);

  const qc = useQueryClient();

  // UI state
  const [selectedMotor, setSelectedMotor] = useState<any>(null);
  const [motorData, setMotorData] = useState<any>(null);
  const [openMotor, setOpenMotor] = useState(false);
  const [formMotor, setFormMotor] = useState<any>({ ...EMPTY_MOTOR });
  const [openNode, setOpenNode] = useState(false);
  const [formNode, setFormNode] = useState<any>({ ...EMPTY_NODE });
  const [openEdge, setOpenEdge] = useState(false);
  const [formEdge, setFormEdge] = useState<any>({ ...EMPTY_EDGE });

  // Queries & mutations
  const motorsQ = useQuery({ queryKey: ["motors"], queryFn: () => listFn() });
  const motors = (motorsQ.data ?? []) as any[];

  const loadMotor = async (motor: any) => {
    const data = await getFullFn({ data: { motorId: motor.id } });
    setSelectedMotor(motor);
    setMotorData(data);
  };

  const refreshMotor = async () => {
    if (!selectedMotor) return;
    const data = await getFullFn({ data: { motorId: selectedMotor.id } });
    setMotorData(data);
  };

  const motorMut = useMutation({
    mutationFn: (d: any) => upsertMotorFn({ data: d }),
    onSuccess: () => {
      toast.success("Motor salvo!");
      qc.invalidateQueries({ queryKey: ["motors"] });
      setOpenMotor(false);
      setFormMotor({ ...EMPTY_MOTOR });
    },
    onError: () => toast.error("Erro ao salvar motor."),
  });

  const deleteMotorMut = useMutation({
    mutationFn: (id: string) => deleteMotorFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Motor removido.");
      qc.invalidateQueries({ queryKey: ["motors"] });
      setSelectedMotor(null);
      setMotorData(null);
    },
    onError: () => toast.error("Erro ao remover."),
  });

  const nodeMut = useMutation({
    mutationFn: (d: any) => upsertNodeFn({ data: d }),
    onSuccess: () => {
      toast.success("Nó salvo!");
      refreshMotor();
      setOpenNode(false);
      setFormNode({ ...EMPTY_NODE });
    },
    onError: () => toast.error("Erro ao salvar nó."),
  });

  const deleteNodeMut = useMutation({
    mutationFn: (id: string) => deleteNodeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Nó removido.");
      refreshMotor();
    },
    onError: () => toast.error("Erro ao remover nó."),
  });

  const edgeMut = useMutation({
    mutationFn: (d: any) => upsertEdgeFn({ data: d }),
    onSuccess: () => {
      toast.success("Conexão salva!");
      refreshMotor();
      setOpenEdge(false);
      setFormEdge({ ...EMPTY_EDGE });
    },
    onError: () => toast.error("Erro ao salvar conexão."),
  });

  const deleteEdgeMut = useMutation({
    mutationFn: (id: string) => deleteEdgeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Conexão removida.");
      refreshMotor();
    },
    onError: () => toast.error("Erro ao remover conexão."),
  });

  const setM = (k: string, v: any) => setFormMotor((f: any) => ({ ...f, [k]: v }));
  const setN = (k: string, v: any) => setFormNode((f: any) => ({ ...f, [k]: v }));
  const setE = (k: string, v: any) => setFormEdge((f: any) => ({ ...f, [k]: v }));

  // Rendering
  if (selectedMotor && motorData) {
    const nodes = motorData.nodes as any[];
    const edges = motorData.edges as any[];
    const questions = nodes.filter((n) => n.type === "question");
    const results = nodes.filter((n) => n.type === "result");

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedMotor(null); setMotorData(null); }} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div>
              <h2 className="font-semibold">{selectedMotor.name}</h2>
              <p className="text-xs text-muted-foreground">{nodes.length} nós · {edges.length} conexões</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setFormNode({ ...EMPTY_NODE, motor_id: selectedMotor.id, type: "question" }); setOpenNode(true); }} className="gap-1"><Plus className="h-3 w-3" /> Pergunta</Button>
            <Button size="sm" variant="outline" onClick={() => { setFormNode({ ...EMPTY_NODE, motor_id: selectedMotor.id, type: "result" }); setOpenNode(true); }} className="gap-1"><Plus className="h-3 w-3" /> Resultado</Button>
            <Button size="sm" onClick={() => { setFormEdge({ ...EMPTY_EDGE, motor_id: selectedMotor.id }); setOpenEdge(true); }} className="gap-1"><Plus className="h-3 w-3" /> Conexão</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Perguntas */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Perguntas ({questions.length})</h3>
            {questions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pergunta.</p>}
            {questions.map((n) => (
              <Card key={n.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <div className="flex gap-1 mt-1">
                      {n.is_start && <Badge className="text-xs bg-primary text-primary-foreground">Início</Badge>}
                      <Badge variant="outline" className="text-xs">{n.question_type}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setFormNode({ ...n, motor_id: selectedMotor.id }); setOpenNode(true); }}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteNodeMut.mutate(n.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {edges.filter((e) => e.from_node_id === n.id).map((e) => {
                    const target = nodes.find((nd) => nd.id === e.to_node_id);
                    return (
                      <div key={e.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ChevronRight className="h-3 w-3 flex-shrink-0" />
                        <span className="font-medium text-foreground">{e.label}</span>
                        <span>→</span>
                        <span className="truncate">{target?.title ?? "?"}</span>
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive ml-auto flex-shrink-0" onClick={() => deleteEdgeMut.mutate(e.id)}><Trash2 className="h-2.5 w-2.5" /></Button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
          {/* Resultados */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resultados ({results.length})</h3>
            {results.length === 0 && <p className="text-sm text-muted-foreground">Nenhum resultado.</p>}
            {results.map((n) => (
              <Card key={n.id} className="p-3 border-emerald-200">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium truncate text-emerald-700">{n.title}</p>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setFormNode({ ...n, motor_id: selectedMotor.id }); setOpenNode(true); }}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteNodeMut.mutate(n.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                {n.processo && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.processo}</p>}
              </Card>
            ))}
          </div>
        </div>

        {/* Node Dialog */}
        <Dialog open={openNode} onOpenChange={setOpenNode}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{formNode.id ? "Editar" : "Novo"} {formNode.type === "question" ? "Pergunta" : "Resultado"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={formNode.title} onChange={(e) => setN("title", e.target.value)} placeholder={formNode.type === "question" ? "Ex: O cliente já foi beneficiário?" : "Ex: Refiliação com pendência"} /></div>
              {formNode.type === "question" && (
                <>
                  <div><Label>Tipo de resposta</Label><Select value={formNode.question_type} onValueChange={(v) => setN("question_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes_no">Sim / Não</SelectItem><SelectItem value="multiple">Múltipla escolha</SelectItem><SelectItem value="list">Lista de opções</SelectItem></SelectContent></Select></div>
                  <div className="flex items-center gap-2"><Switch checked={formNode.is_start} onCheckedChange={(v) => setN("is_start", v)} /><Label>Pergunta inicial do fluxo</Label></div>
                </>
              )}
              {formNode.type === "result" && (
                <>
                  <div><Label>Processo a seguir</Label><Textarea value={formNode.processo} onChange={(e) => setN("processo", e.target.value)} rows={3} /></div>
                  <div><Label>Mensagem recomendada</Label><Textarea value={formNode.mensagem} onChange={(e) => setN("mensagem", e.target.value)} rows={3} /></div>
                  <div><Label>Documentos necessários</Label><Textarea value={formNode.documentos} onChange={(e) => setN("documentos", e.target.value)} rows={2} /></div>
                  <div><Label>Orientações internas</Label><Textarea value={formNode.orientacoes} onChange={(e) => setN("orientacoes", e.target.value)} rows={2} /></div>
                  <div><Label>Observações</Label><Textarea value={formNode.observacoes} onChange={(e) => setN("observacoes", e.target.value)} rows={2} /></div>
                </>
              )}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpenNode(false)}>Cancelar</Button><Button onClick={() => nodeMut.mutate(formNode)} disabled={!formNode.title || nodeMut.isPending}>{nodeMut.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edge Dialog */}
        <Dialog open={openEdge} onOpenChange={setOpenEdge}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova Conexão</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>De (pergunta)</Label><Select value={formEdge.from_node_id} onValueChange={(v) => setE("from_node_id", v)}><SelectTrigger><SelectValue placeholder="Selecione a pergunta" /></SelectTrigger><SelectContent>{questions.map((n) => (<SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>))}</SelectContent></Select></div>
              <div><Label>Resposta (label do botão)</Label><Input value={formEdge.label} onChange={(e) => setE("label", e.target.value)} placeholder="Ex: Sim, Não, Menos de 12 meses..." /></div>
              <div><Label>Para (próxima pergunta ou resultado)</Label><Select value={formEdge.to_node_id} onValueChange={(v) => setE("to_node_id", v)}><SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger><SelectContent>{questions.map((n) => (<SelectItem key={n.id} value={n.id}>❓ {n.title}</SelectItem>))}{results.map((n) => (<SelectItem key={n.id} value={n.id}>✅ {n.title}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpenEdge(false)}>Cancelar</Button><Button onClick={() => edgeMut.mutate(formEdge)} disabled={!formEdge.from_node_id || !formEdge.to_node_id || !formEdge.label || edgeMut.isPending}>{edgeMut.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List of Motors
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-semibold">Motores de Decisão</h2><p className="text-sm text-muted-foreground">Crie e gerencie fluxos de decisão para os atendentes.</p></div>
        <Button onClick={() => { setFormMotor({ ...EMPTY_MOTOR }); setOpenMotor(true); }} className="gap-2"><Plus className="h-4 w-4" /> Novo Motor</Button>
      </div>
      {motors.length === 0 && <Card className="p-10 text-center text-muted-foreground">Nenhum motor cadastrado ainda.</Card>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {motors.map((m) => (
          <Card key={m.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-semibold truncate">{m.name}</h3>{m.category && <Badge variant="outline" className="text-xs mt-1">{m.category}</Badge>}</div><div className="flex gap-1 flex-shrink-0"><Badge className={m.is_active ? "bg-emerald-100 text-emerald-700 text-xs" : "bg-muted text-muted-foreground text-xs"}>{m.is_active ? "Ativo" : "Inativo"}</Badge></div></div>
            {m.description && <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>}
            <div className="flex gap-2"><Button size="sm" onClick={() => loadMotor(m)} className="gap-1 flex-1"><Zap className="h-3 w-3" /> Gerenciar fluxo</Button><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setFormMotor({ ...m }); setOpenMotor(true); }}><Pencil className="h-3 w-3" /></Button><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMotorMut.mutate(m.id)}><Trash2 className="h-3 w-3" /></Button></div>
          </Card>
        ))}
      </div>
      <Dialog open={openMotor} onOpenChange={setOpenMotor}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{formMotor.id ? "Editar Motor" : "Novo Motor de Decisão"}</DialogTitle></DialogHeader>
          <div className="space-y-3"><div><Label>Nome</Label><Input value={formMotor.name} onChange={(e) => setM("name", e.target.value)} placeholder="Ex: Processo de Refiliação" /></div><div><Label>Categoria</Label><Input value={formMotor.category} onChange={(e) => setM("category", e.target.value)} placeholder="Ex: Financeiro, Cadastro..." /></div><div><Label>Descrição</Label><Textarea value={formMotor.description} onChange={(e) => setM("description", e.target.value)} rows={2} placeholder="Descreva quando usar este motor..." /></div><div className="flex items-center gap-2"><Switch checked={formMotor.is_active} onCheckedChange={(v) => setM("is_active", v)} /><Label>Ativo (visível para atendentes)</Label></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setOpenMotor(false)}>Cancelar</Button><Button onClick={() => motorMut.mutate(formMotor)} disabled={!formMotor.name || motorMut.isPending}>{motorMut.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
