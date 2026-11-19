import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMessages, incrementMessageUseCount } from "@/lib/messages.functions";
import { listFlowStages, listFlowPaths } from "@/lib/messageflow.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/CopyButton";
import { DownloadImageButton } from "@/components/DownloadImageButton";
import { Markdown } from "@/components/Markdown";
import { Search, StickyNote, GitFork, CornerDownRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Pill, PillRow } from "@/components/Pill";
import { SkeletonCard } from "@/components/ui/skeleton-card";

export const Route = createFileRoute("/_authenticated/scripts")({
  component: Page,
});

function Page() {
  // O Fluxo de Atendimento abre primeiro: copiar a mensagem da etapa é a tarefa principal.
  const [mode, setMode] = useState<"biblioteca" | "fluxo">("fluxo");
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-5 lg:py-7">
      <PageHeader
        title="Mensagens"
        description={mode === "biblioteca" ? "Todas as mensagens prontas, com busca e filtros." : "A ordem das mensagens no atendimento, etapa por etapa."}
        actions={
          <PillRow role="group" aria-label="Modo de visualização">
            <Pill active={mode === "fluxo"} onClick={() => setMode("fluxo")}>Fluxo de Atendimento</Pill>
            <Pill active={mode === "biblioteca"} onClick={() => setMode("biblioteca")}>Biblioteca</Pill>
          </PillRow>
        }
      />

      {mode === "biblioteca" ? <Biblioteca /> : <FluxoAtendimento />}
    </div>
  );
}

interface MessageRow {
  id: string;
  title: string;
  content: string;
  internal_note: string | null;
  tags: string[];
  category: { id: string; name: string; color: string | null } | null;
  subcategory: { id: string; name: string } | null;
  position: number;
  shortcut?: string | null;
  category_id?: string | null;
  flow_links?: { id: string; flow_stage_id: string; position: number }[];
  image_url?: string | null;
  image_ext?: string | null;
}

interface StageRow { id: string; name: string; position: number; category_id: string | null; path_id: string | null; }
interface FlowCatRow { id: string; name: string; parent_id: string | null; }
interface PathRow { id: string; name: string; category_id: string | null; branches_from_stage_id: string; merges_into_stage_id: string | null; position: number; }

// Cartão de mensagem: título e atalho à esquerda, Copiar sempre no canto
// superior direito, texto logo abaixo. Mesmo desenho no Fluxo e na Biblioteca.
function MessageCard({ m, onCopy, showCategory = false }: { m: MessageRow; onCopy: () => void; showCategory?: boolean }) {
  return (
    <article className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 pt-1">
          {showCategory && m.category && (
            <p className="mb-0.5 text-xs text-muted-foreground">
              {m.category.name}{m.subcategory ? ` · ${m.subcategory.name}` : ""}
            </p>
          )}
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-semibold leading-snug">
            <span className="min-w-0">{m.title}</span>
            {m.shortcut && (
              <span className="rounded bg-accent px-1.5 py-px font-mono text-[11px] font-medium text-primary" title="Atalho no WhatsApp Business">/{m.shortcut}</span>
            )}
          </h3>
        </div>
        <CopyButton text={m.content} onCopy={onCopy} />
      </div>
      <div className="mt-1.5 max-h-72 overflow-y-auto text-[14.5px] leading-relaxed [&_.prose-cdt]:leading-relaxed [&_.prose-cdt_p:last-child]:mb-0">
        <Markdown>{m.content}</Markdown>
      </div>
      {m.image_url && (
        <div className="mt-2 flex flex-col items-start gap-2">
          <img src={m.image_url} alt={m.title} className="max-h-56 rounded-lg border border-border object-contain" />
          <DownloadImageButton url={m.image_url} filename={`${m.title}.${m.image_ext || "jpg"}`} />
        </div>
      )}
      {m.internal_note && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          <StickyNote className="mt-px h-3.5 w-3.5 shrink-0" />
          <span><span className="font-medium text-foreground">Nota interna:</span> {m.internal_note}</span>
        </p>
      )}
    </article>
  );
}

