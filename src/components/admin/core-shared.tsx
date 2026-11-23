import { VideoFields, erroDosCamposDeVideo } from "@/components/admin/VideoFields";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { listContent, upsertContent, deleteContent } from "@/lib/content.functions";
import { getAjudaFeedbackSummary } from "@/lib/ajuda.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";


// ============ Central de Ajuda: Procedimentos / Problemas técnicos ============
// Era uma aba só ("Conteúdo (legado)") com um seletor problemas/tutoriais;
// agora cada uma vira uma seção própria do Admin, com a seção já fixa.
export function ContentTab({ section }: { section: "problemas" | "tutoriais" }) {
  const list = useServerFn(listContent);
  const upsert = useServerFn(upsertContent);
  const del = useServerFn(deleteContent);
  const feedbackSummaryFn = useServerFn(getAjudaFeedbackSummary);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["content", section], queryFn: () => list({ data: { section } }) });
  const feedbackQ = useQuery({ queryKey: ["ajuda-feedback-summary"], queryFn: () => feedbackSummaryFn({}) });
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);

  const [edit, setEdit] = useState<null | { id?: string; category: string; title: string; content: string; link_externo?: string; link_label?: string; video_url: string; video_duracao: string }>(null);

  const upsertMut = useMutation({
    mutationFn: () => {
      const erroVideo = erroDosCamposDeVideo(edit!.video_url, edit!.video_duracao);
      if (erroVideo) throw new Error(erroVideo);
      return upsert({ data: { ...edit!, section, tags: [], position: 0, link_externo: edit!.link_externo ?? null, link_label: edit!.link_label ?? null, video_url: edit!.video_url.trim() || null, video_duracao: edit!.video_duracao.trim() || null } });
    },
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["content", section] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["content", section] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-2" onClick={() => setEdit({ category: "", title: "", content: "", link_externo: "", link_label: "", video_url: "", video_duracao: "" })}>
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Título</TableHead><TableHead>Isso ajudou?</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).map((c: { id: string; category: string | null; title: string; content: string; link_externo: string | null; link_label: string | null; video_url: string | null; video_duracao: string | null }) => {
              const fb = (feedbackQ.data as Record<string, { sim: number; nao: number; recentesNao: { data: string; pessoa: string }[] }> | undefined)?.[c.id];
              const open = feedbackOpenId === c.id;
              return (
                <Fragment key={c.id}>
                  <TableRow>
                    <TableCell><Badge variant="secondary">{c.category || "—"}</Badge></TableCell>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>
                      {fb && (fb.sim > 0 || fb.nao > 0) ? (
                        <button
                          type="button"
                          onClick={() => setFeedbackOpenId(open ? null : c.id)}
                          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                        >
                          {fb.sim} sim · {fb.nao} não
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setEdit({ id: c.id, category: c.category ?? "", title: c.title, content: c.content, link_externo: c.link_externo ?? "", link_label: c.link_label ?? "", video_url: c.video_url ?? "", video_duracao: c.video_duracao ?? "" })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                  {open && fb && fb.recentesNao.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted/30">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">"Não" mais recentes</p>
                        <ul className="space-y-0.5">
                          {fb.recentesNao.map((r, i) => (
                            <li key={i} className="text-sm text-muted-foreground">
                              {new Date(r.data).toLocaleDateString("pt-BR")} — {r.pessoa}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Categoria</Label><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
              <div><Label>Título</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div><Label>Conteúdo (Markdown)</Label><Textarea rows={10} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></div>
              <VideoFields
                url={edit.video_url} duracao={edit.video_duracao}
                onUrl={(v) => setEdit({ ...edit, video_url: v })} onDuracao={(v) => setEdit({ ...edit, video_duracao: v })}
                legenda="Passo a passo em vídeo"
              />
              <div>
                 <Label>Link externo (PDF, página...)</Label>
                 <Input placeholder="https://..." value={edit.link_externo ?? ""} onChange={(e) => setEdit({ ...edit, link_externo: e.target.value })} />
               </div>
               <div>
                 <Label>Texto do link</Label>
                 <Input placeholder="Ex: Assistir vídeo, Abrir PDF..." value={edit.link_label ?? ""} onChange={(e) => setEdit({ ...edit, link_label: e.target.value })} />
               </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
