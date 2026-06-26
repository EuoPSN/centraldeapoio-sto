import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMessages, upsertMessage, deleteMessage } from "@/lib/messages.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Cat { id: string; name: string; parent_id: string | null; }

export function MessagesTab() {
  const list = useServerFn(listMessages);
  const upsert = useServerFn(upsertMessage);
  const del = useServerFn(deleteMessage);
  const catFn = useServerFn(listCategories);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["messages"], queryFn: () => list({}) });
  const catsQ = useQuery({ queryKey: ["cats", "message"], queryFn: () => catFn({ data: { scope: "message" } }) });

  const cats = (catsQ.data ?? []) as Cat[];
  const parents = cats.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => cats.filter((c) => c.parent_id === id);

  const [edit, setEdit] = useState<null | {
    id?: string; category_id: string; subcategory_id: string; title: string; content: string; internal_note: string;
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
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["messages"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removida."); qc.invalidateQueries({ queryKey: ["messages"] }); },
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Mensagens ({q.data?.length ?? 0})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ category_id: "", subcategory_id: "", title: "", content: "", internal_note: "" })}>
          <Plus className="h-4 w-4" /> Nova mensagem
        </Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Título</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {(q.data ?? []).map((m: { id: string; title: string; category: { name: string } | null; subcategory: { name: string } | null; content: string; internal_note: string | null; category_id: string | null; subcategory_id: string | null; }) => (
            <TableRow key={m.id}>
              <TableCell><Badge variant="secondary">{m.category?.name ?? "—"}{m.subcategory ? ` · ${m.subcategory.name}` : ""}</Badge></TableCell>
              <TableCell className="font-medium">{m.title}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => setEdit({
                  id: m.id, category_id: m.category_id ?? "", subcategory_id: m.subcategory_id ?? "",
                  title: m.title, content: m.content, internal_note: m.internal_note ?? "",
                })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && mDel.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
              <div><Label>Título</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div><Label>Conteúdo</Label><Textarea rows={8} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></div>
              <div><Label>Observação interna</Label><Input value={edit.internal_note} onChange={(e) => setEdit({ ...edit, internal_note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => mUp.mutate()} disabled={mUp.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
