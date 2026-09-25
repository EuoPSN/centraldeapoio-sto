import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMyDrafts, upsertMyDraft, deleteMyDraft } from "@/lib/messagedrafts.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PenLine, Copy, Trash2, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/criar-script")({
  component: CriarScriptPage,
});

interface Cat { id: string; name: string; parent_id: string | null; }
interface DraftRow {
  id: string; titulo: string; conteudo: string; status: "pendente" | "aprovado" | "rejeitado";
  nota_revisao: string | null; category?: { name: string } | null; subcategory?: { name: string } | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = { pendente: "Em análise", aprovado: "Aprovado", rejeitado: "Rejeitado" };
const STATUS_CLASS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  aprovado: "bg-emerald-100 text-emerald-800",
  rejeitado: "bg-red-100 text-red-800",
};

function CriarScriptPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyDrafts);
  const upsertFn = useServerFn(upsertMyDraft);
  const delFn = useServerFn(deleteMyDraft);
  const catFn = useServerFn(listCategories);

  const draftsQ = useQuery({ queryKey: ["my-drafts"], queryFn: () => listFn({}) });
  const catsQ = useQuery({ queryKey: ["cats", "message"], queryFn: () => catFn({ data: { scope: "message" } }) });
  const drafts = (draftsQ.data ?? []) as DraftRow[];
  const cats = (catsQ.data ?? []) as Cat[];
  const parents = cats.filter((c) => !c.parent_id);

  const emptyForm = { id: undefined as string | undefined, titulo: "", conteudo: "", category_id: "", subcategory_id: "" };
  const [form, setForm] = useState(emptyForm);
  const subcats = cats.filter((c) => c.parent_id === form.category_id);

  const upsertMut = useMutation({
    mutationFn: () => upsertFn({ data: {
      id: form.id, titulo: form.titulo, conteudo: form.conteudo,
      category_id: form.category_id || null, subcategory_id: form.subcategory_id || null,
    } }),
    onSuccess: () => {
      toast.success(form.id ? "Atualizado." : "Enviado pra análise!");
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["my-drafts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["my-drafts"] }); },
  });

  // ---- Gerar com IA ----
  const genAI = useServerFn(simulatorChat);
  const [genDesc, setGenDesc] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genItems, setGenItems] = useState<Array<{ title: string; content: string; internal_note: string }>>([]);

  const gerarComIA = async () => {
    if (!genDesc.trim()) return;
    setGenLoading(true);
    try {
      const prompt = `Você escreve mensagens de script de atendimento ao cliente via WhatsApp, para o Cartão de Todos (cartão de descontos em saúde).

O texto abaixo é uma descrição livre do que a pessoa precisa. Crie um ou mais scripts de mensagem prontos pra copiar e enviar ao cliente.
Cada item deve ter:
- "title": título curto (poucas palavras) pra identificar o script.
- "content": o texto da mensagem em si, pronto pra uso real (pode usar *negrito* estilo WhatsApp).
- "internal_note": uma frase curta dizendo quando usar essa mensagem.
Responda APENAS com um array JSON, no formato exato: [{"title":"...","content":"...","internal_note":"..."}]. Sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: genDesc }], model: "google/gemini-2.5-flash" } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({ title: it.title || "", content: it.content || "", internal_note: it.internal_note || "" }))
        .filter((it: any) => it.title && it.content);
      if (items.length === 0) { toast.error("A IA não conseguiu gerar nada a partir da descrição."); return; }
      setGenItems(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA.");
    } finally {
      setGenLoading(false);
    }
  };

  const usarSugestao = (item: { title: string; content: string }) => {
    setForm((prev) => ({ ...prev, titulo: item.title, conteudo: item.content }));
    toast.success("Carregado no formulário abaixo — revise e envie pra análise.");
  };

  const copiar = async (texto: string) => {
    await navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };

  const editar = (d: DraftRow) => {
    setForm({ id: d.id, titulo: d.titulo, conteudo: d.conteudo, category_id: (d as any).category_id ?? "", subcategory_id: (d as any).subcategory_id ?? "" });
  };

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <PenLine className="h-7 w-7 text-primary" /> Criar Script
        </h1>
        <p className="text-muted-foreground mt-1">
          Escreva uma mensagem nova e mande pra análise. Um admin revisa antes de ela virar um script oficial —
          enquanto isso, ela fica só aqui, mas você já pode copiar e usar.
        </p>
      </header>

      <Card className="p-5 space-y-3 bg-primary/5 border-primary/20">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Gerar com IA</h3>
        <p className="text-sm text-muted-foreground">Descreva o que você precisa (tom, assunto, situação) — a IA monta o script pra você revisar antes de enviar.</p>
        <Textarea rows={3} value={genDesc} onChange={(e) => setGenDesc(e.target.value)}
          placeholder="Ex: mensagem explicando por que a cobrança veio em duplicidade e pedindo desculpas pelo transtorno" />
        <div className="flex justify-end">
          <Button size="sm" onClick={gerarComIA} disabled={genLoading || !genDesc.trim()} className="gap-2">
            <Sparkles className="h-4 w-4" /> {genLoading ? "Gerando..." : "Gerar com IA"}
          </Button>
        </div>
        {genItems.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/60">
            {genItems.map((item, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{item.content}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => usarSugestao(item)}>Usar este</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">{form.id ? "Editando rascunho" : "Novo rascunho"}</h3>
        <div>
          <Label>Título</Label>
          <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Resposta pra dúvida sobre carência" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoria</Label>
            <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v, subcategory_id: "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {parents.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subcategoria</Label>
            <Select value={form.subcategory_id || "none"} onValueChange={(v) => setForm({ ...form, subcategory_id: v === "none" ? "" : v })} disabled={subcats.length === 0}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem subcategoria</SelectItem>
                {subcats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Conteúdo da mensagem</Label>
          <Textarea rows={6} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} placeholder="Escreva a mensagem exatamente como seria enviada ao cliente..." />
        </div>
        <div className="flex justify-end gap-2">
          {form.id && <Button variant="outline" onClick={() => setForm(emptyForm)}>Cancelar edição</Button>}
          <Button onClick={() => upsertMut.mutate()} disabled={!form.titulo.trim() || !form.conteudo.trim() || upsertMut.isPending}>
            {form.id ? "Salvar alterações" : "Enviar pra análise"}
          </Button>
        </div>
      </Card>

      <div>
        <h3 className="font-semibold mb-3">Meus scripts ({drafts.length})</h3>
        <div className="space-y-3">
          {drafts.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{d.titulo}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <Badge className={STATUS_CLASS[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                    {d.category?.name && <Badge variant="outline">{d.category.name}</Badge>}
                    {d.subcategory?.name && <Badge variant="outline">{d.subcategory.name}</Badge>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => copiar(d.conteudo)}><Copy className="h-4 w-4" /></Button>
                  {d.status === "pendente" && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => editar(d)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("Excluir este rascunho?") && delMut.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-md bg-muted/40 border border-border p-3 text-sm whitespace-pre-wrap">{d.conteudo}</div>
              {d.status === "rejeitado" && d.nota_revisao && (
                <p className="text-xs text-red-700 mt-2">Motivo: {d.nota_revisao}</p>
              )}
            </Card>
          ))}
          {drafts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum script enviado ainda.</p>}
        </div>
      </div>
    </div>
  );
}
