import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  getDashboardOverview,
  listCargosAndUsers,
} from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard, Users, PlayCircle, CheckCircle2, TrendingUp, TrendingDown,
  Bot, GraduationCap, Trophy, AlertTriangle, Loader2, RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-8 max-w-xl mx-auto space-y-3">
      <h2 className="text-lg font-semibold text-destructive">Erro ao carregar dashboard</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset} variant="outline" size="sm">Tentar novamente</Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground">Página não encontrada.</div>
  ),
});

const PERIODOS = [
  { v: 7, l: "Últimos 7 dias" },
  { v: 30, l: "Últimos 30 dias" },
  { v: 90, l: "Últimos 90 dias" },
];

function StatCard({
  icon: Icon, label, value, hint, tone = "default",
}: {
  icon: any; label: string; value: string | number; hint?: string;
  tone?: "default" | "success" | "warning" | "primary";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    primary: "text-primary",
  };
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className="p-2 rounded-md bg-muted">
        <Icon className={`h-5 w-5 ${tones[tone]}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={`text-2xl font-bold leading-tight ${tones[tone]}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function DashboardPage() {
  const overviewFn = useServerFn(getDashboardOverview);
  const listFn = useServerFn(listCargosAndUsers);

  const [dias, setDias] = useState(30);
  const [cargo, setCargo] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const listQ = useQuery({
    queryKey: ["dashboard-lists"],
    queryFn: () => listFn({}),
    staleTime: 5 * 60_000,
  });

  const overviewQ = useQuery({
    queryKey: ["dashboard-overview", dias, cargo, userId],
    queryFn: () =>
      overviewFn({
        data: {
          dias,
          cargo: cargo || undefined,
          userId: userId || undefined,
        },
      }),
    refetchInterval: 60_000,
    retry: 1,
  });

  const users = (listQ.data as any)?.users ?? [];
  const cargos = ((listQ.data as any)?.cargos ?? []) as string[];
  const d = overviewQ.data as any;

  const usersDoCargo = useMemo(
    () => (cargo ? users.filter((u: any) => u.cargo === cargo) : users),
    [users, cargo],
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" /> Dashboard Geral
          </h1>
          <p className="text-muted-foreground text-sm">
            Visão administrativa da operação da plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.v} value={String(p.v)}>{p.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cargo || "__all"} onValueChange={(v) => { setCargo(v === "__all" ? "" : v); setUserId(""); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos cargos</SelectItem>
              {cargos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={userId || "__all"} onValueChange={(v) => setUserId(v === "__all" ? "" : v)}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Usuário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos usuários</SelectItem>
              {usersDoCargo.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{u.display_name ?? u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm" variant="outline"
            onClick={() => overviewQ.refetch()}
            disabled={overviewQ.isFetching}
          >
            {overviewQ.isFetching
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {overviewQ.isLoading && (
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Carregando indicadores...
        </div>
      )}

      {overviewQ.isError && (
        <Card className="p-6 border-destructive/50">
          <p className="text-sm text-destructive">
            Erro ao carregar dados: {(overviewQ.error as Error)?.message}
          </p>
        </Card>
      )}

      {d && (
        <>
          {/* CARDS */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <StatCard icon={Users} label="Usuários totais" value={d.cards.totalUsuarios} tone="primary" />
            <StatCard icon={Users} label="Ativos (30d)" value={d.cards.usuariosAtivos}
              hint={`${d.cards.totalUsuarios ? Math.round((d.cards.usuariosAtivos / d.cards.totalUsuarios) * 100) : 0}% da base`}
              tone="success" />
            <StatCard icon={PlayCircle} label="Simulações realizadas" value={d.cards.simulacoesRealizadas} />
            <StatCard icon={CheckCircle2} label="Simulações concluídas" value={d.cards.simulacoesConcluidas} tone="success" />
            <StatCard icon={Trophy} label="Média geral" value={d.cards.mediaGeral || "—"}
              hint="Nota média dos simulados no período" tone="primary" />
            <StatCard icon={Bot} label="Mensagens IA" value={d.cards.iaMensagens} />
            <StatCard icon={GraduationCap} label="Taxa conclusão treinamentos"
              value={`${d.cards.taxaConclusao}%`}
              hint={`${d.cards.totalTreinamentos} treinamentos disponíveis`}
              tone={d.cards.taxaConclusao >= 60 ? "success" : "warning"} />
            <StatCard icon={LayoutDashboard} label="Conteúdo mais acessado"
              value={d.conteudosMaisAcessados[0]?.acessos ?? 0}
              hint={d.conteudosMaisAcessados[0]?.title ?? "Sem acessos registrados"} />
          </div>

          {/* CHARTS */}
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Evolução dos simulados">
              <LineChart data={d.series.simulados}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dia" tickFormatter={fmtDay} className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip labelFormatter={(v) => fmtDay(String(v))} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
            <ChartCard title="Evolução da nota média">
              <LineChart data={d.series.notas}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dia" tickFormatter={fmtDay} className="text-xs" />
                <YAxis domain={[0, 10]} className="text-xs" />
                <Tooltip labelFormatter={(v) => fmtDay(String(v))} />
                <Line type="monotone" dataKey="media" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
            <ChartCard title="Utilização da plataforma (acessos/dia)">
              <BarChart data={d.series.acessos}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dia" tickFormatter={fmtDay} className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip labelFormatter={(v) => fmtDay(String(v))} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Ranking uso da IA">
              <BarChart data={d.rankings.ia} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" allowDecimals={false} className="text-xs" />
                <YAxis type="category" dataKey="nome" width={120} className="text-xs" />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartCard>
          </div>

          {/* RANKINGS + INDICADORES */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" /> Ranking de colaboradores
              </h3>
              {d.rankings.colaboradores.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem simulados no período.</p>
              ) : (
                <ul className="space-y-2">
                  {d.rankings.colaboradores.map((c: any, i: number) => (
                    <li key={c.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}º</span>
                        <span className="truncate">{c.nome}</span>
                        <Badge variant="outline" className="text-[10px]">{c.cargo}</Badge>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">{c.simulados} sim.</span>
                        <span className="font-semibold text-primary">{c.media}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Ranking por equipe (cargo)
              </h3>
              {d.rankings.cargos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem dados.</p>
              ) : (
                <ul className="space-y-2">
                  {d.rankings.cargos.map((c: any) => (
                    <li key={c.cargo} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate font-medium">{c.cargo}</span>
                        <span className="text-xs text-muted-foreground">({c.membros} pessoas)</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">{c.simulados} sim.</span>
                        <span className="font-semibold text-primary">{c.media}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> Maior evolução
              </h3>
              {d.indicadores.maiorEvolucao.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem histórico suficiente.</p>
              ) : (
                <ul className="space-y-2">
                  {d.indicadores.maiorEvolucao.map((e: any) => (
                    <li key={e.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{e.nome}</span>
                      <span className={`font-semibold ${e.delta > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {e.delta > 0 ? "+" : ""}{e.delta}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" /> Queda de desempenho
              </h3>
              {d.indicadores.quedaDesempenho.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Ninguém em queda no período.</p>
              ) : (
                <ul className="space-y-2">
                  {d.indicadores.quedaDesempenho.map((e: any) => (
                    <li key={e.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{e.nome}</span>
                      <span className="font-semibold text-destructive">{e.delta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Sem acesso recente (14+ dias)
              </h3>
              {d.indicadores.semAcessoRecente.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Todos com acesso recente.</p>
              ) : (
                <ul className="space-y-2">
                  {d.indicadores.semAcessoRecente.map((u: any) => (
                    <li key={u.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{u.nome}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(u.ultimoAcesso)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Conteúdos mais acessados</h3>
              {d.conteudosMaisAcessados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem acessos registrados.</p>
              ) : (
                <ul className="space-y-2">
                  {d.conteudosMaisAcessados.map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{c.title}</span>
                      <span className="font-semibold text-primary">{c.acessos}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Atualiza automaticamente a cada 60s. Filtros: {d.meta.dias}d
            {d.meta.cargo ? ` · ${d.meta.cargo}` : ""}
            {d.meta.userId ? " · usuário selecionado" : ""}.
            {" "}
            <Link to="/meus-relatorios" className="text-primary underline">Ver relatórios detalhados</Link>
          </p>
        </>
      )}
    </div>
  );
}
