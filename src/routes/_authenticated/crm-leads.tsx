import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listLeadsFunil, upsertLeadsFunil, deleteLeadsFunil
} from "@/lib/leadsfunil.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm-leads")({
  component: Page,
});

const ORIGENS = ["Tráfego Pago", "Central", "Geral"];
const EMPTY = {
  data: new Date().toISOString().slice(0, 10), origem: "Tráfego Pago",
  leads_entrados: 0, qualificados: 0, apresentacao: 0, negociacao: 0,
  vendas_fechadas: 0, sem_interesse: 0, nao_responde: 0, desqualificados: 0,
};

function Page() {
  const listFn = useServerFn(listLeadsFunil);
  const upsertFn = useServerFn(upsertLeadsFunil);
  const deleteFn = useServerFn(deleteLeadsFunil);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [filtroOrigem, setFiltroOrigem] = useState("Tráfego Pago");
  const [filtroInicio, setFiltroInicio] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [filtroFim, setFiltroFim] = useState(new Date().toISOString().slice(0, 10));

  const q = useQuery({
    queryKey: ["leads-funil", filtroOrigem, filtroInicio, filtroFim],
    queryFn: () => listFn({ data: { origem: filtroOrigem, dataInicio: filtroInicio, dataFim: filtroFim } }),
  });
  const rows = (q.data ?? []) as any[];

  const upsertMut = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => {
      toast.success("Lançamento salvo!");
      qc.invalidateQueries({ queryKey: ["leads-funil"] });
      setOpen(false);
      setForm({ ...EMPTY, origem: filtroOrigem });
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido.");
      qc.invalidateQueries({ queryKey: ["leads-funil"] });
    },
    onError: () => toast.error("Erro ao remover."),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const openNew = () => { setForm({ ...EMPTY, origem: filtroOrigem, data: filtroFim }); setOpen(true); };
  const openEdit = (r: any) => { setForm({ ...r }); setOpen(true); };

  const totais = rows.reduce((acc, r) => ({
    leads_entrados: acc.leads_entrados + r.leads_entrados,
    qualificados: acc.qualificados + r.qualificados,
    vendas_fechadas: acc.vendas_fechadas + r.vendas_fechadas,
    sem_interesse: acc.sem_interesse + r.sem_interesse,
    nao_responde: acc.nao_responde + r.nao_responde,
    desqualificados: acc.desqualificados + r.desqualificados,
  }), { leads_entrados: 0, qualificados: 0, vendas_fechadas: 0, sem_interesse: 0, nao_responde: 0, desqualificados: 0 });

  return (
    <div className="space-y-6 p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Controle de Leads</h1>
          <p className="text-muted-foreground text-sm">Lance os dados diários do funil por origem.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Lançamento</Button>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Origem</Label>
          <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{ORIGENS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} className="w-40" />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totais.leads_entrados}</p>
            <p className="text-xs text-muted-foreground mt-1">Leads Entrados</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{totais.qualificados}</p>
            <p className="text-xs text-muted-foreground mt-1">Qualificados</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totais.vendas_fechadas}</p>
            <p className="text-xs text-muted-foreground mt-1">Vendas Fechadas</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{totais.sem_interesse + totais.nao_responde + totais.desqualificados}</p>
            <p className="text-xs text-muted-foreground mt-1">Perdidos/Parados</p>
          </Card>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3">Data</th>
                <th className="text-center p-3">Leads</th>
                <th className="text-center p-3">Qualif.</th>
                <th className="text-center p-3">Apres.</th>
                <th className="text-center p-3">Negoc.</th>
                <th className="text-center p-3">Vendas</th>
                <th className="text-center p-3">Perdidos</th>
                <th className="text-center p-3">Conv.%</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted-foreground p-8">Nenhum lançamento no período.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">{new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-center">{r.leads_entrados}</td>
                  <td className="p-3 text-center">{r.qualificados}</td>
                  <td className="p-3 text-center">{r.apresentacao}</td>
                  <td className="p-3 text-center">{r.negociacao}</td>
                  <td className="p-3 text-center font-semibold text-emerald-600">{r.vendas_fechadas}</td>
                  <td className="p-3 text-center text-red-500">{r.sem_interesse + r.nao_responde + r.desqualificados}</td>
                  <td className="p-3 text-center text-xs text-muted-foreground">
                    {r.leads_entrados > 0 ? ((r.vendas_fechadas / r.leads_entrados) * 100).toFixed(1) : "0.0"}%
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo Lançamento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
              <div><Label>Origem</Label>
                <Select value={form.origem} onValueChange={(v) => set("origem", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ORIGENS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Funil</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["leads_entrados", "Leads Entrados"], ["qualificados", "Qualificados"],
                ["apresentacao", "Apresentação"], ["negociacao", "Negociação"],
                ["vendas_fechadas", "Vendas Fechadas"],
              ].map(([k, label]) => (
                <div key={k}><Label>{label}</Label>
                  <Input type="number" min={0} value={form[k]} onChange={(e) => set(k, Number(e.target.value))} />
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Perdidos/Parados</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["sem_interesse", "Sem Interesse"], ["nao_responde", "Não Responde"],
                ["desqualificados", "Desqualificados"],
              ].map(([k, label]) => (
                <div key={k}><Label>{label}</Label>
                  <Input type="number" min={0} value={form[k]} onChange={(e) => set(k, Number(e.target.value))} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsertMut.mutate(form)} disabled={upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
