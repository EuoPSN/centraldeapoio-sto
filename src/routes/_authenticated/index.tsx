import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
import { MessageSquareQuote, Sparkles, Bot, GraduationCap, Lightbulb, ListChecks, Search, ChevronRight, Trophy, LifeBuoy, Tag } from "lucide-react";
import { Panel, PanelRow } from "@/components/Panel";
import { PriceTag } from "@/components/PriceTag";
import { CopyButton } from "@/components/CopyButton";

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

// As duas tarefas do atendimento em andamento ficam no topo.
const workShortcuts = [
  { title: "Mensagens do fluxo", hint: "Copiar a mensagem da etapa", icon: MessageSquareQuote, route: "/scripts" },
  { title: "Tabela de preços", hint: "Consultas, exames e odontologia", icon: Tag, route: "/precos" },
] as const;

// Treino e equipe: acessíveis, mas sem competir com o trabalho.
const trainingShortcuts = [
  { title: "Simulador IA", icon: Sparkles, route: "/simulador-ia" },
  { title: "MarcIAna", icon: Bot, route: "/assistente" },
  { title: "Treinamentos", icon: GraduationCap, route: "/treinamentos" },
  { title: "Sugestões", icon: Lightbulb, route: "/sugestoes" },
] as const;

interface PromoPlanRow {
  id: string; nome: string; preco_primeiro_mes: number; preco_demais_meses: number;
  cor_fundo: string; cor_fundo_2: string | null; ativo: boolean; position: number;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Planos em promoção com a etiqueta vermelha. Some da tela quando não há
// nenhum plano ativo.
function PromoPlansPanel() {
  const promoFn = useServerFn(listPromoPlans);
  const promoQ = useQuery({ queryKey: ["promo-plans"], queryFn: () => promoFn({}) });
  const plans = ((promoQ.data ?? []) as PromoPlanRow[]).filter((p) => p.ativo).sort((a, b) => a.position - b.position);

  if (plans.length === 0) return null;

  return (
    <Panel title="Planos em promoção">
      {plans.map((p) => (
        <PanelRow key={p.id}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.nome}</p>
            <p className="text-[12.5px] text-muted-foreground">1º mês · depois {formatBRL(p.preco_demais_meses)}</p>
          </div>
          <PriceTag value={p.preco_primeiro_mes} promo />
          <CopyButton
            size="icon"
            label={`Copiar preço do ${p.nome}`}
            text={`${p.nome}: ${formatBRL(p.preco_primeiro_mes)} no 1º mês. A partir do 2º mês, ${formatBRL(p.preco_demais_meses)}.`}
          />
        </PanelRow>
      ))}
    </Panel>
  );
}

// Linha com o progresso do checklist diário do próprio funcionário, com atalho
// direto pra tela /checklist.
function ChecklistRow() {
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
    <LinkRow to="/checklist" icon={ListChecks} title="Check-list de hoje">
      <span className="text-sm tabular-nums text-muted-foreground">{doneCount} de {items.length} feitos</span>
    </LinkRow>
  );
}

