import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMessages, upsertMessage, deleteMessage, reorderMessage } from "@/lib/messages.functions";
import { listCategories, upsertCategory } from "@/lib/taxonomy.functions";
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

interface Cat { id: string; name: string; slug: string; parent_id: string | null; position: number; }

export function MessagesTab() {
  const list = useServerFn(listMessages);
  const upsert = useServerFn(upsertMessage);
  const del = useServerFn(deleteMessage);
  const reorder = useServerFn(reorderMessage);
  const catFn = useServerFn(listCategories);
  const upsertCatFn = useServerFn(upsertCategory);
  const genAI = useServerFn(simulatorChat);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["messages"], queryFn: () => list({}) });
  const catsQ = useQuery({ queryKey: ["cats", "message"], queryFn: () => catFn({ data: { scope: "message" } }) });

  const cats = (catsQ.data ?? []) as Cat[];
  const parents = cats.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => cats.filter((c) => c.parent_id === id);

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

  // ---- Fluxo de Atendimento: reordenar etapas (categorias) ----
  const moveCategory = async (sorted: Cat[], idx: number, dir: -1 | 1) => {
    const arr = [...sorted];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((c, i) =>
      upsertCatFn({ data: { id: c.id, scope: "message", name: c.name, slug: c.slug, parent_id: c.parent_id, position: i * 10 } })
    ));
    qc.invalidateQueries({ queryKey: ["cats", "message"] });
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
  const sortedCats = [...parents].sort((a, b) => (a.position - b.position) || a.name.localeCompare(b.name));
  const semEtapa = allMessages.some((m) => !m.category_id);

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
            Organize a ordem das etapas (categorias) e das mensagens dentro de cada uma. É essa ordem que aparece no modo "Fluxo de Atendimento" da tela pública de Mensagens.
          </p>

          {sortedCats.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada ainda. Crie as etapas na aba Categorias primeiro (ex: Apresentação, Documentos, Pagamento, Fidelidade, Fechamento).</p>
          )}

          {sortedCats.map((cat, catIdx) => {
            const catMessages = allMessages
              .filter((m) => m.category_id === cat.id)
              .slice()
              .sort((a, b) => (a.position - b.position) || a.title.localeCompare(b.title));
            return (
              <Card key={cat.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{cat.name}</h4>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={catIdx === 0}
                      onClick={() => moveCategory(sortedCats, catIdx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={catIdx === sortedCats.length - 1}
                      onClick={() => moveCategory(sortedCats, catIdx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {catMessages.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma mensagem nesta etapa ainda.</p>}
                <div className="space-y-1">
                  {catMessages.map((m, mIdx) => (
                    <div key={m.id} className="flex items-center gap-2 p-2 rounded-md border border-border/60">
                      <div className="flex flex-col shrink-0">
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={mIdx === 0}
                          onClick={() => moveMessage(catMessages, mIdx, -1)}><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={mIdx === catMessages.length - 1}
                          onClick={() => moveMessage(catMessages, mIdx, 1)}><ArrowDown className="h-3 w-3" /></Button>
                      </div>
                      {m.shortcut && <Badge variant="outline" className="shrink-0">/{m.shortcut}</Badge>}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.internal_note || "sem descrição de uso ainda"}</p>
                      </div>
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

          {semEtapa && (
            <p className="text-xs text-muted-foreground">
              Existem mensagens sem categoria — elas continuam aparecendo normalmente na Biblioteca, mas só entram no Fluxo quando você definir uma categoria pra elas (aba Biblioteca → editar mensagem).
            </p>
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
                  <Label>Categoria (etapa)</Label>
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
              <div><Label>Observação interna (onde/quando usar)</Label><Input value={edit.internal_note} onChange={(e) => setEdit({ ...edit, internal_note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => mUp.mutate()} disabled={mUp.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
