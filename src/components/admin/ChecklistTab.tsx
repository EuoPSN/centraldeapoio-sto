import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listChecklistItemsAdmin, upsertChecklistItem, deleteChecklistItem, getChecklistSummaryForDate,
} from "@/lib/checklist.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Plus, Pencil, Trash2, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ItemRow {
  id: string; titulo: string; tipo: "binario" | "meta"; meta_padrao: number | null;
  position: number; ativo: boolean;
}

function hojeBrasiliaISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function ChecklistTab() {
  const qc = useQueryClient();

  // ---- Gerenciar itens ----
  const listFn = useServerFn(listChecklistItemsAdmin);
  const upsertFn = useServerFn(upsertChecklistItem);
  const delFn = useServerFn(deleteChecklistItem);
  const itemsQ = useQuery({ queryKey: ["checklist-items-admin"], queryFn: () => listFn({}) });
  const items = ((itemsQ.data ?? []) as ItemRow[]).slice().sort((a, b) => a.position - b.position);

  const [edit, setEdit] = useState<null | {
    id?: string; titulo: string; tipo: "binario" | "meta"; meta_padrao: string; ativo: boolean;
  }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsertFn({ data: {
      id: edit!.id,
      titulo: edit!.titulo,
      tipo: edit!.tipo,
      meta_padrao: edit!.tipo === "meta" ? (Number(edit!.meta_padrao) || 100) : null,
      position: edit!.id ? (items.find((i) => i.id === edit!.id)?.position ?? 0) : items.length * 10,
      ativo: edit!.ativo,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["checklist-items-admin"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["checklist-items-admin"] }); },
  });
  const toggleAtivo = (i: ItemRow) =>
    upsertFn({ data: { id: i.id, titulo: i.titulo, tipo: i.tipo, meta_padrao: i.meta_padrao, position: i.position, ativo: !i.ativo } })
      .then(() => qc.invalidateQueries({ queryKey: ["checklist-items-admin"] }));

  const moveItem = async (idx: number, dir: -1 | 1) => {
    const arr = [...items];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((i, k) => upsertFn({ data: { id: i.id, titulo: i.titulo, tipo: i.tipo, meta_padrao: i.meta_padrao, position: k * 10, ativo: i.ativo } })));
    qc.invalidateQueries({ queryKey: ["checklist-items-admin"] });
  };

  // ---- Acompanhamento do dia ----
  const summaryFn = useServerFn(getChecklistSummaryForDate);
  const [dia, setDia] = useState(hojeBrasiliaISO());
  const summaryQ = useQuery({ queryKey: ["checklist-summary", dia], queryFn: () => summaryFn({ data: { dia } }) });
  const summary = summaryQ.data as { totalItems: number; users: any[]; teamAveragePct: number; zeroCount: number } | undefined;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Itens do Check-list ({items.length})</h3>
          <Button size="sm" className="gap-2" onClick={() => setEdit({ titulo: "", tipo: "binario", meta_padrao: "100", ativo: true })}>
            <Plus className="h-4 w-4" /> Novo item
          </Button>
        </div>
        <div className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Tipo</TableHead><TableHead>Ativo</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((i, idx) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.titulo}</TableCell>
                  <TableCell>
                    {i.tipo === "meta" ? <Badge variant="secondary">Meta: {i.meta_padrao}</Badge> : <Badge variant="outline">Sim/Não</Badge>}
                  </TableCell>
                  <TableCell><Switch checked={i.ativo} onCheckedChange={() => toggleAtivo(i)} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => moveItem(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === items.length - 1} onClick={() => moveItem(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEdit({ id: i.id, titulo: i.titulo, tipo: i.tipo, meta_padrao: String(i.meta_padrao ?? 100), ativo: i.ativo })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm(`Excluir "${i.titulo}"?`) && delMut.mutate(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum item cadastrado ainda.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Acompanhamento do dia</h3>
          <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="w-44" />
        </div>

        {summaryQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : summary && summary.totalItems === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item ativo no checklist ainda.</p>
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Média da equipe</p>
                <p className="text-2xl font-bold text-primary mt-1">{summary.teamAveragePct}%</p>
              </Card>
              <Card className={`p-4 ${summary.zeroCount > 0 ? "bg-red-50 border-red-200" : ""}`}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  {summary.zeroCount > 0 && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />} Não fizeram nada hoje
                </p>
                <p className={`text-2xl font-bold mt-1 ${summary.zeroCount > 0 ? "text-red-600" : "text-primary"}`}>{summary.zeroCount}</p>
              </Card>
            </div>

            <Table>
              <TableHeader><TableRow><TableHead>Funcionário</TableHead><TableHead>Feito</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
              <TableBody>
                {summary.users.map((u) => (
                  <TableRow key={u.id} className={u.done === 0 ? "bg-red-50/50" : undefined}>
                    <TableCell className="font-medium">{u.display_name || u.email}</TableCell>
                    <TableCell>{u.done}/{u.total}</TableCell>
                    <TableCell>
                      <Badge className={u.pct >= 80 ? "bg-emerald-100 text-emerald-800" : u.pct >= 40 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                        {u.pct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {summary.users.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhum funcionário ativo.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </>
        ) : null}
      </Card>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label>Título do item</Label>
                <Input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} placeholder="Ex: Verificar e acompanhar o CRM" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={edit.tipo} onValueChange={(v) => setEdit({ ...edit, tipo: v as "binario" | "meta" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="binario">Sim/Não (caixinha de marcar)</SelectItem>
                    <SelectItem value="meta">Meta numérica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {edit.tipo === "meta" && (
                <div>
                  <Label>Meta padrão</Label>
                  <Input type="number" value={edit.meta_padrao} onChange={(e) => setEdit({ ...edit, meta_padrao: e.target.value })} placeholder="100" />
                  <p className="text-xs text-muted-foreground mt-1">O funcionário digita quantas fez no dia; "feito" é quando bate essa meta. Pode alterar quando quiser.</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
                <Label className="!mt-0">Ativo (aparece no checklist dos funcionários)</Label>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
