import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Settings, Star, Paperclip, Route as RouteIcon } from "lucide-react";
import { TopbarBreadcrumb, SkeletonLine } from "@/components/scripts/shared";
import { HubCard } from "@/components/HubCard";
import { AjudaSearchBox } from "@/components/ajuda/AjudaSearchBox";
import { listContent } from "@/lib/content.functions";
import { listSuggestions } from "@/lib/suggestions.functions";
import { listChangelog } from "@/lib/changelog.functions";
import { listMostViewedArticles, getAjudaNovidadesStatus } from "@/lib/ajuda.functions";

export const Route = createFileRoute("/_authenticated/ajuda/")({
  component: AjudaHub,
});

const SECTION_LABEL: Record<string, string> = { tutoriais: "Procedimento", problemas: "Problema técnico" };
const SECTION_TO: Record<string, string> = { tutoriais: "/ajuda/procedimentos", problemas: "/ajuda/problemas" };

function formatDiaMes(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function AjudaHub() {
  const contentFn = useServerFn(listContent);
  const suggestionsFn = useServerFn(listSuggestions);
  const mostViewedFn = useServerFn(listMostViewedArticles);
  const novidadesStatusFn = useServerFn(getAjudaNovidadesStatus);
  const changelogFn = useServerFn(listChangelog);

  const procedimentosQ = useQuery({ queryKey: ["content", "tutoriais"], queryFn: () => contentFn({ data: { section: "tutoriais" } }) });
  const problemasQ = useQuery({ queryKey: ["content", "problemas"], queryFn: () => contentFn({ data: { section: "problemas" } }) });
  const suggestionsQ = useQuery({ queryKey: ["my-suggestions"], queryFn: () => suggestionsFn({ data: { all: false } }) });
  const mostViewedQ = useQuery({ queryKey: ["ajuda", "mais-vistos"], queryFn: () => mostViewedFn({}) });
  const novidadesStatusQ = useQuery({ queryKey: ["ajuda", "novidades-status"], queryFn: () => novidadesStatusFn({}) });
  const changelogQ = useQuery({ queryKey: ["changelog"], queryFn: () => changelogFn({}) });

  const loading = procedimentosQ.isLoading || problemasQ.isLoading;
  const footer = (text: string) => (loading ? <SkeletonLine className="h-3.5 w-20" /> : text);

  const emAnalise = (suggestionsQ.data ?? []).filter((s) => s.status === "pendente" || s.status === "em_analise").length;
  const unseenCount = novidadesStatusQ.data?.unseenCount ?? 0;
  const mostViewed = mostViewedQ.data ?? [];
  const published = (changelogQ.data ?? []).filter((e) => e.published);
  const ultimaNovidade = published[0] as { created_at: string } | undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Central de Ajuda" }]} />

      <p className="type-overline text-ink-muted">Central de Ajuda</p>
      <h1 className="mt-3 text-center font-display text-[clamp(2rem,3.6vw,2.75rem)] font-medium uppercase leading-[1.18] tracking-[0.08em] text-ink [text-wrap:balance]">
        Como podemos ajudar?
      </h1>

      <AjudaSearchBox variant="hub" className="mt-8 w-full max-w-[640px]" />

      <div className="mt-10 grid w-full grid-cols-1 justify-center gap-4 min-[560px]:grid-cols-2">
        <HubCard
          to="/ajuda/procedimentos"
          icon={ListChecks}
          title="Procedimentos do atendimento"
          text="Passo a passo do que fazer em cada situação."
          footer={footer(`${procedimentosQ.data?.length ?? 0} artigos`)}
        />
        <HubCard
          to="/ajuda/problemas"
          icon={Settings}
          title="Problemas técnicos"
          text="PC, sistema, login e o que costuma travar."
          footer={footer(`${problemasQ.data?.length ?? 0} artigos`)}
        />
        <HubCard
          to="/ajuda/novidades"
          icon={Star}
          title="Novidades"
          text="O que mudou na Omnia e no atendimento."
          footer={ultimaNovidade ? `Última: ${formatDiaMes(ultimaNovidade.created_at)}` : footer("")}
          badge={unseenCount > 0 ? `${unseenCount} NOVA${unseenCount > 1 ? "S" : ""}` : undefined}
          recommended={unseenCount > 0}
        />
        <HubCard
          to="/ajuda/sugestoes"
          icon={Paperclip}
          title="Sugestões e dúvidas"
          text="Mande uma ideia, dúvida ou script novo."
          footer={emAnalise > 0 ? `Você tem ${emAnalise} em análise` : "Mande uma ideia ou dúvida"}
        />
        <HubCard
          to="/ajuda/tutoriais-paginas"
          icon={RouteIcon}
          title="Tutoriais das páginas"
          text="Passo a passo de cada página da Omnia."
          footer="Rever tutoriais"
        />
      </div>

      {mostViewed.length > 0 && (
        <section aria-label="Mais vistos esta semana" className="mt-10 w-full">
          <p className="type-overline text-ink-muted">Mais vistos esta semana</p>
          <ul className="mt-2 divide-y divide-line border-t border-line">
            {mostViewed.map((item: { id: string; title: string; section: string }) => (
              <li key={item.id}>
                <Link
                  to={SECTION_TO[item.section] ?? "/ajuda"}
                  search={{ artigo: item.id } as never}
                  className="flex items-center justify-between gap-3 py-3 text-[15px] text-ink transition-colors hover:text-gold-text"
                >
                  <span className="truncate">{item.title}</span>
                  <span className="shrink-0 text-sm text-ink-muted">{SECTION_LABEL[item.section] ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
