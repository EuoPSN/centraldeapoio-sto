import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMessages } from "@/lib/messages.functions";
import { listFlowStages } from "@/lib/messageflow.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { Markdown } from "@/components/Markdown";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Search, MessageSquareQuote, ListOrdered, Library } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton-card";

export const Route = createFileRoute("/_authenticated/scripts")({
  component: Page,
});

function Page() {
  const [mode, setMode] = useState<"biblioteca" | "fluxo">("biblioteca");
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquareQuote className="h-7 w-7 text-primary" /> Atendimento
        </h1>
        <p className="text-muted-foreground mt-1">
          {mode === "biblioteca" ? "Biblioteca de mensagens prontas para o atendimento." : "A ordem das mensagens dentro de um atendimento, etapa por etapa."}
        </p>
      </header>

      <div className="flex gap-2 mb-6">
        <Button size="sm" variant={mode === "biblioteca" ? "default" : "outline"} className="gap-2" onClick={() => setMode("biblioteca")}>
          <Library className="h-4 w-4" /> Biblioteca
        </Button>
        <Button size="sm" variant={mode === "fluxo" ? "default" : "outline"} className="gap-2" onClick={() => setMode("fluxo")}>
          <ListOrdered className="h-4 w-4" /> Fluxo de Atendimento
        </Button>
      </div>

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
}

interface StageRow { id: string; name: string; position: number; category_id: string | null; }
interface FlowCatRow { id: string; name: string; parent_id: string | null; }

function FluxoAtendimento() {
  const msgFn = useServerFn(listMessages);
  const stageFn = useServerFn(listFlowStages);
  const catFn = useServerFn(listCategories);
  const msgQ = useQuery({ queryKey: ["messages"], queryFn: () => msgFn({}) });
  const stageQ = useQuery({ queryKey: ["flow-stages"], queryFn: () => stageFn({}) });
  const catQ = useQuery({ queryKey: ["cats", "message"], queryFn: () => catFn({ data: { scope: "message" } }) });

  const rows = (msgQ.data ?? []) as unknown as MessageRow[];
  const allStages = (stageQ.data ?? []) as StageRow[];
  const parents = ((catQ.data ?? []) as FlowCatRow[]).filter((c) => !c.parent_id);

  const [flowCat, setFlowCat] = useState<string>("geral");
  const flowCategoryId = flowCat === "geral" ? null : flowCat;
  const stages = allStages
    .filter((s) => (s.category_id ?? null) === flowCategoryId)
    .slice()
    .sort((a, b) => a.position - b.position);

  if (stageQ.isLoading || msgQ.isLoading || catQ.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {parents.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={flowCat === "geral" ? "default" : "outline"} onClick={() => setFlowCat("geral")}>Geral</Button>
          {parents.map((c) => (
            <Button key={c.id} size="sm" variant={flowCat === c.id ? "default" : "outline"} onClick={() => setFlowCat(c.id)}>{c.name}</Button>
          ))}
        </div>
      )}

      {stages.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhuma etapa de fluxo cadastrada ainda para "{flowCat === "geral" ? "Geral" : parents.find((c) => c.id === flowCat)?.name}".</p>
          <p className="text-xs text-muted-foreground mt-1">Configure em Painel Admin → Mensagens → aba "Fluxo de Atendimento".</p>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={stages.map((s) => s.id)} className="space-y-3">
          {stages.map((stage, idx) => {
            const stageMessages = rows
              .filter((m) => (m.flow_links ?? []).some((l) => l.flow_stage_id === stage.id))
              .slice()
              .sort((a, b) => {
                const la = (a.flow_links ?? []).find((l) => l.flow_stage_id === stage.id)?.position ?? 0;
                const lb = (b.flow_links ?? []).find((l) => l.flow_stage_id === stage.id)?.position ?? 0;
                return la - lb;
              });
            return (
              <AccordionItem key={stage.id} value={stage.id} className="border border-border rounded-lg px-4 bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">{idx + 1}</span>
                    <span className="font-semibold">{stage.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">{stageMessages.length} mensagem(ns)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {stageMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground pb-3">Nenhuma mensagem atribuída a esta etapa ainda.</p>
                  ) : (
                    <div className="space-y-3 pb-3">
                      {stageMessages.map((m) => (
                        <div key={m.id} className="rounded-md border border-border p-3">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {m.shortcut && <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">/{m.shortcut}</span>}
                              <h4 className="font-medium truncate">{m.title}</h4>
                            </div>
                            <CopyButton text={m.content} />
                          </div>
                          <div className="rounded-md bg-muted/40 border border-border p-3 max-h-56 overflow-y-auto">
                            <Markdown>{m.content}</Markdown>
                          </div>
                          {m.image_url && <img src={m.image_url} alt={m.title} className="mt-2 rounded-md border border-border max-h-64 object-contain" />}
                          {m.internal_note && <p className="text-xs text-muted-foreground italic mt-2">📝 {m.internal_note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

function Biblioteca() {
  const fn = useServerFn(listMessages);
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
    const n = filter.toLowerCase().trim();
    return rows.filter((r) => {
      if (activeCat !== "todos" && r.category?.id !== activeCat) return false;
      if (activeSub !== "todos" && r.subcategory?.id !== activeSub) return false;
      if (!n) return true;
      return r.title.toLowerCase().includes(n)
        || r.content.toLowerCase().includes(n)
        || (r.category?.name ?? "").toLowerCase().includes(n)
        || (r.subcategory?.name ?? "").toLowerCase().includes(n)
        || (r.tags ?? []).some((t) => t.toLowerCase().includes(n));
    });
  }, [rows, filter, activeCat, activeSub]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por título, conteúdo, tag, categoria..."
            value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" variant={activeCat === "todos" ? "default" : "outline"} onClick={() => { setActiveCat("todos"); setActiveSub("todos"); }}>
          Todas categorias
        </Button>
        {categories.map(([id, name]) => (
          <Button key={id} size="sm" variant={activeCat === id ? "default" : "outline"}
            onClick={() => { setActiveCat(id); setActiveSub("todos"); }}>
            {name}
          </Button>
        ))}
      </div>

      {subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 pl-2 border-l-2 border-border">
          <Button size="sm" variant={activeSub === "todos" ? "secondary" : "ghost"} onClick={() => setActiveSub("todos")}>
            Todas subcategorias
          </Button>
          {subcategories.map(([id, name]) => (
            <Button key={id} size="sm" variant={activeSub === id ? "secondary" : "ghost"} onClick={() => setActiveSub(id)}>
              {name}
            </Button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} mensagem(ns)</p>

      {q.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {!q.isLoading && filtered.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhuma mensagem encontrada.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre no Painel Admin → Mensagens.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((m) => (
          <Card key={m.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {m.category && (
                  <p className="text-xs uppercase tracking-wide text-primary font-medium">
                    {m.category.name}{m.subcategory ? ` · ${m.subcategory.name}` : ""}
                  </p>
                )}
                <h3 className="font-semibold mt-0.5">{m.title}</h3>
              </div>
              <CopyButton text={m.content} />
            </div>
            <div className="rounded-md bg-muted/40 border border-border p-3 max-h-64 overflow-y-auto">
              <Markdown>{m.content}</Markdown>
            </div>
            {m.image_url && <img src={m.image_url} alt={m.title} className="rounded-md border border-border max-h-56 object-contain" />}
            {m.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {m.tags.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">#{t}</span>
                ))}
              </div>
            )}
            {m.internal_note && <p className="text-xs text-muted-foreground italic">📝 {m.internal_note}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
