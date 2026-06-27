import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listKnowledge, upsertKnowledge, deleteKnowledge,
  KNOWLEDGE_KINDS, type KnowledgeKind,
} from "@/lib/knowledge.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KIND_LABELS: Record<KnowledgeKind, string> = {
  regra: "Regras", procedimento: "Procedimentos", artigo: "Artigos",
  conversa_modelo: "Conversas Modelo", documento: "Documentos", treinamento: "Treinamentos",
};

interface EditState {
  id?: string;
  kind: KnowledgeKind;
  category_id: string | null;
  title: string;
  summary: string;
  content: string;
  tags: string;
  external_url: string;
  file_url: string | null;
  file_mime: string | null;
  file_name: string | null;
}

export function KnowledgeTab() {
  const [tab, setTab] = useState<KnowledgeKind>("regra");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as KnowledgeKind)}>
      <TabsList className="flex-wrap h-auto">
        {KNOWLEDGE_KINDS.map((k) => (
          <TabsTrigger key={k} value={k}>{KIND_LABELS[k]}</TabsTrigger>
        ))}
      </TabsList>
      {KNOWLEDGE_KINDS.map((k) => (
        <TabsContent key={k} value={k} className="mt-4">
          <KindAdmin kind={k} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function KindAdmin({ kind }: { kind: KnowledgeKind }) {
  const listFn = useServerFn(listKnowledge);
  const upsertFn = useServerFn(upsertKnowledge);
  const delFn = useServerFn(deleteKnowledge);
  const catFn = useServerFn(listCategories);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["admin-knowledge", kind], queryFn: () => listFn({ data: { kind } }) });
  const catQ = useQuery({ queryKey: ["categories", "content"], queryFn: () => catFn({ data: { scope: "content" } }) });

  const [edit, setEdit] = useState<EditState | null>(null);
  const [uploading, setUploading] = useState(false);

  const empty = (): EditState => ({
    kind, category_id: null, title: "", summary: "", content: "", tags: "",
    external_url: "", file_url: null, file_mime: null, file_name: null,
  });

  const upMut = useMutation({
    mutationFn: () => upsertFn({
      data: {
        id: edit!.id,
        kind: edit!.kind,
        category_id: edit!.category_id,
        title: edit!.title,
        summary: edit!.summary || null,
        content: edit!.content,
        tags: edit!.tags.split(",").map((t) => t.trim()).filter(Boolean),
        external_url: edit!.external_url || null,
        file_url: edit!.file_url,
        file_mime: edit!.file_mime,
        file_name: edit!.file_name,
        metadata: {},
        position: 0,
      },
    }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["admin-knowledge", kind] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["admin-knowledge", kind] }); },
  });

  const handleUpload = async (file: File) => {
    if (!edit) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${kind}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("knowledge-files").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      setEdit({ ...edit, file_url: path, file_mime: file.type, file_name: file.name });
      toast.success("Arquivo enviado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const rows = (q.data ?? []) as unknown as Array<{
    id: string; title: string; tags: string[]; file_name: string | null;
    category: { name: string } | null;
  }>;

  const acceptedTypes = useMemo(() => {
    if (kind === "treinamento") return "video/*,application/pdf,image/*,.pptx,.ppt";
    if (kind === "documento") return ".pdf,.docx,.xlsx,.doc,.xls";
    return "*/*";
  }, [kind]);

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">{KIND_LABELS[kind]} ({rows.length})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit(empty())}>
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Título</TableHead><TableHead>Categoria</TableHead><TableHead>Tags</TableHead><TableHead>Arquivo</TableHead><TableHead className="text-right">Ações</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.title}</TableCell>
              <TableCell>{r.category?.name ?? "—"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(r.tags ?? []).slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>)}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.file_name ?? "—"}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={async () => {
                  const full = await (await fetch("")).text().catch(() => null); void full;
                  // re-fetch full entry para edição
                  const fr = (q.data ?? []).find((x) => x.id === r.id) as unknown as {
                    id: string; kind: KnowledgeKind; category_id: string | null;
                    title: string; summary: string | null; content: string; tags: string[];
                    external_url: string | null; file_url: string | null; file_mime: string | null; file_name: string | null;
                  } | undefined;
                  if (!fr) return;
                  setEdit({
                    id: fr.id, kind: fr.kind, category_id: fr.category_id,
                    title: fr.title, summary: fr.summary ?? "", content: fr.content,
                    tags: (fr.tags ?? []).join(", "), external_url: fr.external_url ?? "",
                    file_url: fr.file_url, file_mime: fr.file_mime, file_name: fr.file_name,
                  });
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar" : "Novo"} — {KIND_LABELS[kind]}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Título</Label>
                  <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={edit.category_id ?? "none"} onValueChange={(v) => setEdit({ ...edit, category_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">(sem categoria)</SelectItem>
                      {(catQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Resumo (opcional)</Label>
                <Input value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} placeholder="Frase curta que aparece no card" />
              </div>
              <div>
                <Label>
                  Conteúdo (markdown)
                  {(kind === "documento" || kind === "treinamento") && (
                    <span className="text-muted-foreground font-normal text-xs ml-2">
                      — cole aqui o texto extraído do arquivo para a IA conseguir consultar
                    </span>
                  )}
                </Label>
                <Textarea rows={kind === "conversa_modelo" ? 12 : 8} value={edit.content}
                  onChange={(e) => setEdit({ ...edit, content: e.target.value })}
                  placeholder={kind === "conversa_modelo"
                    ? "**Atendente:** ...\n**Cliente:** ...\n**Atendente:** ...\n\n**Resultado:** Venda concluída"
                    : "Conteúdo principal..."} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tags (separadas por vírgula)</Label>
                  <Input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder="cashback, prazo, faq" />
                </div>
                <div>
                  <Label>Link externo (opcional)</Label>
                  <Input value={edit.external_url} onChange={(e) => setEdit({ ...edit, external_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>

              <div className="border border-dashed border-border rounded-md p-3 space-y-2">
                <Label className="flex items-center gap-2"><Upload className="h-4 w-4" /> Arquivo complementar</Label>
                <input type="file" accept={acceptedTypes}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                  disabled={uploading}
                  className="block text-sm w-full text-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
                {uploading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</p>}
                {edit.file_url && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">📎 {edit.file_name}</span>
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, file_url: null, file_mime: null, file_name: null })}>Remover</Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => upMut.mutate()} disabled={upMut.isPending || !edit?.title}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
