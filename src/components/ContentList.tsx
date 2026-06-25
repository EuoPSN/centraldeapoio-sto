import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Markdown } from "./Markdown";
import { CopyButton } from "./CopyButton";
import { Search } from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
}

export function ContentList({ title, subtitle, items, loading }: {
  title: string;
  subtitle: string;
  items: ContentItem[];
  loading: boolean;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.toLowerCase();
    return items.filter((i) =>
      i.title.toLowerCase().includes(needle) ||
      i.content.toLowerCase().includes(needle) ||
      (i.category ?? "").toLowerCase().includes(needle)
    );
  }, [items, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const i of filtered) {
      const k = i.category || "Geral";
      const arr = map.get(k) ?? [];
      arr.push(i);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </header>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Filtrar nesta seção..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading && <p className="text-muted-foreground">Carregando...</p>}
      {!loading && items.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhum conteúdo cadastrado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Peça ao administrador para adicionar itens no Painel Admin.</p>
        </Card>
      )}
      {!loading && items.length > 0 && filtered.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Nenhum resultado para "{q}".</p>
        </Card>
      )}

      <div className="space-y-6">
        {grouped.map(([category, list]) => (
          <section key={category}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary mb-2">{category}</h2>
            <Card className="divide-y divide-border">
              <Accordion type="multiple">
                {list.map((item) => (
                  <AccordionItem key={item.id} value={item.id} className="px-4 border-0">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <span className="text-left font-medium">{item.title}</span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="flex justify-end mb-2">
                        <CopyButton text={item.content} label="Copiar conteúdo" />
                      </div>
                      <Markdown>{item.content || "_(sem conteúdo)_"}</Markdown>
                      {item.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {item.tags.map((t) => (
                            <span key={t} className="text-[10px] uppercase tracking-wide rounded bg-secondary px-2 py-0.5 text-secondary-foreground">{t}</span>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
