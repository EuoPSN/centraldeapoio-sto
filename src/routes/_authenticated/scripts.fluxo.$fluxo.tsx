import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { Check } from "lucide-react";
import {
  TopbarBreadcrumb, WhatsAppMessage, GoldButton, OutlineButton, SkeletonLine,
  buildFlows, etapasLabel, mensagensLabel, previewLine, useCopy, useCountCopy,
  useFlowData, useMessageCategories, useMessages,
  type MessageRow, type PathRow, type StageRow,
} from "@/components/scripts/shared";
import { cn } from "@/lib/utils";

type FluxoSearch = { etapa?: string; caminho?: string; msg?: string };
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/_authenticated/scripts/fluxo/$fluxo")({
  validateSearch: (s: Record<string, unknown>): FluxoSearch => ({
    etapa: str(s.etapa),
    caminho: str(s.caminho),
    msg: str(s.msg),
  }),
  component: FluxoDentro,
});

// Trilha mostrada: o tronco; com um caminho escolhido, o tronco até a etapa onde
// ele se divide, as etapas do caminho e, se ele voltar, o tronco a partir dali.
function buildTrail(trunk: StageRow[], stages: StageRow[], path: PathRow | null) {
  if (!path) return trunk;
  const branchIdx = trunk.findIndex((s) => s.id === path.branches_from_stage_id);
  if (branchIdx < 0) return trunk;
  const pathStages = stages.filter((s) => s.path_id === path.id).sort((a, b) => a.position - b.position);
  const mergeIdx = path.merges_into_stage_id ? trunk.findIndex((s) => s.id === path.merges_into_stage_id) : -1;
  return [...trunk.slice(0, branchIdx + 1), ...pathStages, ...(mergeIdx >= 0 ? trunk.slice(mergeIdx) : [])];
}

