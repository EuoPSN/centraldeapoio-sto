import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, listPricing } from "@/lib/content.functions";
import { listExames } from "@/lib/exames.functions";
import { listProcedimentos } from "@/lib/odontologia.functions";
import { getRankingDetalhado } from "@/lib/gamification.functions";
import { listClientProfilesForTraining } from "@/lib/clientprofiles.functions";
import { listHomepageMessages } from "@/lib/homepage.functions";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/components/SimuladorIA";
import { MessageSquareQuote, Heart, Sparkles, Bot, GraduationCap, Lightbulb } from "lucide-react";

type HomeFonte = "padrao" | "arredondada" | "elegante" | "festiva";
type HomeTipo = "padrao" | "data_especial" | "aniversario";
interface HomeMessageRow {
  id: string; titulo: string; subtitulo: string | null; cor_fundo: string; fonte: HomeFonte; tipo: HomeTipo;
  data_inicio: string | null; data_fim: string | null; ativo: boolean; position: number;
}

const HOME_FONT_FAMILY: Record<HomeFonte, string> = {
  padrao: "inherit",
  arredondada: "'Quicksand', sans-serif",
  elegante: "'Playfair Display', serif",
  festiva: "'Fredoka', sans-serif",
};

// Escolhe qual mensagem mostrar: aniversário (se for hoje) > data especial (se hoje cair no período) > padrão (rotaciona por dia).
function pickHomeMessage(messages: HomeMessageRow[], birthdateStr: string | null | undefined): HomeMessageRow | null {
  const today = new Date();
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const ativos = messages.filter((m) => m.ativo);

  if (birthdateStr) {
    const bd = new Date(birthdateStr);
    const birthdayMMDD = `${String(bd.getUTCMonth() + 1).padStart(2, "0")}-${String(bd.getUTCDate()).padStart(2, "0")}`;
    if (birthdayMMDD === todayMMDD) {
      const aniversario = ativos.find((m) => m.tipo === "aniversario");
      if (aniversario) return aniversario;
    }
  }

  const especial = ativos.find((m) => m.tipo === "data_especial" && m.data_inicio && m.data_fim && todayMMDD >= m.data_inicio && todayMMDD <= m.data_fim);
  if (especial) return especial;

  const padroes = ativos.filter((m) => m.tipo === "padrao").sort((a, b) => a.position - b.position);
  if (padroes.length === 0) return null;
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000);
  return padroes[dayOfYear % padroes.length];
}

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

  const homeMsgFn = useServerFn(listHomepageMessages);
  const homeMsgQ = useQuery({ queryKey: ["homepage-messages"], queryFn: () => homeMsgFn({}) });
  const heroMessage = pickHomeMessage((homeMsgQ.data ?? []) as HomeMessageRow[], (meQ.data as any)?.data_nascimento);

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

  // ---- Card "Vamos testar seu atendimento?" ----
  const profilesFn = useServerFn(listClientProfilesForTraining);
  const profilesQ = useQuery({ queryKey: ["client_profiles", "training"], queryFn: () => profilesFn() });
  const [desafio, setDesafio] = useState<any>(null);

  const sortearDesafio = () => {
    const profiles = (profilesQ.data ?? []) as any[];
    if (profiles.length === 0) return;
    setDesafio(profiles[Math.floor(Math.random() * profiles.length)]);
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <Card
        className="p-6 mb-8 border-none"
        style={{
          backgroundColor: heroMessage?.cor_fundo ?? "hsl(var(--muted))",
          fontFamily: heroMessage ? HOME_FONT_FAMILY[heroMessage.fonte] : undefined,
        }}
      >
        <h1 className="text-2xl font-semibold">{heroMessage?.titulo ?? "Tudo o que você precisa, num só lugar"}</h1>
        <p className="text-muted-foreground mt-1">
          {heroMessage?.subtitulo ?? "Scripts, simulados e informações de atendimento pra sua equipe."}
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

      <Card className="p-5 mb-8 flex items-center justify-between gap-3 bg-primary/5 border-primary/20">
        <div>
          <p className="font-medium">Vamos testar seu atendimento no simulador?</p>
          <p className="text-sm text-muted-foreground mt-0.5">A IA sorteia um cliente pra você treinar agora.</p>
        </div>
        <Button onClick={sortearDesafio} disabled={(profilesQ.data ?? []).length === 0} className="shrink-0">Testar agora</Button>
      </Card>

      <Card className="p-4 mb-8 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Seu ranking do mês</span>
        <span className="text-lg font-semibold">
          {minhaPosicao >= 0 ? `${minhaPosicao + 1}º lugar` : "Simule pra entrar no ranking"}
        </span>
      </Card>

      <Dialog open={!!desafio} onOpenChange={(v) => !v && setDesafio(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader><DialogTitle>Seu desafio de hoje</DialogTitle></DialogHeader>
          {desafio && (
            <div className="space-y-3 py-2">
              <p className="font-semibold text-lg">{desafio.name}</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {desafio.difficulty && DIFFICULTY_LABELS[desafio.difficulty] && (
                  <Badge className={DIFFICULTY_COLORS[desafio.difficulty]}>{DIFFICULTY_LABELS[desafio.difficulty]}</Badge>
                )}
                {desafio.category?.name && <Badge variant="outline">{desafio.category.name}</Badge>}
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" onClick={() => setDesafio(null)}>Agora não</Button>
                <Link to="/simulador-ia" search={{ perfil: desafio.id }}>
                  <Button onClick={() => setDesafio(null)}>Iniciar atendimento</Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
