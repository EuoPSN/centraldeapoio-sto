import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMetas, upsertMeta, deleteMeta } from "@/lib/metas.functions";
import { getProspeccaoStats } from "@/lib/prospeccao.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Target, TrendingUp, Calendar, Users, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  component: Page,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function mesAtual() {
  const d = new Date();
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

function inicioMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function hoje() { return new Date().toISOString().slice(0, 10); }

const EMPTY = { nome: "", mes_referencia: mesAtual(), meta_mensal: 0, dias_uteis: 22 };

function ProgressBar({ valor, meta }: { valor: number; meta: number }) {
  const pct = meta > 0 ? Math.min(Math.round((valor / meta) * 100), 100) : 0;
  const cor = pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{valor} de {meta}</span>
        <span className={`font-semibold ${pct >= 100 ? "text-emerald-600" : pct >= 60 ? "text-yellow-600" : "text-red-500"}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Page() {
  const listFn = useServerFn(listMetas);
  const upsertFn = useServerFn(upsertMeta);
  const deleteFn = useServerFn(deleteMeta);
  const statsFn = useServerFn(getProspeccaoStats);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [selected, setSelected] = useState<any>(null);

  const metasQ = useQuery({
    queryKey: ["metas"],
    queryFn: () => listFn(),
  });
  const metas = (metasQ.data ?? []) as any[];

  const statsQ = useQuery({
    queryKey: ["prosp-stats-mes"],
    queryFn: () => statsFn({ data: { dataInicio: inicioMes(), dataFim: hoje() } }),
  });
  const stats = statsQ.data as any;

  const upsertMut = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => {
      toast.success("Funcionário salvo!");
      qc.invalidateQueries({ queryKey: ["metas"] });
      setOpen(false);
      setForm({ ...EMPTY });
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido.");
      qc.invalidateQueries({ queryKey: ["metas"] });
      if (selected?.id === form?.id) setSelected(null);
    },
    onError: () => toast.error("Erro ao remover."),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const openNew = () => { setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (m: any) => { setForm({ ...m }); setOpen(true); };

  const metaDiaria = (m: any) => m.dias_uteis > 0 ? Number((m.meta_mensal / m.dias_uteis).toFixed(1)) : 0;
  const metaSemanal = (m: any) => m.dias_uteis > 0 ? Number((m.meta_mensal / m.dias_uteis * 5).toFixed(1)) : 0;

  const vendasDoFuncionario = (nome: string) => {
    const vendedor = stats?.vendedores?.find((v: any) =>
      v.nome.toLowerCase().trim() === nome.toLowerCase().trim()
    );
    return vendedor?.vendas ?? 0;
  };

  const diasUteisPassados = () => {
    const hoje = new Date();
    const inicioM = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    let dias = 0;
    for (let d = new Date(inicioM); d <= hoje; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) dias++;
    }
    return dias;
  };

  const projecao = (m: any, vendasAtuais: number) => {
    const diasPassados = diasUteisPassados();
    if (diasPassados === 0) return 0;
    const ritmoAtual = vendasAtuais / diasPassados;
    return Math.round(ritmoAtual * m.dias_uteis);
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Painel de Funcionários
          </h1>
          <p className="text-muted-foreground text-sm">Metas, desempenho e projeção do mês atual.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Funcionário
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{metas.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Funcionários</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats?.total?.vendas ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Vendas no mês</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">
            {metas.reduce((s, m) => s + m.meta_mensal, 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Meta total do mês</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {metas.length > 0 && (stats?.total?.vendas ?? 0) > 0
              ? `${Math.round((stats.total.vendas / metas.reduce((s: number, m: any) => s + m.meta_mensal, 0)) * 100)}%`
              : "0%"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Atingimento geral</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metas.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground col-span-full">
            Nenhum funcionário cadastrado. Clique em \"Novo Funcionário\" para começar.
          </Card>
        )}
        {metas.map((m) => {
          const vendas = vendasDoFuncionario(m.nome);
          const proj = projecao(m, vendas);
          const proj_cor = proj >= m.meta_mensal ? "text-emerald-600" : proj >= m.meta_mensal * 0.8 ? "text-yellow-600" : "text-red-500";
          return (
            <Card key={m.id} className="p-4 space-y-3 cursor-pointer hover:border-primary/40 transition"
              onClick={() => setSelected(selected?.id === m.id ? null : m)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{m.nome}</h3>
                  <p className="text-xs text-muted-foreground">{m.mes_referencia}</p>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(m)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={() => deleteMut.mutate(m.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <ProgressBar valor={vendas} meta={m.meta_mensal} />

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-muted/40 rounded p-2">
                  <p className="font-semibold text-base">{vendas}</p>
                  <p className="text-muted-foreground">Vendas</p>
                </div>
                <div className="bg-muted/40 rounded p-2">
                  <p className="font-semibold text-base">{metaDiaria(m)}</p>
                  <p className="text-muted-foreground">Meta/dia</p>
                </div>
                <div className="bg-muted/40 rounded p-2">
                  <p className="font-semibold text-base">{metaSemanal(m)}</p>
                  <p className="text-muted-foreground">Meta/sem</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t">
                <span className="text-muted-foreground">Projeção do mês:</span>
                <span className={`font-semibold ${proj_cor}`}>{proj} vendas</span>
              </div>
            </Card>
          );
        })}
      </div>

      {selected && (
        <Card className="p-5 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Detalhes — {selected.nome}
            </h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelected(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{vendasDoFuncionario(selected.nome)}</p>
              <p className="text-xs text-muted-foreground">Vendas realizadas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{selected.meta_mensal}</p>
              <p className="text-xs text-muted-foreground">Meta mensal</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{selected.meta_mensal - vendasDoFuncionario(selected.nome)}</p>
              <p className="text-xs text-muted-foreground">Faltam para meta</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{selected.dias_uteis}</p>
              <p className="text-xs text-muted-foreground">Dias úteis no mês</p>
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar valor={vendasDoFuncionario(selected.nome)} meta={selected.meta_mensal} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 text-center text-sm">
            <Card className="p-3">
              <p className="text-lg font-bold text-primary">{metaDiaria(selected)}</p>
              <p className="text-xs text-muted-foreground">Meta por dia</p>
            </Card>
            <Card className="p-3">
              <p className="text-lg font-bold text-primary">{metaSemanal(selected)}</p>
              <p className="text-xs text-muted-foreground">Meta por semana</p>
            </Card>
            <Card className="p-3">
              <p className={`text-lg font-bold ${projecao(selected, vendasDoFuncionario(selected.nome)) >= selected.meta_mensal ? "text-emerald-600" : "text-red-500"}`}>{projecao(selected, vendasDoFuncionario(selected.nome))}</p>
              <p className="text-xs text-muted-foreground">Projeção do mês</p>
            </Card>
          </div>
          {stats?.vendedores?.find((v: any) => v.nome.toLowerCase().trim() === selected.nome.toLowerCase().trim()) && (
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm border-t pt-4">
              {(() => {
                const v = stats.vendedores.find((v: any) => v.nome.toLowerCase().trim() === selected.nome.toLowerCase().trim());
                return (
                  <>
                    <Card className="p-3">
                      <p className="text-lg font-bold">{v.tentativas}</p>
                      <p className="text-xs text-muted-foreground">Tentativas</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-lg font-bold text-yellow-600">{v.oportunidades}</p>
                      <p className="text-xs text-muted-foreground">Oportunidades</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-lg font-bold">{v.conversao}%</p>
                      <p className="text-xs text-muted-foreground">Conversão</p>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)}
                placeholder="Nome exato como aparece nas prospecções" />
              <p className="text-xs text-muted-foreground mt-1">
                Use o mesmo nome que está no Controle de Prospecções para vincular os dados automaticamente.
              </p>
            </div>
            <div>
              <Label>Mês de referência</Label>
              <Input value={form.mes_referencia} onChange={(e) => set("mes_referencia", e.target.value)}
                placeholder="Ex: Julho/2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Meta mensal (vendas)</Label>
                <Input type="number" min={0} value={form.meta_mensal}
                  onChange={(e) => set("meta_mensal", Number(e.target.value))} />
              </div>
              <div>
                <Label>Dias úteis no mês</Label>
                <Input type="number" min={1} max={31} value={form.dias_uteis}
                  onChange={(e) => set("dias_uteis", Number(e.target.value))} />
              </div>
            </div>
            {form.meta_mensal > 0 && form.dias_uteis > 0 && (
              <div className="bg-muted/40 rounded p-3 grid grid-cols-2 gap-2 text-center text-sm">
                <div>
                  <p className="font-semibold">{(form.meta_mensal / form.dias_uteis).toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Meta diária</p>
                </div>
                <div>
                  <p className="font-semibold">{(form.meta_mensal / form.dias_uteis * 5).toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Meta semanal</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsertMut.mutate(form)}
              disabled={!form.nome || upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
