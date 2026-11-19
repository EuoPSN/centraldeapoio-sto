import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { getMe } from "@/lib/content.functions";
import { listHomepageMessages } from "@/lib/homepage.functions";
import { getMyChecklistToday, getChecklistSummaryForDate } from "@/lib/checklist.functions";
import { getAdminPendencias } from "@/lib/home.functions";
import { openGlobalSearch } from "@/components/GlobalSearch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

// ---------------------------------------------------------------------------
// Mensagem do dia
// ---------------------------------------------------------------------------

type HomeTipo = "padrao" | "data_especial" | "aniversario";
interface HomeMessageRow {
  id: string; titulo: string; subtitulo: string | null; tipo: HomeTipo;
  data_inicio: string | null; data_fim: string | null; ativo: boolean; position: number;
}

// Escolhe qual mensagem mostrar: aniversário (se for hoje) > data especial (se hoje cair no período) > padrão (rotaciona por dia).
// As cores e a fonte que o admin escolhe para cada mensagem não são usadas na Início: aqui vale a marca.
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

// "Quarta-feira, 18 de novembro", no fuso de Brasília.
function hojePorExtenso() {
  const s = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function primeiroNome(displayName: string | null | undefined, email: string | null | undefined) {
  const base = (displayName || email?.split("@")[0] || "").trim();
  return base.split(/\s+/)[0] ?? "";
}

// ---------------------------------------------------------------------------
// Check-list de hoje (do próprio usuário)
// ---------------------------------------------------------------------------

type ChecklistItem = { id: string; tipo: "binario" | "meta"; meta_padrao: number | null };
type ChecklistEntry = { item_id: string; marcado: boolean; valor: number | null };

function useMyChecklist() {
  const fn = useServerFn(getMyChecklistToday);
  const q = useQuery({ queryKey: ["my-checklist-today"], queryFn: () => fn({}) });
  const items = (q.data?.items ?? []) as ChecklistItem[];
  const entries = (q.data?.entries ?? []) as ChecklistEntry[];
  const isDone = (item: ChecklistItem) => {
    const e = entries.find((en) => en.item_id === item.id);
    if (!e) return false;
    if (item.tipo === "meta") return (e.valor ?? 0) >= (item.meta_padrao ?? 0);
    return !!e.marcado;
  };
  const done = items.filter(isDone).length;
  return { isLoading: q.isLoading, total: items.length, done };
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

function Home() {
  const me = useServerFn(getMe);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => me({}) });
  const profile = (meQ.data as { profile?: { display_name?: string | null; data_nascimento?: string | null } | null } | undefined)?.profile;
  const nome = primeiroNome(profile?.display_name, meQ.data?.email);
  const isAdmin = !!meQ.data?.isAdmin;

  const homeMsgFn = useServerFn(listHomepageMessages);
  const homeMsgQ = useQuery({ queryKey: ["homepage-messages"], queryFn: () => homeMsgFn({}) });
  const mensagem = meQ.isLoading
    ? null
    : pickHomeMessage((homeMsgQ.data ?? []) as HomeMessageRow[], profile?.data_nascimento);

  const checklist = useMyChecklist();

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-5 sm:px-6 lg:px-10 lg:pt-7">
      <WelcomeBand
        loading={meQ.isLoading}
        nome={nome}
        mensagem={mensagem}
        mensagemLoading={homeMsgQ.isLoading || meQ.isLoading}
        checklist={checklist}
      />

      {/* Altura reservada para todos: a linha de pendências entra sem empurrar a página. */}
      <div className="flex min-h-[3.25rem] items-center px-1 pt-1">
        {meQ.isLoading ? <SkeletonBar className="h-3.5 w-[26rem] max-w-full bg-surface-2" /> : isAdmin && <PendenciasLine />}
      </div>

      <CentralSearch />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Faixa de boas-vindas
// ---------------------------------------------------------------------------

// Cores literais: a faixa é igual nos temas claro e escuro.
const BAND = {
  ink: "#F5F5F0",
  gold: "#D4AF37",
  muted: "#B8B2A6",
  quote: "#D9D4C9",
  outline: "#6E6680",
} as const;

function WelcomeBand({
  loading, nome, mensagem, mensagemLoading, checklist,
}: {
  loading: boolean;
  nome: string;
  mensagem: HomeMessageRow | null;
  mensagemLoading: boolean;
  checklist: ReturnType<typeof useMyChecklist>;
}) {
  const temChecklist = checklist.total > 0;
  const completo = temChecklist && checklist.done >= checklist.total;

  return (
    <section
      aria-label="Boas-vindas"
      className="relative isolate overflow-hidden rounded-2xl"
      style={{ background: "linear-gradient(to bottom right, #0B0B0B 0%, #17131F 58%, #2A1A42 100%)" }}
    >
      <Orbits />

      <div className="relative flex flex-col gap-7 px-6 py-8 sm:px-10 sm:py-10 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between min-[900px]:gap-10 min-[900px]:pl-12 min-[900px]:pr-12">
        {/* Coluna de texto com largura máxima: quebra linha antes do bloco do check-list. */}
        <div className="min-w-0 flex-1 min-[900px]:max-w-[640px]">
          <p className="text-xs font-light uppercase tracking-[0.22em]" style={{ color: BAND.muted }}>
            {hojePorExtenso()}
          </p>

          <h1
            className="mt-2 font-display font-medium uppercase leading-[1.18] tracking-[0.1em] text-[clamp(2rem,4.2vw,2.75rem)] [overflow-wrap:anywhere]"
            style={{ color: BAND.ink }}
          >
            {loading ? (
              <SkeletonBar className="my-[0.2em] h-[0.8em] w-[9ch] bg-white/10" />
            ) : (
              <>
                Olá{nome ? "," : ""}
                {nome && <> <span style={{ color: BAND.gold }}>{nome}</span></>}
              </>
            )}
          </h1>

          {mensagemLoading ? (
            <SkeletonBar className="mt-3 h-4 w-80 max-w-full bg-white/10" />
          ) : (
            mensagem && (
              <p className="mt-3 text-[15px] font-light leading-6 [overflow-wrap:anywhere]" style={{ color: BAND.quote }}>
                “{mensagem.titulo}”
                {mensagem.subtitulo && (
                  <span className="ml-2 text-[13px] font-medium uppercase tracking-[0.06em]" style={{ color: BAND.gold }}>
                    {mensagem.subtitulo}
                  </span>
                )}
              </p>
            )
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            {checklist.isLoading ? (
              <>
                <SkeletonBar className="h-10 w-44 rounded-lg bg-white/10" />
                <SkeletonBar className="h-10 w-32 rounded-lg bg-white/10" />
              </>
            ) : (
              <>
                {temChecklist && (
                  <BandButton to="/checklist" variant="gold">
                    {completo ? "Ver check-list" : "Continuar check-list"}
                  </BandButton>
                )}
                <BandButton to="/scripts" variant={temChecklist ? "outline" : "gold"}>
                  Abrir Scripts
                </BandButton>
              </>
            )}
          </div>
        </div>

        {(checklist.isLoading || temChecklist) && (
          <ChecklistBlock loading={checklist.isLoading} done={checklist.done} total={checklist.total} completo={completo} />
        )}
      </div>
    </section>
  );
}

// Duas órbitas douradas finas cortando o canto direito (só fundo, nunca atrás do logo).
function Orbits() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <span
        className="absolute top-1/2 aspect-square w-[600px] -translate-y-1/2 rounded-full"
        style={{ right: -130, border: "1.25px solid rgba(212, 175, 55, 0.32)" }}
      />
      <span
        className="absolute aspect-square w-[520px] rounded-full"
        style={{ right: -170, top: -190, border: "1px solid rgba(212, 175, 55, 0.26)" }}
      />
    </div>
  );
}

function BandButton({ to, variant, children }: { to: string; variant: "gold" | "outline"; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-10 items-center rounded-lg px-[18px] text-[15px] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]",
        variant === "gold"
          ? "bg-[#D4AF37] font-semibold text-[#0B0B0B] hover:bg-[#E0BE4F]"
          : "border border-[#6E6680] font-medium text-[#F5F5F0] hover:border-[#B8B2A6] hover:bg-white/5",
      )}
    >
      {children}
    </Link>
  );
}

