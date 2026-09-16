import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listPromoPlans, upsertPromoPlan, deletePromoPlan } from "@/lib/promoplans.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

interface PlanRow {
  id: string; nome: string; preco_primeiro_mes: number; preco_demais_meses: number;
  cor_fundo: string; cor_fundo_2: string | null; ativo: boolean; position: number;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PromoPlansTab() {
  const list = useServerFn(listPromoPlans);
  const upsert = useServerFn(upsertPromoPlan);
  const del = useServerFn(deletePromoPlan);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["promo-plans"], queryFn: () => list({}) });
  const plans = ((q.data ?? []) as PlanRow[]).slice().sort((a, b) => a.position - b.position);

  const [edit, setEdit] = useState<null | {
    id?: string; nome: string; preco_primeiro_mes: string; preco_demais_meses: string;
    cor_fundo: string; cor_fundo_2: string; ativo: boolean;
  }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, nome: edit!.nome,
      preco_primeiro_mes: Number(edit!.preco_primeiro_mes.replace(",", ".")) || 0,
      preco_demais_meses: Number(edit!.preco_demais_meses.replace(",", ".")) || 0,
      cor_fundo: edit!.cor_fundo, cor_fundo_2: edit!.cor_fundo_2 || null,
      ativo: edit!.ativo, position: edit!.id ? (plans.find((p) => p.id === edit!.id)?.position ?? 0) : plans.length * 10,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["promo-plans"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["promo-plans"] }); },
  });
  const toggleAtivo = (p: PlanRow) => upsert({ data: { ...p, ativo: !p.ativo } }).then(() => qc.invalidateQueries({ queryKey: ["promo-plans"] }));

  const openEdit = (p: PlanRow) => {
    setEdit({
      id: p.id, nome: p.nome, preco_primeiro_mes: String(p.preco_primeiro_mes), preco_demais_meses: String(p.preco_demais_meses),
      cor_fundo: p.cor_fundo, cor_fundo_2: p.cor_fundo_2 ?? "", ativo: p.ativo,
    });
  };

  const movePlan = async (idx: number, dir: -1 | 1) => {
    const arr = [...plans];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((p, i) => upsert({ data: { ...p, position: i * 10 } })));
    qc.invalidateQueries({ queryKey: ["promo-plans"] });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Planos em promoção na Tela Inicial ({plans.length})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ nome: "", preco_primeiro_mes: "", preco_demais_meses: "", cor_fundo: "#64748B", cor_fundo_2: "", ativo: true })}>
          <Plus className="h-4 w-4" /> Novo plano
        </Button>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-3">Aparecem em carrossel na Tela Inicial, entre o ranking e as informações da Amor Saúde. Só os ativos são mostrados.</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead>1º mês</TableHead>
              <TableHead>Demais meses</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p, idx) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{formatBRL(p.preco_primeiro_mes)}</TableCell>
                <TableCell>{formatBRL(p.preco_demais_meses)}</TableCell>
                <TableCell>
                  <span className="inline-block h-4 w-4 rounded-full border border-border align-middle"
                    style={{ background: p.cor_fundo_2 ? `linear-gradient(135deg, ${p.cor_fundo}, ${p.cor_fundo_2})` : p.cor_fundo }} />
                </TableCell>
                <TableCell><Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} /></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => movePlan(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === plans.length - 1} onClick={() => movePlan(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm(`Excluir "${p.nome}"?`) && delMut.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {plans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum plano cadastrado ainda.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Nome do plano</Label><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Plano Ouro" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor do 1º mês</Label><Input value={edit.preco_primeiro_mes} onChange={(e) => setEdit({ ...edit, preco_primeiro_mes: e.target.value })} placeholder="38,39" /></div>
                <div><Label>A partir do 2º mês</Label><Input value={edit.preco_demais_meses} onChange={(e) => setEdit({ ...edit, preco_demais_meses: e.target.value })} placeholder="48,39" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cor de fundo</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={edit.cor_fundo} onChange={(e) => setEdit({ ...edit, cor_fundo: e.target.value })} className="w-14 p-1 h-9" />
                    <Input value={edit.cor_fundo} onChange={(e) => setEdit({ ...edit, cor_fundo: e.target.value })} placeholder="#64748B" />
                  </div>
                </div>
                <div>
                  <Label>2ª cor (gradiente)</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={edit.cor_fundo_2 || "#64748B"} onChange={(e) => setEdit({ ...edit, cor_fundo_2: e.target.value })} className="w-14 p-1 h-9" />
                    <Input value={edit.cor_fundo_2} onChange={(e) => setEdit({ ...edit, cor_fundo_2: e.target.value })} placeholder="Deixe vazio p/ cor sólida" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
                <Label className="!mt-0">Ativo (aparece no carrossel)</Label>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
