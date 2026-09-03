import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, listPricing } from "@/lib/content.functions";
import { listExames } from "@/lib/exames.functions";
import { listProcedimentos } from "@/lib/odontologia.functions";
import { getRankingDetalhado } from "@/lib/gamification.functions";
import { MessageSquareQuote, Heart, Sparkles, Bot, GraduationCap, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

const shortcuts = [
  { title: "Scripts", icon: MessageSquareQuote, route: "/scripts" },
  { title: "Amor Saúde", icon: Heart, route: "/precos" },
  { title: "Simulador IA", icon: Sparkles, route: "/simulador-ia" },
  { title: "MarcIAna", icon: Bot, route: "/assistente" },
  { title: "Treinamentos", icon: GraduationCap, route: "/treinamentos" },
  { title: "Sugestões", icon: Lightbulb, route: "/sugestoes" },
] as const;

function Home() {
  const me = useServerFn(getMe);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => me({}) });

  const pricing = useServerFn(listPricing);
  const pQ = useQuery({ queryKey: ["pricing"], queryFn: () => pricing({}) });
  const exames = useServerFn(listExames);
  const eQ = useQuery({ queryKey: ["exames"], queryFn: () => exames({}) });
  const procedimentos = useServerFn(listProcedimentos);
  const prQ = useQuery({ queryKey: ["procedimentos"], queryFn: () => procedimentos({}) });
  const rankingFn = useServerFn(getRankingDetalhado);
  const rankingQ = useQuery({ queryKey: ["ranking-home"], queryFn: () => rankingFn() });

  const ranking = (rankingQ.data ?? []) as { id: string }[];
  const minhaPosicao = ranking.findIndex((r) => r.id === meQ.data?.userId);

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <Card className="p-6 mb-8 bg-muted/40 border-none">
        <h1 className="text-2xl font-semibold">Tudo o que você precisa, num só lugar</h1>
        <p className="text-muted-foreground mt-1">
          Scripts, simulados e informações de atendimento pra sua equipe.
        </p>
      </Card>

      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Atalhos</p>
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {shortcuts.map((s) => (
          <Link key={s.route} to={s.route}>
            <Card className="p-4 h-full flex items-center gap-3 hover:bg-muted/50 transition-colors">
              <s.icon className="h-5 w-5 text-primary shrink-0" />
              <span className="font-medium text-sm">{s.title}</span>
            </Card>
          </Link>
        ))}
      </section>

      <Card className="p-4 mb-8 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Seu ranking do mês</span>
        <span className="text-lg font-semibold">
          {minhaPosicao >= 0 ? `${minhaPosicao + 1}º lugar` : "Simule pra entrar no ranking"}
        </span>
      </Card>

      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Cadastrados no sistema</p>
      <Card className="p-4">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-border">
              <td className="py-2 text-muted-foreground">Consultas</td>
              <td className="py-2 text-right font-medium">{pQ.data?.length ?? 0}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2 text-muted-foreground">Exames</td>
              <td className="py-2 text-right font-medium">{eQ.data?.length ?? 0}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Procedimentos odontológicos</td>
              <td className="py-2 text-right font-medium">{prQ.data?.length ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