function FluxoDentro() {
  const { fluxo } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const cats = useMessageCategories();
  const flowData = useFlowData();
  const messages = useMessages();
  const countCopy = useCountCopy();

  const { flows } = useMemo(() => buildFlows(cats.rows, flowData.stages), [cats.rows, flowData.stages]);
  const flow = flows.find((f) => f.key === fluxo || f.categoryId === fluxo) ?? null;

  const flowPaths = useMemo(
    () => (flow ? flowData.paths.filter((p) => (p.category_id ?? null) === flow.categoryId).sort((a, b) => a.position - b.position) : []),
    [flow, flowData.paths],
  );
  const path = flowPaths.find((p) => p.id === search.caminho) ?? null;
  const trail = useMemo(() => (flow ? buildTrail(flow.trunk, flowData.stages, path) : []), [flow, flowData.stages, path]);
  const currentIdx = Math.max(0, trail.findIndex((s) => s.id === search.etapa));
  const stage = trail[currentIdx] ?? null;

  const stageMessages = useMemo(() => {
    if (!stage) return [];
    const pos = (m: MessageRow) => (m.flow_links ?? []).find((l) => l.flow_stage_id === stage.id)?.position ?? 0;
    return messages.rows.filter((m) => (m.flow_links ?? []).some((l) => l.flow_stage_id === stage.id)).sort((a, b) => pos(a) - pos(b));
  }, [messages.rows, stage]);
  const selected = stageMessages.find((m) => m.id === search.msg) ?? stageMessages[0] ?? null;
  const forks = stage ? flowPaths.filter((p) => p.branches_from_stage_id === stage.id) : [];

  const go = (next: FluxoSearch) => navigate({ search: next, replace: true });
  const goStage = (id: string) => go({ caminho: path?.id, etapa: id });
  const choosePath = (p: PathRow) => go({ caminho: path?.id === p.id ? undefined : p.id, etapa: stage?.id });

  // Mantém a etapa atual visível na trilha quando ela rola na horizontal.
  const trailRef = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    trailRef.current?.querySelector<HTMLElement>(`[data-step="${stage?.id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [stage?.id]);

  const loading = cats.isLoading || flowData.isLoading || messages.isLoading;
  const prev = trail[currentIdx - 1] ?? null;
  const next = trail[currentIdx + 1] ?? null;

  if (!loading && !flow) {
    return (
      <div className="px-4 py-10 sm:px-8">
        <TopbarBreadcrumb items={[{ label: "Scripts", to: "/scripts" }, { label: "Fluxo de atendimento", to: "/scripts/fluxo" }, { label: "Fluxo não encontrado" }]} />
        <p className="text-sm text-ink-muted">Este fluxo não existe mais.</p>
        <Link to="/scripts/fluxo" className="mt-2 inline-block text-sm font-medium text-gold-text hover:underline">Ver todos os fluxos <span aria-hidden>→</span></Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-var(--topbar-h))] flex-col lg:h-[calc(100dvh-var(--topbar-h))] lg:flex-row">
      {flow && (
        <TopbarBreadcrumb
          items={[
            { label: "Scripts", to: "/scripts" },
            { label: "Fluxo de atendimento", to: "/scripts/fluxo", search: flow.groupId ? { categoria: flow.groupId } : undefined },
            { label: flow.name },
          ]}
        />
      )}

      {/* Coluna principal */}
      <div className="min-w-0 flex-1 lg:overflow-y-auto">
        <div className="mx-auto max-w-[1040px] px-4 pb-12 pt-6 sm:px-8 lg:pt-8">
          {loading || !flow ? (
            <div className="space-y-5"><SkeletonLine className="h-7 w-48" /><SkeletonLine className="h-6 w-full max-w-xl" /><SkeletonLine className="h-24 w-full" /></div>
          ) : (
            <>
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-2xl font-semibold leading-8 text-ink">{flow.name}</h1>
                <p className="text-sm text-ink-muted">
                  {flow.groupName !== flow.name ? `${flow.groupName} · ` : ""}{etapasLabel(trail.length)}
                </p>
              </header>

              {trail.length === 0 ? (
                <p className="mt-6 text-sm text-ink-muted">Nenhuma etapa cadastrada neste fluxo ainda.</p>
              ) : (
                <>
                  {/* Trilha de etapas */}
                  <nav aria-label="Etapas do fluxo" className="-mx-1 mt-6 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                    <ol ref={trailRef} className="flex w-max items-center">
                      {trail.map((s, i) => {
                        const done = i < currentIdx;
                        const current = i === currentIdx;
                        return (
                          <li key={s.id} data-step={s.id} className="flex items-center">
                            {i > 0 && <span aria-hidden className="mx-2.5 h-px w-5 bg-line-strong/70" />}
                            <button
                              type="button"
                              onClick={() => goStage(s.id)}
                              aria-current={current ? "step" : undefined}
                              className="flex items-center gap-2.5 rounded-full py-1 pr-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              <span
                                className={cn(
                                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums",
                                  current && "border-gold bg-gold font-semibold text-on-gold",
                                  done && "border-line bg-surface-2 text-ink-muted",
                                  !current && !done && "border-line-strong text-ink",
                                )}
                              >
                                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2} aria-label="feita" /> : i + 1}
                              </span>
                              <span className={cn("whitespace-nowrap text-sm", current ? "font-semibold text-ink" : "text-ink-muted hover:text-ink")}>
                                {s.name}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </nav>

                  {stage && (
                    <section aria-labelledby="etapa-atual" className="mt-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h2 id="etapa-atual" className="text-lg font-semibold leading-7 text-ink">
                          {currentIdx + 1}. {stage.name}
                        </h2>
                        <p className="text-sm text-ink-muted">{mensagensLabel(stageMessages.length)}</p>
                      </div>

                      {stageMessages.length === 0 ? (
                        <p className="mt-3 text-sm text-ink-muted">Nenhuma mensagem nesta etapa ainda.</p>
                      ) : (
                        <ul className="mt-2 border-t border-line">
                          {stageMessages.map((m) => (
                            <FlowMessageRow
                              key={m.id}
                              m={m}
                              selected={selected?.id === m.id}
                              onSelect={() => go({ caminho: path?.id, etapa: stage.id, msg: m.id })}
                              onCopied={() => countCopy(m.id)}
                            />
                          ))}
                        </ul>
                      )}

                      {forks.length > 0 && (
                        <div className="mt-6">
                          <p className="text-sm font-semibold text-ink">O cliente respondeu…</p>
                          <div className="mt-2.5 flex flex-wrap gap-2.5">
                            {forks.map((p) => {
                              const chosen = path?.id === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  aria-pressed={chosen}
                                  onClick={() => choosePath(p)}
                                  className={cn(
                                    "rounded-full border border-dashed px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                    chosen ? "border-gold bg-surface-2 font-semibold text-ink" : "border-line-strong text-ink-muted hover:border-ink-muted hover:text-ink",
                                  )}
                                >
                                  {p.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                        {prev ? (
                          <OutlineButton onClick={() => goStage(prev.id)}>
                            <span aria-hidden>←</span> Etapa anterior
                          </OutlineButton>
                        ) : <span />}
                        {next && (
                          <GoldButton onClick={() => goStage(next.id)}>
                            Próxima etapa: {next.name} <span aria-hidden>→</span>
                          </GoldButton>
                        )}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Painel da mensagem selecionada */}
      <aside aria-label="Mensagem selecionada" className="border-t border-line lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-[360px]">
        <div className="px-4 py-6 sm:px-6 lg:py-8">
          <p className="text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">Mensagem selecionada</p>
          {loading ? (
            <div className="mt-3 space-y-3"><SkeletonLine className="h-5 w-40" /><SkeletonLine className="h-28 w-full rounded-xl" /></div>
          ) : selected ? (
            <SelectedPanel key={selected.id} m={selected} onCopied={() => countCopy(selected.id)} />
          ) : (
            <p className="mt-3 text-sm text-ink-muted">Nenhuma mensagem nesta etapa ainda.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function FlowMessageRow({ m, selected, onSelect, onCopied }: { m: MessageRow; selected: boolean; onSelect: () => void; onCopied: () => void }) {
  const { copied, copy } = useCopy(onCopied);
  return (
    <li className={cn("flex items-center gap-3 border-b border-line pr-2 transition-colors", selected ? "bg-sidebar" : "hover:bg-sidebar/60")}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="min-w-0 flex-1 py-3 pl-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14.5px] font-semibold leading-5 text-ink">{m.title}</span>
          {m.shortcut && (
            <span className="shrink-0 rounded border border-line px-1.5 text-[11.5px] font-medium leading-[18px] text-gold-text">/{m.shortcut}</span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[13px] leading-5 text-ink-muted">{previewLine(m.content) || "Sem texto"}</span>
      </button>
      <button
        type="button"
        onClick={() => copy(m.content)}
        aria-label={copied ? "Copiado" : `Copiar “${m.title}”`}
        className="h-8 min-w-[76px] shrink-0 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-semibold text-gold-text transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </li>
  );
}

function SelectedPanel({ m, onCopied }: { m: MessageRow; onCopied: () => void }) {
  const { copied, copy } = useCopy(onCopied);
  return (
    <>
      <h2 className="mt-1.5 text-lg font-semibold leading-7 text-ink">{m.title}</h2>
      <div className="mt-3 rounded-xl bg-surface-2 px-4 py-3.5">
        {m.content.trim() ? <WhatsAppMessage content={m.content} className="text-[14.5px] leading-[1.6]" /> : <p className="text-sm text-ink-muted">Mensagem sem texto.</p>}
      </div>
      {m.image_url && <img src={m.image_url} alt={m.title} className="mt-3 max-h-48 rounded-lg border border-line object-contain" />}
      <GoldButton className="mt-3.5 w-full" onClick={() => copy(m.content)} aria-live="polite">
        {copied ? "Copiado" : "Copiar mensagem"}
      </GoldButton>
      {m.internal_note?.trim() && <p className="mt-5 text-sm leading-[22px] text-ink-muted">{m.internal_note}</p>}
    </>
  );
}
