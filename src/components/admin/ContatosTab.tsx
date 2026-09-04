import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listContatos, upsertContato, deleteContato } from "@/lib/contatos.functions";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Tipo = "cartao_de_todos" | "clinica_amor_saude" | "outros";
interface ContatoRow {
  id: string; tipo: Tipo; nome_regiao: string; endereco: string | null;
  contato1: string | null; contato2: string | null; contato3: string | null; position: number;
}

const TIPOS: { value: Tipo; label: string }[] = [
  { value: "cartao_de_todos", label: "Cartão de Todos" },
  { value: "clinica_amor_saude", label: "Clínica Amor Saúde" },
  { value: "outros", label: "Outros Endereços" },
];

export function ContatosTab() {
  return (
    <Tabs defaultValue="cartao_de_todos">
      <TabsList>
        {TIPOS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
      </TabsList>
      {TIPOS.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4">
          <ContatosSubTab tipo={t.value} label={t.label} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ContatosSubTab({ tipo, label }: { tipo: Tipo; label: string }) {
  const list = useServerFn(listContatos);
  const upsert = useServerFn(upsertContato);
  const del = useServerFn(deleteContato);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["contatos"], queryFn: () => list({}) });
  const rows = ((q.data ?? []) as ContatoRow[]).filter((r) => r.tipo === tipo).sort((a, b) => a.position - b.position);

  const [edit, setEdit] = useState<null | {
    id?: string; nome_regiao: string; endereco: string; contato1: string; contato2: string; contato3: string;
  }>(null);

  // ---- Preencher com IA ----
  type Draft = { nome_regiao: string; endereco: string; contato1: string; contato2: string; contato3: string; selected: boolean };
  const genAI = useServerFn(simulatorChat);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiPreview, setAiPreview] = useState<Draft[]>([]);

  const generateFromAI = async () => {
    if (!aiInput.trim()) return;
    setAiGenerating(true);
    try {
      const prompt = `Você organiza uma lista de contatos e endereços de unidades/clínicas do Cartão de Todos, a partir de texto livre enviado por um administrador. O contexto é especificamente "${label}".
Extraia cada unidade/endereço mencionado e devolva um array JSON, um objeto por item, no formato exato:
[{"nome_regiao": "...", "endereco": "...", "contato1": "...", "contato2": "...", "contato3": "..."}]

Regras:
- "nome_regiao": nome da unidade/região (ex: "${label} Justinópolis").
- "endereco": endereço completo mencionado. Use "" se não houver.
- "contato1", "contato2", "contato3": até 3 telefones/whatsapp mencionados para essa unidade, um em cada campo, na ordem em que aparecem. Use "" para os que não existirem.
- Responda APENAS com o array JSON, sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: aiInput }], model: "google/gemini-2.5-flash" } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: Draft[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({ nome_regiao: it.nome_regiao || "", endereco: it.endereco || "", contato1: it.contato1 || "", contato2: it.contato2 || "", contato3: it.contato3 || "", selected: true }))
        .filter((it: Draft) => it.nome_regiao);
      if (items.length === 0) { toast.error("A IA não conseguiu identificar nenhuma unidade no texto enviado."); return; }
      setAiPreview(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA.");
    } finally {
      setAiGenerating(false);
    }
  };

  const importSelected = async () => {
    const toImport = aiPreview.filter((i) => i.selected);
    if (toImport.length === 0) return;
    setAiImporting(true);
    try {
      for (const item of toImport) {
        await upsert({ data: { tipo, nome_regiao: item.nome_regiao, endereco: item.endereco || null, contato1: item.contato1 || null, contato2: item.contato2 || null, contato3: item.contato3 || null, position: 0 } });
      }
      toast.success(`${toImport.length} item(ns) importado(s)!`);
      qc.invalidateQueries({ queryKey: ["contatos"] });
      setAiOpen(false); setAiInput(""); setAiPreview([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setAiImporting(false);
    }
  };

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, tipo, nome_regiao: edit!.nome_regiao,
      endereco: edit!.endereco || null, contato1: edit!.contato1 || null,
      contato2: edit!.contato2 || null, contato3: edit!.contato3 || null, position: 0,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["contatos"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["contatos"] }); },
  });

  const moveRow = async (idx: number, dir: -1 | 1) => {
    const arr = [...rows];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((r, i) => upsert({ data: { id: r.id, tipo: r.tipo, nome_regiao: r.nome_regiao, endereco: r.endereco, contato1: r.contato1, contato2: r.contato2, contato3: r.contato3, position: i * 10 } })));
    qc.invalidateQueries({ queryKey: ["contatos"] });
  };

  const openEdit = (r: ContatoRow) => setEdit({
    id: r.id, nome_regiao: r.nome_regiao, endereco: r.endereco ?? "",
    contato1: r.contato1 ?? "", contato2: r.contato2 ?? "", contato3: r.contato3 ?? "",
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">{label} ({rows.length})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)}>
            <Sparkles className="h-4 w-4" /> Preencher com IA
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setEdit({ nome_regiao: "", endereco: "", contato1: "", contato2: "", contato3: "" })}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Região</TableHead><TableHead>Endereço</TableHead><TableHead>Contatos</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.nome_regiao}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.endereco || "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{[r.contato1, r.contato2, r.contato3].filter(Boolean).join(" · ") || "—"}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => moveRow(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === rows.length - 1} onClick={() => moveRow(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum cadastrado ainda.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar" : "Novo"} — {label}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Nome da região</Label><Input value={edit.nome_regiao} onChange={(e) => setEdit({ ...edit, nome_regiao: e.target.value })} placeholder={`Ex: ${label} Justinópolis`} /></div>
              <div><Label>Endereço</Label><Input value={edit.endereco} onChange={(e) => setEdit({ ...edit, endereco: e.target.value })} /></div>
              <div><Label>Contato 1</Label><Input value={edit.contato1} onChange={(e) => setEdit({ ...edit, contato1: e.target.value })} placeholder="(31) 99999-0000" /></div>
              <div><Label>Contato 2 (opcional)</Label><Input value={edit.contato2} onChange={(e) => setEdit({ ...edit, contato2: e.target.value })} /></div>
              <div><Label>Contato 3 (opcional)</Label><Input value={edit.contato3} onChange={(e) => setEdit({ ...edit, contato3: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={(v) => { setAiOpen(v); if (!v) { setAiPreview([]); setAiInput(""); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preencher {label} com IA</DialogTitle></DialogHeader>
          {aiPreview.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cole a lista de unidades, endereços e telefones (pode ser texto corrido, bagunçado). A IA organiza.</p>
              <Textarea rows={12} value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={`Ex:
${label} Justinópolis - Rua Exemplo, 100 - Justinópolis - (31) 99999-0000 / (31) 3333-0000`} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Confira antes de importar.</p>
              <Table>
                <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Região</TableHead><TableHead>Endereço</TableHead><TableHead>Contatos</TableHead></TableRow></TableHeader>
                <TableBody>
                  {aiPreview.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell><input type="checkbox" checked={item.selected} onChange={(e) => setAiPreview((prev) => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))} /></TableCell>
                      <TableCell className="font-medium">{item.nome_regiao}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.endereco || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{[item.contato1, item.contato2, item.contato3].filter(Boolean).join(" · ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            {aiPreview.length === 0 ? (
              <Button onClick={generateFromAI} disabled={aiGenerating || !aiInput.trim()} className="gap-2"><Sparkles className="h-4 w-4" /> {aiGenerating ? "Gerando..." : "Gerar com IA"}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAiPreview([])}>Voltar</Button>
                <Button onClick={importSelected} disabled={aiImporting || aiPreview.every((p) => !p.selected)}>{aiImporting ? "Importando..." : `Importar ${aiPreview.filter((p) => p.selected).length} item(ns)`}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
