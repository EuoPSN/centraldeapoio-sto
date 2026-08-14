import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMessages, upsertMessage, deleteMessage, reorderMessage } from "@/lib/messages.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { listFlowStages, upsertFlowStage, deleteFlowStage, setMessageFlowStage } from "@/lib/messageflow.functions";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pencil, Plus, Trash2, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Cat { id: string; name: string; parent_id: string | null; }
interface Stage { id: string; name: string; position: number; }

export function MessagesTab() {
  const list = useServerFn(listMessages);
  const upsert = useServerFn(upsertMessage);
  const del = useServerFn(deleteMessage);
  const reorder = useServerFn(reorderMessage);
  const catFn = useServerFn(listCategories);
  const stagesFn = useServerFn(listFlowStages);
  const upsertStageFn = useServerFn(upsertFlowStage);
  const delStageFn = useServerFn(deleteFlowStage);
  const setStageFn = useServerFn(setMessageFlowStage);
  const genAI = useServerFn(simulatorChat);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["messages"], queryFn: () => list({}) });
  const catsQ = useQuery({ queryKey: ["cats", "message"], queryFn: () => catFn({ data: { scope: "message" } }) });
  const stagesQ = useQuery({ queryKey: ["flow-stages"], queryFn: () => stagesFn({}) });

  const cats = (catsQ.data ?? []) as Cat[];
  const parents = cats.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => cats.filter((c) => c.parent_id === id);
  const stages = ((stagesQ.data ?? []) as Stage[]).slice().sort((a, b) => a.position - b.position);

  const [edit, setEdit] = useState<null | {
    id?: string; category_id: string; subcategory_id: string; title: string; content: string; internal_note: string; shortcut: string;
  }>(null);

  const mUp = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id,
      category_id: edit!.category_id || null,
      subcategory_id: edit!.subcategory_id || null,
      title: edit!.title,
      content: edit!.content,
      internal_note: edit!.internal_note || null,
      tags: [],
      position: 0,
      shortcut: edit!.shortcut || null,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["messages"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removida."); qc.invalidateQueries({ queryKey: ["messages"] }); },
  });

  // ---- Fluxo de Atendimento: etapas (independentes de Categoria) ----
  const [newStageName, setNewStageName] = useState("");
  const addStage = async () => {
    if (!newStageName.trim()) return;
    await upsertStageFn({ data: { name: newStageName.trim(), position: stages.length * 10 } });
    setNewStageName("");
    qc.invalidateQueries({ queryKey: ["flow-stages"] });
  };
  const renameStage = async (stage: Stage, name: string) => {
    if (!name.trim() || name === stage.name) return;
    await upsertStageFn({ data: { id: stage.id, name: name.trim(), position: stage.position } });
    qc.invalidateQueries({ queryKey: ["flow-stages"] });
  };
  const removeStage = async (stage: Stage) => {
    if (!confirm(`Excluir a etapa "${stage.name}"? As mensagens dela voltam para "sem etapa" (continuam na Biblioteca normalmente).`)) return;
    await delStageFn({ data: { id: stage.id } });
    qc.invalidateQueries({ queryKey: ["flow-stages"] });
    qc.invalidateQueries({ queryKey: ["messages"] });
  };
  const moveStage = async (idx: number, dir: -1 | 1) => {
    const arr = [...stages];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((s, i) => upsertStageFn({ data: { id: s.id, name: s.name, position: i * 10 } })));
    qc.invalidateQueries({ queryKey: ["flow-stages"] });
  };

  // ---- Fluxo de Atendimento: reordenar mensagens dentro de uma etapa ----
  const moveMessage = async (msgs: any[], idx: number, dir: -1 | 1) => {
    const arr = [...msgs];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((m, i) => reorder({ data: { id: m.id, position: i * 10 } })));
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  // ---- Fluxo de Atendimento: atribuir/mover mensagem entre etapas ----
  const assignStage = async (messageId: string, stageId: string | null) => {
    await setStageFn({ data: { id: messageId, flow_stage_id: stageId, position: 0 } });
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  // ---- Fluxo de Atendimento: gerar "quando usar" com IA ----
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const generateDescription = async (m: any) => {
    setGeneratingId(m.id);
    try {
      const prompt = `Você escreve descrições curtas (uma frase, até 18 palavras) indicando a um atendente QUANDO ele deve usar uma mensagem de script de atendimento ao cliente.
Título da mensagem: "${m.title}"
Conteúdo da mensagem: "${m.content}"
Responda APENAS com a frase da descrição, sem aspas, sem markdown, sem texto adicional.`;
      const { content } = await genAI({ data: { messages: [{ role: "user", content: prompt }], model: "google/gemini-2.5-flash" } });
      const desc = content.replace(/^"+|"+$/g, "").trim();
      await upsert({ data: {
        id: m.id, category_id: m.category_id, subcategory_id: m.subcategory_id,
        title: m.title, content: m.content, internal_note: desc, tags: m.tags ?? [],
        position: m.position ?? 0, shortcut: m.shortcut,
      } });
      toast.success("Descrição gerada!");
      qc.invalidateQueries({ queryKey: ["messages"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar descrição.");
    } finally {
      setGeneratingId(null);
    }
  };

  const allMessages = (q.data ?? []) as any[];
  const semEtapa = allMessages.filter((m) => !m.flow_stage_id);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="biblioteca">
        <TabsList>
          <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Atendimento</TabsTrigger>
        </TabsList>

        <TabsContent value="biblioteca" className="mt-4">
          <Card className="overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h3 className="font-semibold">Mensagens ({q.data?.length ?? 0})</h3>
              <Button size="sm" className="gap-2" onClick={() => setEdit({ category_id: "", subcategory_id: "", title: "", content: "", internal_note: "", shortcut: "" })}>
                <Plus className="h-4 w-4" /> Nova mensagem
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Título</TableHead><TableHead>Atalho</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {allMessages.map((m: { id: string; title: string; category: { name: string } | null; subcategory: { name: string } | null; content: string; internal_note: string | null; category_id: string | null; subcategory_id: string | null; shortcut: string | null; }) => (
                  <TableRow key={m.id}>
                    <TableCell><Badge variant="secondary">{m.category?.name ?? "—"}{m.subcategory ? ` · ${m.subcategory.name}` : ""}</Badge></TableCell>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>{m.shortcut ? <Badge variant="outline">/{m.shortcut}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setEdit({
                        id: m.id, category_id: m.category_id ?? "", subcategory_id: m.subcategory_id ?? "",
                        title: m.title, content: m.content, internal_note: m.internal_note ?? "", shortcut: m.shortcut ?? "",
                      })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && mDel.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Etapas do fluxo de atendimento (Apresentação, Documentos, Pagamento...) — independentes das Categorias da Biblioteca. Organize a ordem das etapas e das mensagens dentro delas.
          </p>

          <div className="flex gap-2 max-w-md">
            <Input placeholder="Nome da nova etapa (ex: Apresentação)" value={newStageName} onChange={(e) => setNewStageName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addStage(); }} />
            <Button size="sm" className="gap-1 shrink-0" onClick={addStage}><Plus className="h-4 w-4" /> Adicionar etapa</Button>
          </div>

          {stages.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma etapa criada ainda. Adicione a primeira acima.</p>
          )}

          {stages.map((stage, stageIdx) => {
            const stageMessages = allMessages
              .filter((m) => m.flow_stage_id === stage.id)
              .slice()
              .sort((a, b) => (a.position - b.position) || a.title.localeCompare(b.title));
            return (
              <Card key={stage.id} className="p-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <Input defaultValue={stage.name} className="h-8 font-semibold max-w-[240px]"
                    onBlur={(e) => renameStage(stage, e.target.value)} />
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={stageIdx === 0}
                      onClick={() => moveStage(stageIdx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={stageIdx === stages.length - 1}
                      onClick={() => moveStage(stageIdx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeStage(stage)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {stageMessages.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma mensagem nesta etapa ainda — atribua abaixo, na lista "sem etapa".</p>}
                <div className="space-y-1">
                  {stageMessages.map((m, mIdx) => (
                    <div key={m.id} className="flex items-center gap-2 p-2 rounded-md border border-border/60">
                      <div className="flex flex-col shrink-0">
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={mIdx === 0}
                          onClick={() => moveMessage(stageMessages, mIdx, -1)}><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={mIdx === stageMessages.length - 1}
                          onClick={() => moveMessage(stageMessages, mIdx, 1)}><ArrowDown className="h-3 w-3" /></Button>
                      </div>
                      {m.shortcut && <Badge variant="outline" className="shrink-0">/{m.shortcut}</Badge>}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.internal_note || "sem descrição de uso ainda"}</p>
                      </div>
                      <Select value={stage.id} onValueChange={(v) => assignStage(m.id, v === "none" ? null : v)}>
                        <SelectTrigger className="h-7 w-32 text-xs shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">sem etapa</SelectItem>
                          {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="gap-1 shrink-0" disabled={generatingId === m.id}
                        onClick={() => generateDescription(m)}>
                        <Sparkles className="h-3.5 w-3.5" /> {generatingId === m.id ? "Gerando..." : "Gerar descrição"}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}

          {semEtapa.length > 0 && (
            <Card className="p-3">
              <h4 className="font-semibold mb-2 text-muted-foreground">Sem etapa ({semEtapa.length})</h4>
              <div className="space-y-1">
                {semEtapa.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 p-2 rounded-md border border-border/60">
                    {m.shortcut && <Badge variant="outline" className="shrink-0">/{m.shortcut}</Badge>}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                    </div>
                    <Select value="none" onValueChange={(v) => assignStage(m.id, v === "none" ? null : v)}>
                      <SelectTrigger className="h-7 w-40 text-xs shrink-0"><SelectValue placeholder="Atribuir etapa..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">sem etapa</SelectItem>
                        {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar mensagem" : "Nova mensagem"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={edit.category_id || "none"} onValueChange={(v) => setEdit({ ...edit, category_id: v === "none" ? "" : v, subcategory_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— sem categoria —</SelectItem>
                      {parents.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subcategoria</Label>
                  <Select value={edit.subcategory_id || "none"} onValueChange={(v) => setEdit({ ...edit, subcategory_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— nenhuma —</SelectItem>
                      {edit.category_id && childrenOf(edit.category_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Título</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
                <div>
                  <Label>Atalho no simulador (opcional)</Label>
                  <Input value={edit.shortcut} onChange={(e) => setEdit({ ...edit, shortcut: e.target.value })} placeholder="ex: ola (sem a barra)" />
                </div>
              </div>
              <div><Label>Conteúdo</Label><Textarea rows={8} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></div>
              <div><Label>Observação interna</Label><Input value={edit.internal_note} onChange={(e) => setEdit({ ...edit, internal_note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => mUp.mutate()} disabled={mUp.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
