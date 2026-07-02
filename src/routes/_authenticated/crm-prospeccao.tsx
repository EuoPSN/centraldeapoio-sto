import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listProspeccao, upsertProspeccao, deleteProspeccao
} from "@/lib/prospeccao.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm-prospeccao")({
  component: Page,
});

const CANAIS = ["Ligações", "Mensagens", "Ztalk"];
const EMPTY = { data: new Date().toISOString().slice(0, 10), vendedor: "", canal: "Ligações", tentativas: 0, oportunidades: 0, vendas: 0 };

function Page() {
  const listFn = useServerFn(listProspeccao);
  const upsertFn = useServerFn(upsertProspeccao);
  const deleteFn = useServerFn(deleteProspeccao);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [filtroData, setFiltroData] = useState(new Date().toISOString().slice(0, 10));

  const q = useQuery({
    queryKey: ["prospeccao", filtroData],
    queryFn: () => listFn({ data: { dataInicio: filtroData, dataFim: filtroData } }),
  });
  const rows = (q.data ?? []) as any[];

  const upsertMut = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => {
      toast.success("Lançamento salvo!");
      qc.invalidateQueries({ queryKey: ["prospeccao"] });
      setOpen(false);
      setForm({ ...EMPTY });
    },
    onError: () => toast.error("Erro ao salvar lançamento."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Lançamento removido.");
      qc.invalidateQueries({ queryKey: ["prospeccao"] });
    },
    onError: () => toast.error("Erro ao remover."),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const openNew = () => { setForm({ ...EMPTY, data: filtroData }); setOpen(true); };
  const openEdit = (r: any) => { setForm({ ...r }); setOpen(true); };

  const totais = rows.reduce(
    (acc, r) => ({ t: acc.t + r.tentativas, o: acc.o + r.oportunidades, v: acc.v + r.vendas }),
    { t: 0, o: 0, v: 0 }
  );

  return (
    <div className="space-y-6 p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Controle de Prospecções</h1>
          <p className="text-muted-foreground text-sm">Lance os dados diários por vendedor e canal.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Lançamento</Button>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data</Label>
          <Input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} className="w-44" />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totais.t}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Tentativas</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{totais.o}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Oportunidades</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totais.v}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Vendas</p>
          </Card>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3">Vendedor</th>
                <th className="text-left p-3">Canal</th>
                <th className="text-center p-3">Tentativas</th>
                <th className="text-center p-3">Oportunidades</th>
                <th className="text-center p-3">Vendas</th>
                <th className="text-center p-3">Conv.</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground p-8">Nenhum lançamento para esta data.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover" >
                  <td className="p-3 font-medium">{r.vendedor}</td>
                  <td className="p-3">{r.canal}</td>
                  <td className="p-3 text-center">{r.tentativas}</td>
                  <td className="p-3 text-center">{r.oportunidades}</td>
                  <td className="p-3 text-center font-semibold text-emerald-600">{r.vendas}</td>
                  <td className="p-3 text-center text-xs text-muted-foreground">
                    {r.tentativas > 0 ? ((r.vendas / r.tentativas) * 100).toFixed(1) : "0.0"}%
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
            <div><Label>Vendedor</Label><Input value={form.vendedor} onChange={(e) => set("vendedor", e.target.value)} placeholder="Nome do vendedor" /></div>
            <div><Label>Canal</Label>
              <Select value={form.canal} onValueChange={(v) => set("canal", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CANAIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Tentativas</Label><Input type="number" min={0} value={form.tentativas} onChange={(e) => set("tentativas", Number(e.target.value))} /></div>
              <div><Label>Oportunidades</Label><Input type="number" min={0} value={form.oportunidades} onChange={(e) => set("oportunidades", Number(e.target.value))} /></div>
              <div><Label>Vendas</Label><Input type="number" min={0} value={form.vendas} onChange={(e) => set("vendas", Number(e.target.value))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsertMut.mutate(form)} disabled={!form.vendedor || upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
