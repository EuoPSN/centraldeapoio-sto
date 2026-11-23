import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAcessoLigacao } from "@/components/scripts/ligacao";
import { listRoteirosAudio, listRoteirosLigacao } from "@/lib/roteiros.functions";
import { ArrowRight, AudioLines, MessageCircleQuestion, Phone, Quote } from "lucide-react";
import { HubCard, HubSearchField } from "@/components/HubCard";
import {
  TopbarBreadcrumb, buildFlows, useFlowData, useMessageCategories, useMessages, SkeletonLine,
} from "@/components/scripts/shared";

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

  // Contagem dos cartões novos (roteiros de áudio publicados + áudios da cadência; scripts de ligação publicados).
  const audioFn = useServerFn(listRoteirosAudio);
  const audio = useQuery({ queryKey: ["roteiros-audio"], queryFn: () => audioFn({}), staleTime: 60_000, retry: false });
  const nAudios = ((audio.data?.roteiros ?? []) as { status: string }[]).filter((r) => r.status === "publicada").length + (audio.data?.cadencia ?? []).length;
  const acesso = useAcessoLigacao();
  const ligFn = useServerFn(listRoteirosLigacao);
  const lig = useQuery({ queryKey: ["roteiros-ligacao"], queryFn: () => ligFn({}), staleTime: 60_000, retry: false, enabled: acesso.podeVer });
  const nLig = ((lig.data ?? []) as { status: string }[]).filter((r) => r.status === "publicada").length;

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

      <div className="mt-11 grid w-full grid-cols-1 justify-center gap-4 min-[560px]:grid-cols-[repeat(2,232px)] min-[820px]:grid-cols-[repeat(3,232px)] min-[1100px]:grid-cols-[repeat(5,200px)]">
        <HubCard
          to="/scripts/fluxo"
          dataTour="scripts-1"
          icon={ArrowRight}
          title="Fluxo de atendimento"
          text="A conversa etapa por etapa, da abordagem ao fechamento."
          badge="Recomendado"
          recommended
          footer={flowsLoading ? <SkeletonLine className="h-3.5 w-28" /> : flowsFooter(flows.length, flows.reduce((n, f) => n + f.trunk.length, 0))}
        />
        <HubCard
          to="/scripts/biblioteca"
          dataTour="scripts-2"
          icon={Quote}
          title="Biblioteca de mensagens"
          text="Todas as mensagens prontas, por categoria."
          footer={messages.isLoading ? <SkeletonLine className="h-3.5 w-24" /> : `${messages.rows.length} ${messages.rows.length === 1 ? "mensagem" : "mensagens"}`}
        />
        <HubCard
          to="/scripts/cliente-disse"
          dataTour="scripts-3"
          icon={MessageCircleQuestion}
          title="O cliente disse…"
          text="Cole a fala do cliente e receba a resposta aprovada para a objeção."
          footer="Objeções e fechamento"
        />
        {acesso.podeVer ? (
          <HubCard
            to="/scripts/ligacao"
            icon={Phone}
            title="Scripts de ligação"
            text="Roteiro da ligação com respostas para cada objeção."
            badge={acesso.isAdmin && !acesso.liberado ? "Só você vê" : undefined}
            footer={lig.isLoading ? <SkeletonLine className="h-3.5 w-24" /> : `${nLig} ${nLig === 1 ? "roteiro" : "roteiros"}`}
          />
        ) : (
          <HubCard icon={Phone} title="Scripts de ligação" text="Roteiro da ligação com respostas para cada objeção." badge="Em breve" soon />
        )}
        <HubCard
          to="/scripts/roteiros-audio"
          icon={AudioLines}
          title="Roteiros de áudio"
          text="O texto de como falar e um áudio de exemplo."
          footer={audio.isLoading ? <SkeletonLine className="h-3.5 w-24" /> : `${nAudios} ${nAudios === 1 ? "roteiro" : "roteiros"}`}
        />
      </div>

      <HubSearchField
        scope="messages"
        dataTour="scripts-4"
        label="Buscar mensagem"
        placeholder="Ou busque uma mensagem pelo nome, texto ou atalho (/lead)…"
      />
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
