import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUnidades, upsertUnidade, deleteUnidade } from "@/lib/unidades.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Unidade { id: string; nome: string; endereco: string | null; cidade: string | null; estado: string | null; position: number; }

export function UnidadesTab() {
  const list = useServerFn(listUnidades);
  const upsert = useServerFn(upsertUnidade);
  const del = useServerFn(deleteUnidade);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["unidades"], queryFn: () => list({}) });
  const unidades = (q.data ?? []) as Unidade[];

  const [edit, setEdit] = useState<null | { id?: string; nome: string; endereco: string; cidade: string; estado: string }>(null);

  const mUp = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id,
      nome: edit!.nome,
      endereco: edit!.endereco || null,
      cidade: edit!.cidade || null,
      estado: edit!.estado || null,
      position: 0,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["unidades"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removida."); qc.invalidateQueries({ queryKey: ["unidades"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover — confira se ela não está sendo usada em algum preço."),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Unidades ({unidades.length})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ nome: "", endereco: "", cidade: "", estado: "" })}>
          <Plus className="h-4 w-4" /> Nova unidade
        </Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cidade/Estado</TableHead><TableHead>Endereço</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {unidades.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.nome}</TableCell>
              <TableCell>{[u.cidade, u.estado].filter(Boolean).join("/") || "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{u.endereco || "—"}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => setEdit({ id: u.id, nome: u.nome, endereco: u.endereco ?? "", cidade: u.cidade ?? "", estado: u.estado ?? "" })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm(`Excluir "${u.nome}"?`) && mDel.mutate(u.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {unidades.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma unidade cadastrada ainda.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar unidade" : "Nova unidade"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex: Veneza" /></div>
              <div><Label>Endereço</Label><Input value={edit.endereco} onChange={(e) => setEdit({ ...edit, endereco: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cidade</Label><Input value={edit.cidade} onChange={(e) => setEdit({ ...edit, cidade: e.target.value })} /></div>
                <div><Label>Estado</Label><Input value={edit.estado} onChange={(e) => setEdit({ ...edit, estado: e.target.value })} placeholder="Ex: MG" /></div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => mUp.mutate()} disabled={mUp.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
