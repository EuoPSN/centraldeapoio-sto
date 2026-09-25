import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
import { listPromoPlans } from "@/lib/promoplans.functions";
import { getMyChecklistToday } from "@/lib/checklist.functions";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/components/SimuladorIA";
import { MessageSquareQuote, Heart, Sparkles, Bot, GraduationCap, Lightbulb, ListChecks } from "lucide-react";

type HomeFonte = "padrao" | "arredondada" | "elegante" | "festiva";
type HomeTipo = "padrao" | "data_especial" | "aniversario";
interface HomeMessageRow {
  id: string; titulo: string; subtitulo: string | null; cor_fundo: string; cor_fundo_2?: string | null; fonte: HomeFonte; tipo: HomeTipo;
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
  { title: "Scripts", icon: MessageSquareQuote, route: "/scripts", gradient: "linear-gradient(135deg, #22D3EE, #0EA5E9)" },
  { title: "Amor Saúde", icon: Heart, route: "/precos", gradient: "linear-gradient(135deg, #FB7185, #E11D48)" },
  { title: "Simulador IA", icon: Sparkles, route: "/simulador-ia", gradient: "linear-gradient(135deg, #A78BFA, #7C3AED)" },
  { title: "MarcIAna", icon: Bot, route: "/assistente", gradient: "linear-gradient(135deg, #34D399, #059669)" },
  { title: "Treinamentos", icon: GraduationCap, route: "/treinamentos", gradient: "linear-gradient(135deg, #FBBF24, #D97706)" },
  { title: "Sugestões", icon: Lightbulb, route: "/sugestoes", gradient: "linear-gradient(135deg, #38BDF8, #6366F1)" },
] as const;

