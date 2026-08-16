import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listChangelog, upsertChangelogEntry, deleteChangelogEntry } from "@/lib/changelog.functions";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Entry { id: string; title: string; summary: string; published: boolean; created_at: string; }
type DraftItem = { title: string; summary: string; selected: boolean };

export function ChangelogTab() {
  const listFn = useServerFn(listChangelog);
  const upsertFn = useServerFn(upsertChangelogEntry);
  const delFn = useServerFn(deleteChangelogEntry);
  const genAI = useServerFn(simulatorChat);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["changelog"], queryFn: () => listFn({}) });
  const entries = (q.data ?? []) as Entry[];

  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const generate = async () => {
    if (!notes.trim()) return;
    setGenerating(true);
    try {
      const prompt = `Você escreve entradas de changelog/newsletter para os usuários internos de um sistema chamado Central de Apoio (Cartão de Todos).
A partir das notas abaixo — que podem estar em texto corrido, bagunçadas, com vários assuntos misturados — separe em um ou mais itens de novidade.
Cada item deve ter:
- "title": título curto e chamativo (até 8 palavras)
- "summary": resumo em 1 ou 2 frases, tom animado mas profissional, explicando o que mudou e por que é bom pro usuário.
Responda APENAS com um array JSON, no formato exato: [{"title":"...","summary":"..."}]. Sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: notes }], model: "google/gemini-2.5-flash" } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: DraftItem[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({ title: it.title || "", summary: it.summary || "", selected: true }))
        .filter((it: DraftItem) => it.title && it.summary);
      if (items.length === 0) { toast.error("A IA não conseguiu identificar itens nas notas enviadas."); return; }
      setDrafts(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA.");
    } finally {
      setGenerating(false);
    }
  };

  const publishSelected = async () => {
    const toPublish = drafts.filter((d) => d.selected);
    if (toPublish.length === 0) return;
    setPublishing(true);
    try {
      for (const item of toPublish) {
        await upsertFn({ data: { title: item.title, summary: item.summary, published: true } });
      }
      toast.success(`${toPublish.length} novidade(s) publicada(s)!`);
      qc.invalidateQueries({ queryKey: ["changelog"] });
      setDrafts([]); setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar.");
    } finally {
      setPublishing(false);
    }
  };

  const togglePublished = async (entry: Entry) => {
    await upsertFn({ data: { id: entry.id, title: entry.title, summary: entry.summary, published: !entry.published } });
    qc.invalidateQueries({ queryKey: ["changelog"] });
  };

  const saveEdit = async (entry: Entry, title: string, summary: string) => {
    await upsertFn({ data: { id: entry.id, title, summary, published: entry.published } });
    setEditId(null);
    qc.invalidateQueries({ queryKey: ["changelog"] });
  };

  const removeEntry = async (id: string) => {
    if (!confirm("Excluir esta novidade?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["changelog"] });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold">Gerar novidades com IA</h3>
          <p className="text-sm text-muted-foreground">
            Cole aqui um resumo do que mudou no site (pode ser texto corrido, bagunçado, com vários assuntos) — a IA separa em itens organizados pra você revisar antes de publicar.
          </p>
        </div>
        <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: adicionamos atalhos tipo /ola no simulador, criamos o fluxo de atendimento organizado por etapas na aba Mensagens, e agora dá pra confirmar dados de cadastro na reativação..." />
        <Button onClick={generate} disabled={generating || !notes.trim()} className="gap-2">
          <Sparkles className="h-4 w-4" /> {generating ? "Gerando..." : "Gerar com IA"}
        </Button>

        {drafts.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Prévia — revise antes de publicar:</p>
            {drafts.map((d, idx) => (
              <div key={idx} className="flex gap-2 items-start p-2 rounded-md border border-border">
                <input type="checkbox" checked={d.selected} className="mt-1.5"
                  onChange={(e) => setDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))} />
                <div className="flex-1 space-y-1">
                  <Input value={d.title} className="font-medium"
                    onChange={(e) => setDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, title: e.target.value } : p))} />
                  <Textarea rows={2} value={d.summary}
                    onChange={(e) => setDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, summary: e.target.value } : p))} />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDrafts([])}>Descartar</Button>
              <Button onClick={publishSelected} disabled={publishing || drafts.every((d) => !d.selected)}>
                {publishing ? "Publicando..." : `Publicar ${drafts.filter((d) => d.selected).length} item(ns)`}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Novidades publicadas ({entries.length})</h3>
        </div>
        {entries.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma novidade cadastrada ainda.</p>}
        <div className="divide-y divide-border">
          {entries.map((entry) => (
            <div key={entry.id} className="p-3 space-y-1">
              {editId === entry.id ? (
                <EditRow entry={entry} onSave={(t, s) => saveEdit(entry, t, s)} onCancel={() => setEditId(null)} />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{entry.title}</p>
                        {!entry.published && <Badge variant="secondary">rascunho</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{entry.summary}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(entry.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={entry.published} onCheckedChange={() => togglePublished(entry)} />
                      <Button size="icon" variant="ghost" onClick={() => setEditId(entry.id)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeEntry(entry.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EditRow({ entry, onSave, onCancel }: { entry: Entry; onSave: (title: string, summary: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(entry.title);
  const [summary, setSummary] = useState(entry.summary);
  return (
    <div className="space-y-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-medium" />
      <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSave(title, summary)}>Salvar</Button>
      </div>
    </div>
  );
}