// Linha clicável de um Panel, com seta à direita.
function LinkRow({ to, search, icon: Icon, title, hint, children }: {
  to: string; search?: Record<string, string>; icon: typeof ListChecks; title: string; hint?: string; children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="flex items-center gap-3 border-t border-[#eef1ef] px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {hint && <span className="block text-[12.5px] text-muted-foreground">{hint}</span>}
      </span>
      {children}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
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

  // ---- "Treinar no simulador": sorteia um perfil de cliente ----
  const profilesFn = useServerFn(listClientProfilesForTraining);
  const profilesQ = useQuery({ queryKey: ["client_profiles", "training"], queryFn: () => profilesFn() });
  const [desafio, setDesafio] = useState<any>(null);

  const sortearDesafio = () => {
    const profiles = (profilesQ.data ?? []) as any[];
    if (profiles.length === 0) return;
    setDesafio(profiles[Math.floor(Math.random() * profiles.length)]);
  };

  const nome = (meQ.data as any)?.profile?.display_name || (meQ.data as any)?.email?.split("@")[0] || "";
  const openSearch = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-5 lg:py-7">
      <div>
        <p className="text-sm text-muted-foreground">{nome ? `Olá, ${nome}` : "Olá"}</p>
        {/* Mensagem do dia: cores e fonte escolhidas pelo admin */}
        <div
          className="mt-2 rounded-[14px] border border-border px-5 py-4"
          style={{
            background: heroMessage
              ? (heroMessage.cor_fundo_2 ? `linear-gradient(135deg, ${heroMessage.cor_fundo}, ${heroMessage.cor_fundo_2})` : heroMessage.cor_fundo)
              : "var(--color-card)",
            fontFamily: heroMessage ? HOME_FONT_FAMILY[heroMessage.fonte] : undefined,
          }}
        >
          <h1 className="text-lg font-semibold leading-snug [text-wrap:balance]">{heroMessage?.titulo ?? "Tudo o que você precisa, num só lugar"}</h1>
          <p className="mt-0.5 text-sm opacity-80">
            {heroMessage?.subtitulo ?? "Mensagens, preços e informações de atendimento para a equipe."}
          </p>
        </div>
      </div>

      <Panel title="Atendimento">
        {workShortcuts.map((s) => (
          <LinkRow key={s.route} to={s.route} icon={s.icon} title={s.title} hint={s.hint} />
        ))}
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full items-center gap-3 border-t border-[#eef1ef] px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
        >
          <Search className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Buscar qualquer coisa</span>
            <span className="block text-[12.5px] text-muted-foreground">Especialidade, exame, mensagem, unidade</span>
          </span>
          <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">Ctrl K</kbd>
        </button>
      </Panel>

      <PromoPlansPanel />

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Panel title="Seu dia">
          <ChecklistRow />
          <LinkRow to="/ranking" icon={Trophy} title="Ranking do mês">
            <span className="text-sm font-semibold tabular-nums">
              {minhaPosicao >= 0 ? `${minhaPosicao + 1}º lugar` : <span className="font-normal text-muted-foreground">Simule para entrar</span>}
            </span>
          </LinkRow>
          <PanelRow className="py-3">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Treinar no simulador</span>
              <span className="block text-[12.5px] text-muted-foreground">A IA sorteia um cliente para você.</span>
            </span>
            <Button size="sm" variant="outline" onClick={sortearDesafio} disabled={(profilesQ.data ?? []).length === 0} className="font-semibold text-primary">
              Testar agora
            </Button>
          </PanelRow>
          <LinkRow to="/simulador-ia" search={{ modo: "problemas" }} icon={LifeBuoy} title="Solução de problemas" hint="Cancelamento, KYC e outros casos reais" />
        </Panel>

        <Panel title="Na tabela da Amor Saúde">
          {[
            { label: "Consultas", n: pQ.data?.length },
            { label: "Exames", n: eQ.data?.length },
            { label: "Procedimentos odontológicos", n: prQ.data?.length },
          ].map((r) => (
            <Link
              key={r.label}
              to="/precos"
              className="flex items-center gap-3 border-t border-[#eef1ef] px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
            >
              <span className="flex-1">{r.label}</span>
              <span className="text-base font-semibold tabular-nums">{r.n ?? "–"}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </Panel>
      </div>

      <Panel title="Treino e equipe">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {trainingShortcuts.map((s) => (
            <Link
              key={s.route}
              to={s.route}
              className="flex items-center gap-2.5 border-t border-[#eef1ef] px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none sm:border-l sm:first:border-l-0"
            >
              <s.icon className="h-4 w-4 shrink-0 text-primary" />
              {s.title}
            </Link>
          ))}
        </div>
      </Panel>

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

    </div>
  );
}