interface PromoPlanRow {
  id: string; nome: string; preco_primeiro_mes: number; preco_demais_meses: number;
  cor_fundo: string; cor_fundo_2: string | null; ativo: boolean; position: number;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Carrossel de planos em promoção — avança sozinho, devagar, e para de deslizar
// quando só há um plano ativo. Some da tela quando não há nenhum plano ativo.
function PromoPlansCarousel() {
  const promoFn = useServerFn(listPromoPlans);
  const promoQ = useQuery({ queryKey: ["promo-plans"], queryFn: () => promoFn({}) });
  const plans = ((promoQ.data ?? []) as PromoPlanRow[]).filter((p) => p.ativo).sort((a, b) => a.position - b.position);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (plans.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % plans.length), 4500);
    return () => clearInterval(t);
  }, [plans.length]);

  if (plans.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="overflow-hidden rounded-xl">
        <div className="flex transition-transform duration-1000 ease-in-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {plans.map((p) => (
            <div key={p.id} className="w-full shrink-0 px-0.5 flex justify-center">
              <Card
                className="p-6 border-none text-white text-center rounded-2xl shadow-lg w-full max-w-[260px] aspect-square flex flex-col items-center justify-center"
                style={{ background: p.cor_fundo_2 ? `linear-gradient(135deg, ${p.cor_fundo}, ${p.cor_fundo_2})` : p.cor_fundo }}
              >
                <p className="font-extrabold uppercase tracking-wide text-lg">{p.nome}</p>
                <div className="mt-4">
                  <p className="text-xs opacity-90 uppercase tracking-wide">1° Mês</p>
                  <p className="text-2xl font-extrabold">{formatBRL(p.preco_primeiro_mes)}</p>
                </div>
                <div className="mt-4">
                  <p className="text-xs opacity-90 uppercase tracking-wide">A partir do 2° Mês</p>
                  <p className="text-2xl font-extrabold">{formatBRL(p.preco_demais_meses)}</p>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
      {plans.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {plans.map((p, i) => (
            <button key={p.id} onClick={() => setIdx(i)} aria-label={`Ver ${p.nome}`}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// Card com o progresso do checklist diário do próprio funcionário, com atalho
// direto pra tela /checklist.
function ChecklistCard() {
  const checklistFn = useServerFn(getMyChecklistToday);
  const checklistQ = useQuery({ queryKey: ["my-checklist-today"], queryFn: () => checklistFn({}) });
  const items = (checklistQ.data?.items ?? []) as Array<{ id: string; tipo: "binario" | "meta"; meta_padrao: number | null }>;
  const entries = (checklistQ.data?.entries ?? []) as Array<{ item_id: string; marcado: boolean; valor: number | null }>;

  if (checklistQ.isLoading || items.length === 0) return null;

  const isDone = (item: { id: string; tipo: string; meta_padrao: number | null }) => {
    const e = entries.find((en) => en.item_id === item.id);
    if (!e) return false;
    if (item.tipo === "meta") return (e.valor ?? 0) >= (item.meta_padrao ?? 0);
    return !!e.marcado;
  };
  const doneCount = items.filter(isDone).length;

  return (
    <Card className="p-4 mb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Check-list de hoje</span>
        </div>
        <span className="text-sm text-muted-foreground">{doneCount} de {items.length} feitos</span>
      </div>
      <Link to="/checklist">
        <Button size="sm" variant="outline" className="w-full mt-3">Ver checklist</Button>
      </Link>
    </Card>
  );
}

function Home() {
  const me = useServerFn(getMe);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => me({}) });

  const homeMsgFn = useServerFn(listHomepageMessages);
  const homeMsgQ = useQuery({ queryKey: ["homepage-messages"], queryFn: () => homeMsgFn({}) });
  const heroMessage = pickHomeMessage((homeMsgQ.data ?? []) as HomeMessageRow[], (meQ.data as any)?.profile?.data_nascimento);

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
      <p className="text-sm text-muted-foreground mb-1">
        Olá, {(meQ.data as any)?.profile?.display_name || (meQ.data as any)?.email?.split("@")[0] || ""} 👋
      </p>
      <Card
        className="p-6 mb-8 border-none"
        style={{
          background: heroMessage
            ? (heroMessage.cor_fundo_2 ? `linear-gradient(135deg, ${heroMessage.cor_fundo}, ${heroMessage.cor_fundo_2})` : heroMessage.cor_fundo)
            : "hsl(var(--muted))",
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
            <Card
              className="p-4 h-full flex items-center gap-3 border-none text-white shadow-[0_2px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 transition-all"
              style={{ background: s.gradient }}
            >
              <s.icon className="h-5 w-5 shrink-0" />
              <span className="font-medium text-sm">{s.title}</span>
            </Card>
          </Link>
        ))}
      </section>

      <ChecklistCard />

      <Card className="p-5 mb-8 flex items-center justify-between gap-3 bg-primary/5 border-primary/20">
        <div>
          <p className="font-medium">Vamos testar seu atendimento no simulador?</p>
          <p className="text-sm text-muted-foreground mt-0.5">A IA sorteia um cliente pra você treinar agora.</p>
        </div>
        <Button onClick={sortearDesafio} disabled={(profilesQ.data ?? []).length === 0} className="shrink-0">Testar agora</Button>
      </Card>

      <Link to="/simulador-ia" search={{ modo: "problemas" }}>
        <Card className="p-5 mb-8 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
          <div>
            <p className="font-medium">Treinar Solução de Problemas</p>
            <p className="text-sm text-muted-foreground mt-0.5">Cenários de cancelamento, KYC e outras situações reais de suporte.</p>
          </div>
          <Button variant="outline" className="shrink-0">Ver cenários</Button>
        </Card>
      </Link>

      <Card className="p-4 mb-8 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Seu ranking do mês</span>
        <span className="text-lg font-semibold">
          {minhaPosicao >= 0 ? `${minhaPosicao + 1}º lugar` : "Simule pra entrar no ranking"}
        </span>
      </Card>

      <PromoPlansCarousel />

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

      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Informações essenciais sobre a Amor Saúde</p>
      <Card className="p-4 border-none" style={{ background: "linear-gradient(135deg, #FAFAFA, #DCEEFB)" }}>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-border/60">
              <td className="py-3 text-muted-foreground">Consultas</td>
              <td className="py-3 text-right text-2xl font-bold text-sky-700">{pQ.data?.length ?? 0}</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="py-3 text-muted-foreground">Exames</td>
              <td className="py-3 text-right text-2xl font-bold text-sky-700">{eQ.data?.length ?? 0}</td>
            </tr>
            <tr>
              <td className="py-3 text-muted-foreground">Procedimentos odontológicos</td>
              <td className="py-3 text-right text-2xl font-bold text-sky-700">{prQ.data?.length ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
