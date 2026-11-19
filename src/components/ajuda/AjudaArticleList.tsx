import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlowCover } from "@/components/scripts/FlowCover";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { TopbarBreadcrumb } from "@/components/scripts/shared";
import { AjudaSectionHeader } from "./AjudaSectionHeader";
import { listContent } from "@/lib/content.functions";
import { registerArticleView, submitAjudaFeedback, getMyAjudaFeedback } from "@/lib/ajuda.functions";
import { cn } from "@/lib/utils";

interface ContentItem {
  id: string;
  title: string;
  content: string;
  category: string | null;
}

// Passo a passo: se a maior parte das linhas estiver numerada ou em lista, mostra
// como passos numerados; senão, mantém o texto formatado normalmente (Markdown).
function parseSteps(content: string): string[] | null {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const stepRe = /^(?:\d+[.)]|[-*])\s+(.*)$/;
  const matches = lines.map((l) => l.match(stepRe));
  const matchCount = matches.filter(Boolean).length;
  if (matchCount / lines.length < 0.8) return null;
  return matches.map((m, i) => (m ? m[1] : lines[i]));
}

/**
 * Lista + artigo das páginas Procedimentos e Problemas técnicos. `artigo` vem
 * da query string (?artigo=<id>) e `onSelect` deve atualizá-la (replace).
 */
export function AjudaArticleList({
  section, sectionLabel, overline, breadcrumbLabel, artigo, onSelect,
}: {
  section: "tutoriais" | "problemas";
  sectionLabel: string;
  overline: string;
  breadcrumbLabel: string;
  artigo: string | undefined;
  onSelect: (id: string) => void;
}) {
  const listFn = useServerFn(listContent);
  const q = useQuery({ queryKey: ["content", section], queryFn: () => listFn({ data: { section } }) });
  const items = (q.data ?? []) as ContentItem[];
  const selected = items.find((i) => i.id === artigo) ?? items[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 lg:py-7">
      <TopbarBreadcrumb items={[{ label: "Central de Ajuda", to: "/ajuda" }, { label: breadcrumbLabel }]} />
      <AjudaSectionHeader title={sectionLabel} />

      {q.isLoading ? (
        <p className="text-sm text-ink-muted">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-6">
          <p className="text-[15px] text-ink">Nenhum artigo cadastrado ainda.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
          <nav aria-label={sectionLabel}>
            <p className="px-1 text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">{overline}</p>
            <ul className="mt-1.5">
              {items.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex h-[50px] w-full items-center pl-3 pr-2 text-left transition-colors",
                        active ? "bg-sidebar font-semibold text-ink border-l-2 border-gold" : "border-l-2 border-transparent text-ink hover:bg-sidebar/60",
                      )}
                    >
                      <span className="truncate text-[14.5px] leading-5">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section aria-label="Artigo" className="min-w-0">
            {selected && <ArticleDetail key={selected.id} item={selected} section={section} />}
          </section>
        </div>
      )}
    </div>
  );
}

function ArticleDetail({ item, section }: { item: ContentItem; section: "tutoriais" | "problemas" }) {
  const registerViewFn = useServerFn(registerArticleView);
  const submitFeedbackFn = useServerFn(submitAjudaFeedback);
  const getMyFeedbackFn = useServerFn(getMyAjudaFeedback);
  const qc = useQueryClient();

  useEffect(() => {
    registerViewFn({ data: { content_item_id: item.id } }).catch(() => {});
  }, [item.id, registerViewFn]);

  const myFeedbackQ = useQuery({
    queryKey: ["ajuda-feedback", "mine", item.id],
    queryFn: () => getMyFeedbackFn({ data: { content_item_id: item.id } }),
  });

  const feedbackMut = useMutation({
    mutationFn: (util: boolean) => submitFeedbackFn({ data: { content_item_id: item.id, util } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ajuda-feedback", "mine", item.id] }),
  });

  const steps = parseSteps(item.content);
  const overline = section === "tutoriais" ? "PROCEDIMENTO" : "PROBLEMA TÉCNICO";
  const answered = !!myFeedbackQ.data || feedbackMut.isSuccess;

  return (
    <article>
      <p className="text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">{overline}</p>
      <h2 className="mt-1.5 text-[24px] font-semibold leading-8 text-ink">{item.title}</h2>

      <FlowCover className="mt-4 rounded-[14px]" height={300} emptyText="Vídeo em breve" />

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">Passo a passo</p>
        {steps ? (
          <ol className="mt-3 divide-y divide-line">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink">{i + 1}</span>
                <span className="text-[14.5px] leading-[1.6] text-ink">{s}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-3"><Markdown>{item.content || "_(sem conteúdo)_"}</Markdown></div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {answered ? (
          <p className="text-sm text-ink-muted">Obrigado pelo retorno.</p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">Isso ajudou?</span>
            <Button variant="outline" size="sm" onClick={() => feedbackMut.mutate(true)} disabled={feedbackMut.isPending}>Sim</Button>
            <Button variant="outline" size="sm" onClick={() => feedbackMut.mutate(false)} disabled={feedbackMut.isPending}>Não</Button>
          </div>
        )}
        <Link
          to="/ajuda/sugestoes"
          search={{ tipo: "duvida", artigo: item.id } as never}
          className="text-sm font-medium text-gold-text hover:underline"
        >
          Não resolveu? Avisar o Paulo →
        </Link>
      </div>
    </article>
  );
}