function ChecklistBlock({ loading, done, total, completo }: { loading: boolean; done: number; total: number; completo: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <Link
      to="/checklist"
      aria-label={loading ? "Check-list de hoje" : completo ? "Check-list de hoje: tudo feito" : `Check-list de hoje: ${done} de ${total} itens`}
      className="block w-full shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.035] px-5 pb-5 pt-[18px] transition-colors hover:border-white/15 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37] min-[900px]:w-[300px]"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: BAND.quote }}>Check-list de hoje</p>
      <div className="mt-2 flex h-9 items-baseline gap-1.5">
        {loading ? (
          <SkeletonBar className="mt-2 h-6 w-28 bg-white/10" />
        ) : completo ? (
          <span className="text-lg font-medium leading-9" style={{ color: BAND.ink }}>Tudo feito hoje</span>
        ) : (
          <>
            <span className="text-[28px] font-normal leading-9 tabular-nums" style={{ color: BAND.ink }}>{done}</span>
            <span className="text-[15px] leading-9" style={{ color: BAND.quote }}>de {total} {total === 1 ? "item" : "itens"}</span>
          </>
        )}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#D4AF37] motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out"
          style={{ width: loading ? "0%" : `${pct}%` }}
        />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// 2. Pendências (só admin)
// ---------------------------------------------------------------------------

