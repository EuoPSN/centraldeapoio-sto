import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listDraftsForReview, approveDraft, rejectDraft } from "@/lib/messagedrafts.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListChecks, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Cat { id: string; name: string; parent_id: string | null; }
interface DraftRow {
  id: string; titulo: string; conteudo: string; autor_nome: string; created_at: string;
  category_id: string | null; subcategory_id: string | null;
  category?: { name: string } | null; subcategory?: { name: string } | null;
}

export function ScriptReviewTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDraftsForReview);
  const approveFn = useServerFn(approveDraft);
  const rejectFn = useServerFn(rejectDraft);
  const catFn = useServerFn(listCategories);

  const [status, setStatus] = useState<"pendente" | "aprovado" | "rejeitado">("pendente");
  const draftsQ = useQuery({ queryKey: ["drafts-review", status], queryFn: () => listFn({ data: { status } }) });
  const catsQ = useQuery({ queryKey: ["cats", "message"], queryFn: () => catFn({ data: { scope: "message" } }) });
  const drafts = (draftsQ.data ?? []) as DraftRow[];
  const cats = (catsQ.data ?? []) as Cat[];
  const parents = cats.filter((c) => !c.parent_id);

  const [approveState, setApproveState] = useState<Record<string, { titulo: string; conteudo: string; category_id: string; subcategory_id: string }>>({});
  const getState = (d: DraftRow) => approveState[d.id] ?? {
    titulo: d.titulo, conteudo: d.conteudo, category_id: d.category_id ?? "", subcategory_id: d.subcategory_id ?? "",
  };
  const setState = (id: string, patch: Partial<{ titulo: string; conteudo: string; category_id: string; subcategory_id: string }>, base: DraftRow) =>
    setApproveState((prev) => ({ ...prev, [id]: { ...getState(base), ...patch } }));

  const approveMut = useMutation({
    mutationFn: (d: DraftRow) => {
      const s = getState(d);
      return approveFn({ data: {
        id: d.id, titulo: s.titulo, conteudo: s.conteudo,
        category_id: s.category_id || null, subcategory_id: s.subcategory_id || null,
      } });
    },
    onSuccess: () => { toast.success("Aprovado e publicado nos scripts!"); qc.invalidateQueries({ queryKey: ["drafts-review"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao aprovar."),
  });

  const [rejecting, setRejecting] = useState<DraftRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const rejectMut = useMutation({
    mutationFn: () => rejectFn({ data: { id: rejecting!.id, nota_revisao: rejectNote || null } }),
    onSuccess: () => { toast.success("Rejeitado."); setRejecting(null); setRejectNote(""); qc.invalidateQueries({ queryKey: ["drafts-review"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao rejeitar."),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border flex-wrap gap-3">
        <h3 className="font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Análise de Scripts</h3>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aprovado">Aprovados</SelectItem>
            <SelectItem value="rejeitado">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="p-4 space-y-4">
        {draftsQ.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!draftsQ.isLoading && drafts.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum script {status === "pendente" ? "pendente" : status} no momento.</p>
        )}

        {drafts.map((d) => {
          const s = getState(d);
          const subcats = cats.filter((c) => c.parent_id === s.category_id);
          const editable = status === "pendente";
          return (
            <Card key={d.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground">Enviado por <span className="font-medium text-foreground">{d.autor_nome}</span> · {new Date(d.created_at).toLocaleString("pt-BR")}</p>
                </div>
                {editable && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setRejecting(d)}>
                      <X className="h-3.5 w-3.5" /> Rejeitar
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => approveMut.mutate(d)} disabled={approveMut.isPending}>
                      <Check className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                  </div>
                )}
              </div>

              {editable ? (
                <>
                  <Input value={s.titulo} onChange={(e) => setState(d.id, { titulo: e.target.value }, d)} className="font-medium" />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={s.category_id || "none"} onValueChange={(v) => setState(d.id, { category_id: v === "none" ? "" : v, subcategory_id: "" }, d)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {parents.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={s.subcategory_id || "none"} onValueChange={(v) => setState(d.id, { subcategory_id: v === "none" ? "" : v }, d)} disabled={subcats.length === 0}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem subcategoria</SelectItem>
                        {subcats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea rows={5} value={s.conteudo} onChange={(e) => setState(d.id, { conteudo: e.target.value }, d)} />
                  <p className="text-xs text-muted-foreground">Pode ajustar título, categoria ou texto antes de aprovar.</p>
                </>
              ) : (
                <>
                  <p className="font-medium">{d.titulo}</p>
                  <div className="flex gap-1.5">
                    {d.category?.name && <Badge variant="outline">{d.category.name}</Badge>}
                    {d.subcategory?.name && <Badge variant="outline">{d.subcategory.name}</Badge>}
                  </div>
                  <div className="rounded-md bg-muted/40 border border-border p-3 text-sm whitespace-pre-wrap">{d.conteudo}</div>
                </>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={!!rejecting} onOpenChange={(v) => !v && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar "{rejecting?.titulo}"</DialogTitle></DialogHeader>
          <div>
            <Label>Motivo (opcional — o funcionário vai ver isso)</Label>
            <Textarea rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Ex: informação desatualizada, tom fora do padrão..." />
          </div>
          <DialogFooter><Button variant="destructive" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>Confirmar rejeição</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
