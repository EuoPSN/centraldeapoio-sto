import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardOperacional } from "@/lib/painel.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, BarChart2, Target, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function hoje() { return new Date().toISOString().slice(0, 10); }
function inicioMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function StatCard({ label, value, sub, icon: Icon, cor }: {
  label: string; value: string | number; sub?: string; icon: any; cor?: string;
}) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${cor ?? "bg-primary/10"}`}>
        <Icon className={`h-5 w-5 ${cor ? "text-white" : "text-primary"}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold text-primary">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function nivelCor(nivel: string | null) {
  if (!nivel) return "bg-muted text-muted-foreground";
  return { P1: "bg-red-100 text-red-700", P2: "bg-yellow-100 text-yellow-700", P3: "bg-blue-100 text-blue-700", P4: "bg-emerald-100 text-emerald-700" }[nivel] ?? "bg-muted text-muted-foreground";
}

function DashboardPage() {
  const fn = useServerFn(getDashboardOperacional);
  const [periodo, setPeriodo] = useState("mes");
  const [dataInicio, setDataInicio] = useState(inicioMes());
  const [dataFim, setDataFim] = useState(hoje());

  const datas = periodo === "hoje" ? { dataInicio: hoje(), dataFim: hoje() }
    : periodo === "semana" ? { dataInicio: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), dataFim: hoje() }
    : periodo === "mes" ? { dataInicio: inicioMes(), dataFim: hoje() }
    : { dataInicio, dataFim };

  const q = useQuery({
    queryKey: ["dashboard-op", datas],
    queryFn: () => fn({ data: datas }),
    retry: 1,
  });

  const d = q.data as any;

  return (
    <div className="space-y-6 p-6 lg:p-10 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary" /> Dashboard Operacional
        </h1>
        <p className="text-muted-foreground text-sm">Indicadores reais da equipe baseados em simulações e relatórios.</p>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Últimos 7 dias</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodo === "custom" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-40" />
              </div>
            </>
          )}
        </div>
      </Card>

      {q.isLoading && <p className="text-center text-muted-foreground py-10">Carregando indicadores...</p>}

      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Funcionários" value={d.cards.totalFuncionarios} icon={Users} />
            <StatCard label="Simulações" value={d.cards.totalSims} icon={Target} />
            <StatCard label="Nota média" value={d.cards.mediaNota} icon={Trophy} cor="bg-primary" />
            <StatCard label="Vendas no período" value={d.cards.totalVendas} icon={TrendingUp} cor="bg-emerald-500" />
            <StatCard label="Tentativas" value={d.cards.totalTentativas} icon={BarChart2} />
          </div>

          {d.ranking.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Ranking da equipe — nota média nas simulações
              </h2>
              <Card className="divide-y">
                <div className="grid grid-cols-6 p-3 text-xs text-muted-foreground font-medium">
                  <span className="col-span-2">Funcionário</span>
                  <span className="text-center">Cargo</span>
                  <span className="text-center">Simulações</span>
                  <span className="text-center">Nota média</span>
                  <span className="text-center">Nível</span>
                </div>
                {d.ranking.map((r: any, i: number) => (
                  <div key={r.userId} className="grid grid-cols-6 p-3 text-sm items-center hover:bg-muted/30">
                    <span className="col-span-2 font-medium flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">#{i + 1}</span>
                      {r.nome}
                    </span>
                    <span className="text-center text-xs text-muted-foreground">{r.cargo ?? "—"}</span>
                    <span className="text-center">{r.simulacoes}</span>
                    <span className={`text-center font-semibold ${r.media >= 70 ? "text-emerald-600" : r.media >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                      {r.media}
                    </span>
                    <span className="text-center">
                      {r.nivel_lideranca
                        ? <Badge className={`text-xs ${nivelCor(r.nivel_lideranca)}`}>{r.nivel_lideranca}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {d.evolucao.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> Maior evolução no período
                </h3>
                <ul className="space-y-2">
                  {d.evolucao.filter((e: any) => e.delta > 0).slice(0, 5).map((e: any) => (
                    <li key={e.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{e.nome}</span>
                      <span className="font-semibold text-emerald-600">+{e.delta} pts</span>
                    </li>
                  ))}
                  {d.evolucao.filter((e: any) => e.delta > 0).length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem evolução registrada.</p>
                  )}
                </ul>
              </Card>
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" /> Atenção — queda de desempenho
                </h3>
                <ul className="space-y-2">
                  {d.evolucao.filter((e: any) => e.delta < 0).slice(0, 5).map((e: any) => (
                    <li key={e.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{e.nome}</span>
                      <span className="font-semibold text-red-500">{e.delta} pts</span>
                    </li>
                  ))}
                  {d.evolucao.filter((e: any) => e.delta < 0).length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma queda registrada.</p>
                  )}
                </ul>
              </Card>
            </div>
          )}

          {d.serieNotas.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Evolução da nota média diária</h3>
              <div className="flex items-end gap-1 h-24">
                {d.serieNotas.map((s: any) => {
                  const pct = Math.round((s.media / 100) * 100);
                  const cor = s.media >= 70 ? "bg-emerald-500" : s.media >= 40 ? "bg-yellow-500" : "bg-red-400";
                  return (
                    <div key={s.dia} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition">{s.media}</span>
                      <div className={`w-full rounded-t ${cor}`} style={{ height: `${Math.max(pct, 4)}%` }} title={`${s.dia}: ${s.media}`} />
                      <span className="text-[10px] text-muted-foreground">{s.dia.slice(8)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}