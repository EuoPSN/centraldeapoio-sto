import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRankingDetalhado, getRankingPorPeriodo, levelFromXp, resetarXpTodos } from "@/lib/gamification.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trophy, Medal, RotateCcw, Filter, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: RankingPage,
});

function RankingPage() {
  const qc = useQueryClient();
  const rankingFn = useServerFn(getRankingDetalhado);
  const rankingPeriodoFn = useServerFn(getRankingPorPeriodo);
  const resetFn = useServerFn(resetarXpTodos);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState(false);
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

  const ranking = filtroAtivo
    ? (rankingPeriodoQ.data ?? []) as any[]
    : (rankingGeralQ.data ?? []) as any[];

  const resetMut = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: () => {
      toast.success("Ranking resetado! XP de todos zerado.");
      qc.invalidateQueries({ queryKey: ["ranking-detalhado"] });
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
            <Trophy className="h-6 w-6 text-gold-text" /> Ranking & Evolução
          </h1>
          <p className="text-muted-foreground text-sm">Acompanhe o desempenho da equipe.</p>
        </div>
        <Link to="/simulador-ia" search={{ aba: "minhas" }}
          className="text-sm font-medium text-gold-text hover:underline flex items-center gap-1">
          Meu desempenho e histórico <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

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
            <p className="text-xs text-gold-text mt-2 font-medium">
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
                <span className="text-sm font-semibold text-gold-text">
                  {filtroAtivo ? `Média ${u.media}` : `${u.xp ?? 0} XP`}
                </span>
              </div>
            );
          })}
        </Card>
      </div>

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
