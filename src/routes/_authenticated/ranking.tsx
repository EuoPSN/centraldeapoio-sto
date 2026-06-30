import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRanking, getMyGamification, levelFromXp } from "@/lib/gamification.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: RankingPage,
});

function RankingPage() {
  const rankingFn = useServerFn(getRanking);
  const myFn = useServerFn(getMyGamification);
  const rankingQ = useQuery({ queryKey: ["ranking"], queryFn: () => rankingFn() });
  const myQ = useQuery({ queryKey: ["my-gamification"], queryFn: () => myFn() });

  const ranking = rankingQ.data ?? [];
  const my = myQ.data;
  const myLevel = my ? levelFromXp(my.xp) : null;

  const medalColor = (i: number) =>
    i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Ranking
        </h1>
        <p className="text-muted-foreground text-sm">Veja sua evolução e a dos seus colegas no treinamento.</p>
      </div>

      {my && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Seu progresso</p>
              <p className="text-lg font-semibold">{my.display_name ?? "Você"}</p>
            </div>
            <div className="text-right">
              <Badge>{myLevel?.label}</Badge>
              <p className="text-2xl font-bold text-primary mt-1">{my.xp} XP</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="divide-y">
        {ranking.map((u: any, i: number) => (
          <div key={u.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Medal className={`h-5 w-5 ${medalColor(i)}`} />
              <span className="text-sm font-medium">#{i + 1} {u.display_name ?? "Atendente"}</span>
            </div>
            <span className="text-sm font-semibold text-primary">{u.xp ?? 0} XP</span>
          </div>
        ))}
        {ranking.length === 0 && (
          <p className="text-center text-muted-foreground p-8 text-sm">
            Nenhum dado ainda. Complete simulações para aparecer no ranking!
          </p>
        )}
      </Card>
    </div>
  );
}