function FluxoAtendimento() {
  const msgFn = useServerFn(listMessages);
  const stageFn = useServerFn(listFlowStages);
  const pathFn = useServerFn(listFlowPaths);
  const catFn = useServerFn(listCategories);
  const incUse = useServerFn(incrementMessageUseCount);
  const msgQ = useQuery({ queryKey: ["messages"], queryFn: () => msgFn({}) });
  const stageQ = useQuery({ queryKey: ["flow-stages"], queryFn: () => stageFn({}) });
  const pathQ = useQuery({ queryKey: ["flow-paths"], queryFn: () => pathFn({}) });
  const catQ = useQuery({ queryKey: ["cats", "message"], queryFn: () => catFn({ data: { scope: "message" } }) });

  const rows = (msgQ.data ?? []) as unknown as MessageRow[];
  const allStages = (stageQ.data ?? []) as StageRow[];
  const allPaths = (pathQ.data ?? []) as PathRow[];
  const allCats = (catQ.data ?? []) as FlowCatRow[];
  const parents = allCats.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => allCats.filter((c) => c.parent_id === id);

  const [flowCat, setFlowCat] = useState<string>("geral");
  const [expandedParent, setExpandedParent] = useState<string | null>(null);
  const flowCategoryId = flowCat === "geral" ? null : flowCat;

  const selectParent = (parent: FlowCatRow) => {
    const kids = childrenOf(parent.id);
    if (kids.length > 0) {
      setExpandedParent(parent.id);
      if (!kids.some((k) => k.id === flowCat)) setFlowCat(kids[0].id);
    } else {
      setExpandedParent(null);
      setFlowCat(parent.id);
    }
  };

  const trunkStages = allStages
    .filter((s) => (s.category_id ?? null) === flowCategoryId && !s.path_id)
    .slice()
    .sort((a, b) => a.position - b.position);

  const pathsForCat = allPaths
    .filter((p) => (p.category_id ?? null) === flowCategoryId)
    .slice()
    .sort((a, b) => a.position - b.position);

  const stageById = (id: string) => allStages.find((s) => s.id === id);
  const currentScopeName = flowCat === "geral" ? "Geral" : (allCats.find((c) => c.id === flowCat)?.name ?? "Geral");

  const messagesForStage = (stageId: string) =>
    rows
      .filter((m) => (m.flow_links ?? []).some((l) => l.flow_stage_id === stageId))
      .slice()
      .sort((a, b) => {
        const la = (a.flow_links ?? []).find((l) => l.flow_stage_id === stageId)?.position ?? 0;
        const lb = (b.flow_links ?? []).find((l) => l.flow_stage_id === stageId)?.position ?? 0;
        return la - lb;
      });

  const renderStage = (stage: StageRow, idx: number, anchor = true) => {
    const stageMessages = messagesForStage(stage.id);
    return (
      <section
        key={stage.id}
        id={anchor ? `etapa-${stage.id}` : undefined}
        data-stage={anchor ? stage.id : undefined}
        className="scroll-mt-[calc(var(--topbar-h)+4.5rem)]"
      >
        <h2 className="mb-2 flex items-baseline gap-2 text-[15px] font-semibold">
          <span className="tabular-nums text-primary">{idx + 1}</span>
          <span>{stage.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {stageMessages.length} {stageMessages.length === 1 ? "mensagem" : "mensagens"}
          </span>
        </h2>
        {stageMessages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            Nenhuma mensagem nesta etapa ainda.
          </p>
        ) : (
          <div className="space-y-2.5">
            {stageMessages.map((m) => (
              <MessageCard key={m.id} m={m} onCopy={() => incUse({ data: { id: m.id } })} />
            ))}
          </div>
        )}
      </section>
    );
  };

  // Trilha de etapas: destaca a etapa visível e rola até ela ao clicar.
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const trunkKey = trunkStages.map((s) => s.id).join(",");
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (!trunkKey) return;
    setActiveStage(trunkKey.split(",")[0]);
    const visible = new Map<string, number>();
    observerRef.current?.disconnect();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.stage!;
          if (e.isIntersecting) visible.set(id, e.boundingClientRect.top);
          else visible.delete(id);
        }
        const first = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (first) setActiveStage(first[0]);
      },
      { rootMargin: "-170px 0px -55% 0px" },
    );
    observerRef.current = obs;
    document.querySelectorAll<HTMLElement>("[data-stage]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [trunkKey]);

  // Mantém a pílula ativa visível quando a trilha não cabe numa linha.
  const trailRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!activeStage || !trailRef.current) return;
    const el = trailRef.current.querySelector<HTMLElement>(`[data-trail="${activeStage}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeStage]);

  const goToStage = (id: string) => {
    setActiveStage(id);
    document.getElementById(`etapa-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (stageQ.isLoading || pathQ.isLoading || msgQ.isLoading || catQ.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div>
      {parents.length > 0 && (
        <PillRow className="mb-2" role="group" aria-label="Tipo de atendimento">
          <Pill active={flowCat === "geral" && !expandedParent} onClick={() => { setFlowCat("geral"); setExpandedParent(null); }}>Geral</Pill>
          {parents.map((c) => {
            const hasKids = childrenOf(c.id).length > 0;
            const active = hasKids ? expandedParent === c.id : flowCat === c.id;
            return (
              <Pill key={c.id} active={active} onClick={() => selectParent(c)}>{c.name}</Pill>
            );
          })}
        </PillRow>
      )}

      {expandedParent && childrenOf(expandedParent).length > 0 && (
        <PillRow className="mb-2 ml-1 border-l border-border pl-3" role="group" aria-label="Subtipo">
          {childrenOf(expandedParent).map((c) => (
            <Pill key={c.id} active={flowCat === c.id} onClick={() => setFlowCat(c.id)}>{c.name}</Pill>
          ))}
        </PillRow>
      )}

      {trunkStages.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-card px-5 py-8 text-center">
          <p className="font-medium">Nenhuma etapa cadastrada para "{currentScopeName}".</p>
          <p className="mt-1 text-sm text-muted-foreground">Configure em Painel Admin → Mensagens → aba "Fluxo de Atendimento".</p>
        </div>
      ) : (
        <>
          <nav
            aria-label="Etapas do atendimento"
            className="sticky top-(--topbar-h) z-20 -mx-4 mb-4 border-b border-border bg-background px-4 py-2.5 sm:-mx-5 sm:px-5"
          >
            <div ref={trailRef} className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {trunkStages.map((stage, idx) => (
                <Pill
                  key={stage.id}
                  data-trail={stage.id}
                  className="px-3"
                  tone="brand"
                  active={activeStage === stage.id}
                  aria-current={activeStage === stage.id ? "step" : undefined}
                  onClick={() => goToStage(stage.id)}
                >
                  <span className="tabular-nums">{idx + 1}</span> {stage.name}
                </Pill>
              ))}
            </div>
          </nav>

          <div className="space-y-7">
            {trunkStages.map((stage, idx) => {
              const forksHere = pathsForCat.filter((p) => p.branches_from_stage_id === stage.id);
              return (
                <div key={stage.id} className="space-y-4">
                  {renderStage(stage, idx)}
                  {forksHere.length > 0 && (
                    <div className="rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <GitFork className="h-3.5 w-3.5" />
                        O fluxo se divide em {forksHere.length} {forksHere.length === 1 ? "caminho" : "caminhos"} aqui
                      </p>
                      <div className={`grid gap-4 ${forksHere.length > 1 ? "xl:grid-cols-2" : ""}`}>
                        {forksHere.map((path) => {
                          const pathStages = allStages
                            .filter((s) => s.path_id === path.id)
                            .slice()
                            .sort((a, b) => a.position - b.position);
                          const mergeStage = path.merges_into_stage_id ? stageById(path.merges_into_stage_id) : null;
                          return (
                            <div key={path.id} className="min-w-0">
                              <p className="mb-2 text-sm font-semibold">{path.name}</p>
                              {pathStages.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Nenhuma etapa cadastrada neste caminho ainda.</p>
                              ) : (
                                <div className="space-y-4">{pathStages.map((s, i) => renderStage(s, i, false))}</div>
                              )}
                              {mergeStage && (
                                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                  <CornerDownRight className="h-3.5 w-3.5" /> Volta para: <span className="font-medium text-foreground">{mergeStage.name}</span>
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Busca tolerante: ignora acento e tolera pequenos erros de digitação por palavra.
function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyWordMatch(haystackWords: string[], queryWord: string) {
  if (queryWord.length < 3) return haystackWords.some((w) => w.startsWith(queryWord));
  const maxDist = queryWord.length <= 5 ? 1 : 2;
  return haystackWords.some((w) => w.startsWith(queryWord) || w.includes(queryWord) || levenshtein(w, queryWord) <= maxDist);
}

function Biblioteca() {  const fn = useServerFn(listMessages);
  const incUse = useServerFn(incrementMessageUseCount);
  const q = useQuery({ queryKey: ["messages"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");
  const [activeCat, setActiveCat] = useState<string>("todos");
  const [activeSub, setActiveSub] = useState<string>("todos");

  const rows = (q.data ?? []) as unknown as MessageRow[];

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.category) map.set(r.category.id, r.category.name); });
    return Array.from(map.entries());
  }, [rows]);

  const subcategories = useMemo(() => {
    const map = new Map<string, string>();
    rows
      .filter((r) => activeCat === "todos" || r.category?.id === activeCat)
      .forEach((r) => { if (r.subcategory) map.set(r.subcategory.id, r.subcategory.name); });
    return Array.from(map.entries());
  }, [rows, activeCat]);

  const filtered = useMemo(() => {
    const n = normalize(filter.trim());
    const queryWords = n.split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (activeCat !== "todos" && r.category?.id !== activeCat) return false;
      if (activeSub !== "todos" && r.subcategory?.id !== activeSub) return false;
      if (queryWords.length === 0) return true;

      const haystack = normalize([
        r.title, r.content, r.category?.name ?? "", r.subcategory?.name ?? "", (r.tags ?? []).join(" "),
      ].join(" "));

      // Primeiro tenta o jeito exato (mais rápido e mais preciso)
      if (queryWords.every((w) => haystack.includes(w))) return true;

      // Se não bateu, tolera acento diferente e pequenos erros de digitação por palavra
      const haystackWords = haystack.split(/\s+/).filter(Boolean);
      return queryWords.every((w) => fuzzyWordMatch(haystackWords, w));
    });
  }, [rows, filter, activeCat, activeSub]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-10 pl-9" placeholder="Buscar por título, conteúdo, tag ou categoria…"
          value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <PillRow className="mb-2" role="group" aria-label="Categoria">
        <Pill active={activeCat === "todos"} onClick={() => { setActiveCat("todos"); setActiveSub("todos"); }}>
          Todas
        </Pill>
        {categories.map(([id, name]) => (
          <Pill key={id} active={activeCat === id} onClick={() => { setActiveCat(id); setActiveSub("todos"); }}>
            {name}
          </Pill>
        ))}
      </PillRow>

      {subcategories.length > 0 && (
        <PillRow className="mb-2 ml-1 border-l border-border pl-3" role="group" aria-label="Subcategoria">
          <Pill active={activeSub === "todos"} onClick={() => setActiveSub("todos")}>Todas</Pill>
          {subcategories.map(([id, name]) => (
            <Pill key={id} active={activeSub === id} onClick={() => setActiveSub(id)}>{name}</Pill>
          ))}
        </PillRow>
      )}

      <p className="mb-3 mt-3 text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "mensagem" : "mensagens"}
      </p>

      {q.isLoading && (
        <div className="grid gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {!q.isLoading && filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
          <p className="font-medium">Nenhuma mensagem encontrada.</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente outra palavra ou limpe os filtros. Novas mensagens são cadastradas no Painel Admin → Mensagens.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 2xl:grid-cols-2">
        {filtered.map((m) => (
          <div key={m.id} className="flex flex-col gap-1.5">
            <MessageCard m={m} showCategory onCopy={() => incUse({ data: { id: m.id } })} />
            {m.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 px-1">
                {m.tags.map((t) => (
                  <span key={t} className="text-[11px] text-muted-foreground">#{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
