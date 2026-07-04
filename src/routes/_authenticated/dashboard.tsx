import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getProspeccaoStats } from "@/lib/prospeccao.functions";
import { getLeadsFunilStats } from "@/lib/leadsfunil.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, Target, PhoneCall, BarChart2, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function hoje() { return new Date().toISOString().slice(0, 10); }
function inicioMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function StatCard({ label, value, sub, icon: Icon, cor }: {
  label: string; value: string | number; sub?: string;
  icon: any; cor?: string;
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

function FunilBar({ label, valor, total, cor }: { label: string; valor: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{valor} <span className="text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DashboardPage() {
  const prospFn = useServerFn(getProspeccaoStats);
  const leadsFn = useServerFn(getLeadsFunilStats);

  const [periodo, setPeriodo] = useState("mes");
  const [dataInicio, setDataInicio] = useState(inicioMes());
  const [dataFim, setDataFim] = useState(hoje());
  const [origem, setOrigem] = useState("todos");

  const datas = periodo === "hoje"
    ? { dataInicio: hoje(), dataFim: hoje() }
    : periodo === "semana"
    ? { dataInicio: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), dataFim: hoje() }
    : periodo === "mes"
    ? { dataInicio: inicioMes(), dataFim: hoje() }
    : { dataInicio, dataFim };

  const prospQ = useQuery({
    queryKey: ["prosp-stats", datas],
    queryFn: () => prospFn({ data: datas }),
    retry: 1,
  });

  const leadsQ = useQuery({
    queryKey: ["leads-stats", datas, origem],
    queryFn: () => leadsFn({ data: {
      ...datas,
      origem: origem === "todos" ? undefined : origem,
    }}),
    retry: 1,
  });

  const prosp = prospQ.data as any;
  const leads = leadsQ.data as any;

  return (
    <div className="space-y-6 p-6 lg:p-10 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary" /> Dashboard Geral
        </h1>
        <p className="text-muted-foreground text-sm">Visão consolidada de prospecções e leads.</p>
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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Origem dos leads</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as origens</SelectItem>
                <SelectItem value="Tráfego Pago">Tráfego Pago</SelectItem>
                <SelectItem value="Central">Central</SelectItem>
                <SelectItem value="Geral">Geral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Prospecções
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total de Tentativas" value={prosp?.total?.tentativas ?? 0} icon={PhoneCall} />
          <StatCard label="Oportunidades" value={prosp?.total?.oportunidades ?? 0} icon={Target} />
          <StatCard label="Vendas" value={prosp?.total?.vendas ?? 0} icon={TrendingUp} cor="bg-emerald-500" />
          <StatCard label="Taxa de Conversão" value={`${prosp?.total?.conversao ?? "0.0"}%`} icon={ArrowUpRight} />
        </div>
      </div>

      {prosp?.canais && prosp.canais.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {prosp.canais.map((c: any) => (
            <Card key={c.nome} className="p-4">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">{c.nome}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold">{c.tentativas}</p>
                  <p className="text-xs text-muted-foreground">Tentativas</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-600">{c.oportunidades}</p>
                  <p className="text-xs text-muted-foreground">Oportunidades</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">{c.vendas}</p>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {prosp?.vendedores && prosp.vendedores.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Ranking de Prospecções
          </h2>
          <Card className="divide-y">
            <div className="grid grid-cols-5 p-3 text-xs text-muted-foreground font-medium">
              <span className="col-span-2">Vendedor</span>
              <span className="text-center">Tentativas</span>
              <span className="text-center">Vendas</span>
              <span className="text-center">Conv.%</span>
            </div>
            {prosp.vendedores.map((v: any, i: number) => (
              <div key={v.nome} className="grid grid-cols-5 p-3 text-sm items-center hover:bg-muted/30">
                <span className="col-span-2 font-medium flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">#{i + 1}</span>
                  {v.nome}
                </span>
                <span className="text-center">{v.tentativas}</span>
                <span className="text-center font-semibold text-emerald-600">{v.vendas}</span>
                <span className="text-center text-xs text-muted-foreground">{v.conversao}%</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Funil de Leads
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Leads Entrados" value={leads?.leads_entrados ?? 0} icon={Users} />
          <StatCard label="Qualificados" value={leads?.qualificados ?? 0} icon={Target} />
          <StatCard label="Vendas Fechadas" value={leads?.vendas_fechadas ?? 0} icon={TrendingUp} cor="bg-emerald-500" />
          <StatCard label="Conv. Lead→Venda" value={`${leads?.conv_lead_venda ?? "0.0"}%`} icon={ArrowUpRight} />
        </div>

        {leads && (
          <Card className="p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progressão do Funil</p>
            <FunilBar label="Leads Entrados" valor={leads.leads_entrados ?? 0} total={leads.leads_entrados ?? 1} cor="bg-blue-500" />
            <FunilBar label="Qualificados" valor={leads.qualificados ?? 0} total={leads.leads_entrados ?? 1} cor="bg-indigo-500" />
            <FunilBar label="Apresentação" valor={leads.apresentacao ?? 0} total={leads.leads_entrados ?? 1} cor="bg-violet-500" />
            <FunilBar label="Negociação" valor={leads.negociacao ?? 0} total={leads.leads_entrados ?? 1} cor="bg-purple-500" />
            <FunilBar label="Vendas Fechadas" valor={leads.vendas_fechadas ?? 0} total={leads.leads_entrados ?? 1} cor="bg-emerald-500" />
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Perdidos/Parados</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-red-500">{leads.sem_interesse ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Sem Interesse</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-orange-500">{leads.nao_responde ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Não Responde</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-600">{leads.desqualificados ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Desqualificados</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}