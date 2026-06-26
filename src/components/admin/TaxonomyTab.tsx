import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listCategories, upsertCategory, deleteCategory } from "@/lib/taxonomy.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const SCOPES = [
  { value: "message", label: "Mensagens" },
  { value: "flow", label: "Fluxos" },
  { value: "suggestion", label: "Sugestões" },
  { value: "content", label: "Conteúdo" },
] as const;

type Scope = typeof SCOPES[number]["value"];
interface Cat { id: string; name: string; slug: string; scope: Scope; parent_id: string | null; position: number; }

function slugify(s: string) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

export function TaxonomyTab() {
  const list = useServerFn(listCategories);
  const upsert = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);
  const qc = useQueryClient();
  const [scope, setScope] = useState<Scope>("message");
  const q = useQuery({ queryKey: ["cats", scope], queryFn: () => list({ data: { scope } }) });
  const cats = (q.data ?? []) as Cat[];

  const [edit, setEdit] = useState<null | { id?: string; name: string; parent_id: string; }>(null);

  const mUp = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, scope, name: edit!.name, slug: slugify(edit!.name),
      parent_id: edit!.parent_id || null, position: 0,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["cats", scope] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removida."); qc.invalidateQueries({ queryKey: ["cats", scope] }); },
  });

  const parents = cats.filter((c) => !c.parent_id);

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Categorias</h3>
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ name: "", parent_id: "" })}>
          <Plus className="h-4 w-4" /> Nova categoria
        </Button>
      </div>

      <div className="p-4 space-y-2">
        {parents.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>}
        {parents.map((p) => (
          <div key={p.id}>
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
              <div className="flex items-center gap-2">
                <Badge>{p.name}</Badge>
                <span className="text-xs text-muted-foreground">{p.slug}</span>
              </div>
              <div className="space-x-1">
                <Button size="icon" variant="ghost" onClick={() => setEdit({ id: p.id, name: p.name, parent_id: "" })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir? Subcategorias serão removidas.") && mDel.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            <div className="ml-6 mt-1 space-y-1">
              {cats.filter((c) => c.parent_id === p.id).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 text-sm">
                  <span>↳ {c.name} <span className="text-xs text-muted-foreground">({c.slug})</span></span>
                  <div className="space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => setEdit({ id: c.id, name: c.name, parent_id: p.id })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && mDel.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div>
                <Label>Categoria pai (opcional)</Label>
                <Select value={edit.parent_id || "none"} onValueChange={(v) => setEdit({ ...edit, parent_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="— sem pai (categoria raiz) —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem pai (categoria raiz) —</SelectItem>
                    {parents.filter((p) => p.id !== edit.id).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => mUp.mutate()} disabled={mUp.isPending || !edit?.name}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
