import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { ArrowRight, AudioLines, Phone, Quote, Search } from "lucide-react";
import { openGlobalSearch } from "@/components/GlobalSearch";
import {
  TopbarBreadcrumb, buildFlows, useFlowData, useMessageCategories, useMessages, SkeletonLine,
} from "@/components/scripts/shared";
import { cn } from "@/lib/utils";

// Links antigos para /scripts com parâmetros vão para a tela certa.
type LegacySearch = Record<string, string | undefined>;
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/_authenticated/scripts/")({
  validateSearch: (s: Record<string, unknown>): LegacySearch => ({
    modo: str(s.modo) ?? str(s.mode) ?? str(s.aba),
    msg: str(s.msg) ?? str(s.mensagem),
    categoria: str(s.categoria) ?? str(s.cat),
    sub: str(s.sub) ?? str(s.subcategoria),
    fluxo: str(s.fluxo),
    etapa: str(s.etapa),
  }),
  beforeLoad: ({ search }) => {
    const { modo, msg, categoria, sub, fluxo, etapa } = search;
    if (fluxo) throw redirect({ to: "/scripts/fluxo/$fluxo", params: { fluxo }, search: etapa ? { etapa } : {}, replace: true });
    if (modo === "fluxo" || etapa) throw redirect({ to: "/scripts/fluxo", replace: true });
    if (modo === "biblioteca" || msg || categoria || sub) {
      throw redirect({ to: "/scripts/biblioteca", search: { msg, categoria, sub }, replace: true });
    }
  },
  component: ScriptsHub,
});

function ScriptsHub() {
  const messages = useMessages();
  const cats = useMessageCategories();
  const flowData = useFlowData();
  const { flows } = useMemo(() => buildFlows(cats.rows, flowData.stages), [cats.rows, flowData.stages]);
  const flowsLoading = cats.isLoading || flowData.isLoading;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
      <TopbarBreadcrumb items={[{ label: "Atendimento" }, { label: "Scripts" }]} />

      <p className="text-xs font-normal uppercase leading-4 tracking-[0.22em] text-ink-muted">Scripts</p>
      <h1 className="mt-3 text-center font-display text-[clamp(2rem,3.6vw,2.75rem)] font-medium uppercase leading-[1.18] tracking-[0.08em] text-ink [text-wrap:balance]">
        O que você vai usar agora?
      </h1>
      <p className="mt-4 max-w-[72ch] text-center text-base leading-[26px] text-ink-muted [text-wrap:balance]">
        Mensagens prontas, o passo a passo do atendimento e roteiros para falar com o cliente.
      </p>

      <div className="mt-11 grid w-full grid-cols-1 justify-center gap-4 min-[560px]:grid-cols-[repeat(2,232px)] min-[1060px]:grid-cols-[repeat(4,232px)]">
        <HubCard
          to="/scripts/fluxo"
          icon={ArrowRight}
          title="Fluxo de atendimento"
          text="A conversa etapa por etapa, da abordagem ao fechamento."
          badge="Recomendado"
          recommended
          footer={flowsLoading ? <SkeletonLine className="h-3.5 w-28" /> : flowsFooter(flows.length, flows.reduce((n, f) => n + f.trunk.length, 0))}
        />
        <HubCard
          to="/scripts/biblioteca"
          icon={Quote}
          title="Biblioteca de mensagens"
          text="Todas as mensagens prontas, por categoria."
          footer={messages.isLoading ? <SkeletonLine className="h-3.5 w-24" /> : `${messages.rows.length} ${messages.rows.length === 1 ? "mensagem" : "mensagens"}`}
        />
        <HubCard icon={Phone} title="Scripts de ligação" text="Roteiro da ligação com respostas para cada objeção." badge="Em breve" soon />
        <HubCard icon={AudioLines} title="Roteiros de áudio" text="O texto de como falar e um áudio de exemplo." badge="Em breve" soon />
      </div>

      <MessageSearchField />
    </div>
  );
}

function flowsFooter(nFlows: number, nStages: number) {
  if (nFlows === 0) return "Nenhum fluxo cadastrado";
  const media = Math.round(nStages / nFlows);
  return nFlows === 1
    ? `${nStages} ${nStages === 1 ? "etapa" : "etapas"}`
    : `${nFlows} fluxos · ${media} etapas em média`;
}

function HubCard({
  to, icon: Icon, title, text, footer, badge, recommended, soon,
}: {
  to?: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  text: string;
  footer?: ReactNode;
  badge?: string;
  recommended?: boolean;
  soon?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full border",
            soon ? "border-line-strong text-ink-muted" : "border-gold text-gold-text",
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </span>
        {badge && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.06em]",
              recommended ? "bg-gold text-on-gold" : "bg-surface-2 text-ink-muted",
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <h2 className="mt-5 text-[17px] font-semibold leading-[22px] text-ink [text-wrap:balance]">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-5 text-ink-muted">{text}</p>
      <p className={cn("mt-auto pt-4 text-[13px] leading-5", soon ? "text-ink-muted" : "font-semibold text-gold-text")}>
        {soon ? "Em construção" : footer}
      </p>
    </>
  );

  const base = "flex min-h-[212px] flex-col rounded-[14px] border p-5";
  if (!to) {
    return (
      <div aria-disabled className={cn(base, "border-line bg-sidebar")}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={to}
      className={cn(
        base,
        "bg-surface transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        recommended ? "border-gold border-[1.5px] hover:bg-surface-2/60" : "border-line hover:border-line-strong hover:bg-surface-2/60",
      )}
    >
      {body}
    </Link>
  );
}

// Abre a busca global já filtrada por mensagens, com o que foi digitado.
function MessageSearchField() {
  const [value, setValue] = useState("");
  return (
    <label className="mt-10 flex w-full max-w-[640px] cursor-text items-center gap-3 rounded-[14px] border border-line-strong bg-surface px-5 py-[15px] transition-colors hover:border-ink-muted focus-within:border-gold focus-within:hover:border-gold">
      <Search className="h-[18px] w-[18px] shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
      <span className="sr-only">Buscar mensagem</span>
      <input
        type="search"
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          const q = e.target.value;
          if (q.trim()) {
            openGlobalSearch(q, "messages");
            setValue("");
          } else setValue(q);
        }}
        placeholder="Ou busque uma mensagem pelo nome, texto ou atalho (/lead)…"
        className="min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-px font-sans text-xs leading-5 text-ink-muted sm:inline-block">Ctrl K</kbd>
    </label>
  );
}
