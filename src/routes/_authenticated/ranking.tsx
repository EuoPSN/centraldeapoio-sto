import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRankingDetalhado, getRankingPorPeriodo,
  getMyHistory, levelFromXp, resetarXpTodos
} from "@/lib/gamification.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trophy, Medal, Star, Target, TrendingUp, Eye, RotateCcw, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: RankingPage,
});

const DIFFICULTY_COLORS: Record<string, string> = {
  facil: "bg-green-100 text-green-800",
  medio: "bg-yellow-100 text-yellow-800",
  dificil: "bg-orange-100 text-orange-800",
  especialista: "bg-red-100 text-red-800",
};
const DIFFICULTY_LABELS: Record<string, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
  especialista: "Especialista",
};

function notaCor(n: number) {
  return n >= 70 ? "text-emerald-600" : n >= 40 ? "text-yellow-600" : "text-red-600";
}

function RankingPage() {
  const qc = useQueryClient();
  const rankingFn = useServerFn(getRankingDetalhado);
  const rankingPeriodoFn = useServerFn(getRankingPorPeriodo);
  const myFn = useServerFn(getMyHistory);
  const resetFn = useServerFn(resetarXpTodos);

  const [tab, setTab] = useState<"ranking" | "meu">("ranking");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const rankingGeralQ = useQuery({
    queryKey: ["ranking-detalhado"],
    queryFn: () => rankingFn(),
    enabled: !filtroAtivo,
  });

  const rankingPeriodoQ = useQuery({
    queryKey: ["ranking-periodo", dataInicio, dataFim],
    queryFn: () => rankingPeriodoFn({ data: { dataInicio, dataFim } }),
    enabled: filtroAtivo,
  });

  const myQ = useQuery({ queryKey: ["my-history"], queryFn: () => myFn() });

  const ranking = filtroAtivo
    ? (rankingPeriodoQ.data ?? []) as any[]
    : (rankingGeralQ.data ?? []) as any[];

  const my = myQ.data as any;
  const myLevel = my ? levelFromXp(my.xp) : null;

  const resetMut = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: () => {
      toast.success("Ranking resetado! XP de todos zerado.");
      qc.invalidateQueries({ queryKey: ["ranking-detalhado"] });
      qc.invalidateQueries({ queryKey: ["my-history"] });
      setConfirmReset(false);
    },
    onError: () => toast.error("Erro ao resetar o ranking."),
  });

  const aplicarFiltro = () => {
    if (!dataInicio && !dataFim) {
      toast.error("Selecione pelo menos uma data.");
      return;
    }
    setFiltroAtivo(true);
  };

  const limparFiltro = () => {
    setDataInicio("");
    setDataFim("");
    setFiltroAtivo(false);
  };

  const top3 = ranking.slice(0, 3);
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumHeight = ["h-20", "h-28", "h-16"];
  const podiumPos = [1, 0, 2];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" /> Ranking & Evolução
          </h1>
          <p className="text-muted-foreground text-sm">Acompanhe seu desempenho e o dos seus colegas.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTab("ranking")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === "ranking" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            Ranking Geral
          </button>
          <button onClick={() => setTab("meu")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === "meu" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            Meu Dashboard
          </button>
        </div>
      </div>

      {tab === "ranking" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-40" />
              </div>
              <Button onClick={aplicarFiltro} className="gap-2">
                <Filter className="h-4 w-4" /> Filtrar
              </Button>
              {filtroAtivo && (
                <Button variant="outline" onClick={limparFiltro} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Limpar filtro
                </Button>
              )}
              <div className="ml-auto">
                <Button variant="destructive" size="sm" onClick={() => setConfirmReset(true)} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Reiniciar Ranking
                </Button>
              </div>
            </div>
            {filtroAtivo && (
              <p className="text-xs text-primary mt-2 font-medium">
                Exibindo: {dataInicio && `de ${new Date(dataInicio).toLocaleDateString("pt-BR")}`} {dataFim && `até ${new Date(dataFim).toLocaleDateString("pt-BR")}`} — ranked por média de notas
              </p>
            )}
          </Card>

          {top3.length === 3 && (
            <Card className="p-6">
              <p className="text-center text-sm font-medium text-muted-foreground mb-6">🏆 Top 3</p>
              <div className="flex items-end justify-center gap-4">
                {podiumOrder.map((u: any, idx: number) => {
                  const pos = podiumPos[idx];
                  const colors = ["bg-yellow-400", "bg-gray-300", "bg-amber-600"];
                  const icons = ["🥇", "🥈", "🥉"];
                  const level = levelFromXp(u.xp ?? 0);
                  return (
                    <div key={u.id} className="flex flex-col items-center gap-2">
                      <span className="text-2xl">{icons[pos]}</span>
                      <div className="text-center">
                        <p className="text-sm font-semibold">{u.display_name ?? "Atendente"}</p>
                        <Badge className="text-xs mt-1">{level.label}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{u.xp ?? 0} XP</p>
                        <p className="text-xs text-muted-foreground">Média: {u.media} · {u.total} sim.</p>
                      </div>
                      <div className={`w-20 ${podiumHeight[idx]} ${colors[pos]} rounded-t-md`} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="divide-y">
            {ranking.length === 0 && (
              <p className="text-center text-muted-foreground p-8 text-sm">
                {filtroAtivo ? "Nenhuma simulação no período selecionado." : "Nenhum dado ainda. Complete simulações para aparecer no ranking!"}
              </p>
            )}
            {ranking.map((u: any, i: number) => {
              const level = levelFromXp(u.xp ?? 0);
              const medal = i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground";
              return (
                <div key={u.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Medal className={`h-5 w-5 ${medal}`} />
                    <div>
                      <p className="text-sm font-medium">#{i + 1} {u.display_name ?? "Atendente"}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.total} simulações · Média {u.media}
                        {" "}· {level.label}
                        {u.melhor > 0 && ` · Melhor: ${u.melhor}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {filtroAtivo ? `Média ${u.media}` : `${u.xp ?? 0} XP`}
                  </span>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {tab === "meu" && my && (
        <div className="space-y-4">
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Seu progresso</p>
                <p className="text-lg font-semibold">{my.display_name ?? "Você"}</p>
                <Badge className="mt-1">{myLevel?.label}</Badge>
              </div>
              <p className="text-3xl font-bold text-primary">{my.xp} XP</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-background rounded-lg border">
                <Target className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{my.total}</p>
                <p className="text-xs text-muted-foreground">Simulações</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg border">
                <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className={`text-xl font-bold ${notaCor(my.media)}`}>{my.media}</p>
                <p className="text-xs text-muted-foreground">Média geral</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg border">
                <Star className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                <p className={`text-xl font-bold ${notaCor(my.melhor)}`}>{my.melhor}</p>
                <p className="text-xs text-muted-foreground">Melhor nota</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg border">
                <Trophy className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold truncate">{my.maisUsado || "—"}</p>
                <p className="text-xs text-muted-foreground">Mais treinado</p>
              </div>
            </div>
          </Card>

          <div>
            <h3 className="text-sm font-semibold mb-3">Histórico de simulações</h3>
            <Card className="divide-y">
              {my.results.length === 0 && (
                <p className="text-center text-muted-foreground p-8 text-sm">
                  Nenhuma simulação ainda. Vá em Scripts → Simulador → Modo IA!
                </p>
              )}
              {my.results.map((r: any) => (
                <button key={r.id} onClick={() => setSelectedResult(r)} className="w-full text-left p-4 hover:bg-muted/40 transition flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.profile_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${DIFFICULTY_COLORS[r.difficulty]}`}>{DIFFICULTY_LABELS[r.difficulty] ?? r.difficulty}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-lg font-bold ${notaCor(r.nota)}`}>{r.nota}</span>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </Card>
          </div>
        </div>
      )}

      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedResult && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedResult.profile_name} — {new Date(selectedResult.created_at).toLocaleDateString("pt-BR")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="text-center">
                  <span className={`text-4xl font-bold ${notaCor(selectedResult.nota)}`}>{selectedResult.nota}</span>
                  <span className="text-muted-foreground">/100</span>
                </div>
                <p className="text-sm text-muted-foreground">{selectedResult.resumo}</p>
                {selectedResult.pontos_fortes?.length > 0 && (
                  <div><p className="text-xs font-semibold text-emerald-700 mb-1">✅ Pontos fortes</p>
                    <ul className="text-xs space-y-0.5">{selectedResult.pontos_fortes.map((p: string, i: number) => <li key={i}>• {p}</li>)}</ul></div>
                )}
                {selectedResult.pontos_melhoria?.length > 0 && (
                  <div><p className="text-xs font-semibold text-yellow-700 mb-1">⚠️ Pontos de melhoria</p>
                    <ul className="text-xs space-y-0.5">{selectedResult.pontos_melhoria.map((p: string, i: number) => <li key={i}>• {p}</li>)}</ul></div>
                )}
                {selectedResult.erros?.length > 0 && (
                  <div><p className="text-xs font-semibold text-red-700 mb-1">❌ Erros</p>
                    <ul className="text-xs space-y-0.5">{selectedResult.erros.map((p: string, i: number) => <li key={i}>• {p}</li>)}</ul></div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reiniciar Ranking?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso vai zerar o XP de <strong>todos os atendentes</strong>. 
            O histórico de simulações é mantido, mas o ranking volta do zero.
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => resetMut.mutate()} disabled={resetMut.isPending}>
              {resetMut.isPending ? "Resetando..." : "Sim, reiniciar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
