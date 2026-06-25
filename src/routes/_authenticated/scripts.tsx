import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listScripts } from "@/lib/content.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CopyButton } from "@/components/CopyButton";
import { Markdown } from "@/components/Markdown";
import { Search, MessageSquareQuote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/scripts")({
  component: Page,
});

function Page() {
  const fn = useServerFn(listScripts);
  const q = useQuery({ queryKey: ["scripts"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    (q.data ?? []).forEach((s) => set.add(s.category));
    return Array.from(set).sort();
  }, [q.data]);

  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim();
    if (!needle) return q.data ?? [];
    return (q.data ?? []).filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.body.toLowerCase().includes(needle) ||
        (s.usage_note ?? "").toLowerCase().includes(needle) ||
        s.category.toLowerCase().includes(needle),
    );
  }, [q.data, filter]);

  const allTab = "todos";

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquareQuote className="h-7 w-7 text-primary" /> Scripts de Atendimento
        </h1>
        <p className="text-muted-foreground mt-1">
          Mensagens prontas organizadas por categoria. Clique em copiar para colar no atendimento.
        </p>
      </header>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar em todos os scripts..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {q.isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {!q.isLoading && (q.data?.length ?? 0) === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhum script cadastrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Peça ao administrador para adicionar no Painel Admin.</p>
        </Card>
      )}

      {(q.data?.length ?? 0) > 0 && (
        <Tabs defaultValue={allTab}>
          <TabsList className="flex-wrap h-auto justify-start gap-1">
            <TabsTrigger value={allTab}>Todos ({filtered.length})</TabsTrigger>
            {categories.map((c) => {
              const count = filtered.filter((s) => s.category === c).length;
              return (
                <TabsTrigger key={c} value={c}>
                  {c} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={allTab} className="mt-4">
            <ScriptGrid items={filtered} />
          </TabsContent>
          {categories.map((c) => (
            <TabsContent key={c} value={c} className="mt-4">
              <ScriptGrid items={filtered.filter((s) => s.category === c)} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

interface Script {
  id: string;
  category: string;
  subcategory: string | null;
  title: string;
  body: string;
  usage_note: string | null;
}

function ScriptGrid({ items }: { items: Script[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhum script nesta categoria.</p>;
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {items.map((s) => (
        <Card key={s.id} className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-primary font-medium">{s.category}{s.subcategory ? ` · ${s.subcategory}` : ""}</p>
              <h3 className="font-semibold mt-0.5">{s.title}</h3>
            </div>
            <CopyButton text={s.body} />
          </div>
          <div className="rounded-md bg-muted/40 border border-border p-3 max-h-64 overflow-y-auto">
            <Markdown>{s.body}</Markdown>
          </div>
          {s.usage_note && (
            <p className="text-xs text-muted-foreground italic">📝 {s.usage_note}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