function PendenciasLine() {
  const pendFn = useServerFn(getAdminPendencias);
  const pendQ = useQuery({ queryKey: ["home-pendencias"], queryFn: () => pendFn() });
  const summaryFn = useServerFn(getChecklistSummaryForDate);
  const summaryQ = useQuery({ queryKey: ["checklist-summary", "hoje"], queryFn: () => summaryFn({ data: {} }) });

  if (pendQ.isLoading || summaryQ.isLoading) {
    return <SkeletonBar className="h-3.5 w-[26rem] max-w-full bg-surface-2" />;
  }

  const x = pendQ.data?.scriptsParaAprovar ?? 0;
  const y = pendQ.data?.sugestoesNovas ?? 0;
  // Sem itens de check-list configurados, ninguém está "devendo" o check-list.
  const z = summaryQ.data && summaryQ.data.totalItems > 0 ? summaryQ.data.zeroCount : 0;

  const parts = [
    x > 0 && { aba: "scriptreview", text: `${x} ${x === 1 ? "script para aprovar" : "scripts para aprovar"}` },
    y > 0 && { aba: "suggestions", text: `${y} ${y === 1 ? "sugestão nova" : "sugestões novas"}` },
    z > 0 && { aba: "checklist", text: `${z} sem check-list hoje` },
  ].filter(Boolean) as { aba: string; text: string }[];

  if (parts.length === 0) return null;

  return (
    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] leading-5">
      <span className="font-semibold text-ink">Pendências</span>
      <span className="text-ink-muted">
        {parts.map((p, i) => (
          <span key={p.aba}>
            {i > 0 && <span aria-hidden> · </span>}
            <Link
              to="/admin"
              search={{ aba: p.aba }}
              className="underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:underline"
            >
              {p.text}
            </Link>
          </span>
        ))}
      </span>
      <Link to="/admin" className="font-medium text-gold-text underline-offset-4 hover:underline focus-visible:underline">
        Ver tudo <span aria-hidden>→</span>
      </Link>
    </p>
  );
}

// ---------------------------------------------------------------------------
// 3. Busca central
// ---------------------------------------------------------------------------

const ATALHOS = [
  { label: "Scripts", to: "/scripts" },
  { label: "Amor Saúde", to: "/amor-saude" },
  { label: "MarcIAna", to: "/assistente" },
  { label: "Simulador IA", to: "/simulador-ia" },
] as const;

function CentralSearch() {
  const [value, setValue] = useState("");

  return (
    <section aria-labelledby="busca-central" className="mt-10 flex flex-col items-center sm:mt-12">
      <h2
        id="busca-central"
        className="text-center font-display text-[22px] font-medium uppercase leading-8 tracking-[0.08em] text-ink"
      >
        Do que você precisa agora?
      </h2>

      <label className="group mt-6 flex w-full max-w-[760px] cursor-text items-center gap-3 rounded-[14px] border border-line-strong bg-surface px-5 py-[18px] transition-colors focus-within:border-gold hover:border-ink-muted focus-within:hover:border-gold">
        <Search className="h-5 w-5 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
        <span className="sr-only">Buscar em toda a OMNIA Apoio</span>
        <input
          type="search"
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            const q = e.target.value;
            // Ao digitar, a busca global abre com o texto e assume o foco.
            if (q.trim()) {
              openGlobalSearch(q);
              setValue("");
            } else {
              setValue(q);
            }
          }}
          placeholder="Busque um preço, uma mensagem, uma clínica ou pergunte à MarcIAna…"
          className="min-w-0 flex-1 bg-transparent text-base leading-6 text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-px font-sans text-xs leading-5 text-ink-muted sm:inline-block">
          Ctrl K
        </kbd>
      </label>

      <nav aria-label="Atalhos" className="mt-4 flex flex-wrap justify-center gap-2.5">
        {ATALHOS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="inline-flex h-[34px] items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {a.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

// ---------------------------------------------------------------------------

function SkeletonBar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block rounded motion-safe:animate-pulse", className)} />;
}
