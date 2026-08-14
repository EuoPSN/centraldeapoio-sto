import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPricing } from "@/lib/content.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/CopyButton";
import { DollarSign, Search, TrendingDown, ListChecks, AlertTriangle, Info } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton-card";

export const Route = createFileRoute("/_authenticated/precos")({
  component: Page,
});

interface PricingRow {
  id: string;
  specialty: string;
  cartao_price: number | string | null;
  particular_price: number | string | null;
  category: string;
  notes: string | null;
  description: string | null;
}

const fmt = (n: number | string | null) =>
  n == null ? "—" : `R$ ${Number(n).toFixed(2).replace(".", ",")}`;

const economia = (cartao: number | string | null, particular: number | string | null) => {
  if (cartao == null || particular == null) return null;
  const c = Number(cartao), p = Number(particular);
  if (p <= 0) return null;
  return { valor: p - c, pct: Math.round(((p - c) / p) * 100) };
};

function Page() {
  const fn = useServerFn(listPricing);
  const q = useQuery({ queryKey: ["pricing"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");
const [activeCat, setActiveCat] = useState<string>("todos");
  const [expandedDesc, setExpandedDesc] = useState<Set<string>>(new Set());

  const rows = (q.data ?? []) as PricingRow[];

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.category));
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim();
    return rows.filter((r) => {
      if (activeCat !== "todos" && r.category !== activeCat) return false;
      if (!needle) return true;
      return r.specialty.toLowerCase().includes(needle)
        || (r.notes ?? "").toLowerCase().includes(needle)
        || (r.description ?? "").toLowerCase().includes(needle);
    });
  }, [rows, filter, activeCat]);

  // Agrupa por categoria e, dentro dela, por especialidade (variações como
  // "consulta comum" e "consulta + exame" ficam juntas quando têm o mesmo nome).
  const grouped = useMemo(() => {
    const byCat = new Map<string, Map<string, PricingRow[]>>();
    for (const r of filtered) {
      if (!byCat.has(r.category)) byCat.set(r.category, new Map());
      const bySpec = byCat.get(r.category)!;
      if (!bySpec.has(r.specialty)) bySpec.set(r.specialty, []);
      bySpec.get(r.specialty)!.push(r);
    }
    return Array.from(byCat.entries()).map(([cat, specMap]) => ({
      category: cat,
      specialties: Array.from(specMap.entries()).map(([spec, variants]) => ({ specialty: spec, variants })),
    }));
  }, [filtered]);

  const totalEspecialidades = useMemo(() => new Set(rows.map((r) => r.specialty)).size, [rows]);
  const menorPreco = useMemo(() => {
    const precos = rows.map((r) => (r.cartao_price != null ? Number(r.cartao_price) : null)).filter((n): n is number => n != null);
    return precos.length ? Math.min(...precos) : null;
  }, [rows]);
  const maiorDesconto = useMemo(() => {
    const pcts = rows.map((r) => economia(r.cartao_price, r.particular_price)?.pct ?? null).filter((n): n is number => n != null);
    return pcts.length ? Math.max(...pcts) : null;
  }, [rows]);

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-7 w-7 text-primary" /> Tabela de Preços
        </h1>
        <p className="text-muted-foreground mt-1">
          Consulte rapidamente os valores das consultas e procedimentos.
        </p>
      </header>

      {!q.isLoading && rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Card className="p-4 flex items-center gap-3">
            <ListChecks className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Especialidades</p>
              <p className="font-semibold">{totalEspecialidades}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">A partir de</p>
              <p className="font-semibold">{menorPreco != null ? fmt(menorPreco) : "—"}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <TrendingDown className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Maior desconto</p>
              <p className="font-semibold">{maiorDesconto != null ? `Até ${maiorDesconto}%` : "—"}</p>
            </div>
          </Card>
        </div>
      )}

      <div className="relative mb-3 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar especialidade, exame ou procedimento..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant={activeCat === "todos" ? "default" : "outline"} onClick={() => setActiveCat("todos")}>
            Todos
          </Button>
          {categories.map((c) => (
            <Button key={c} size="sm" variant={activeCat === c ? "default" : "outline"} onClick={() => setActiveCat(c)}>
              {c}
            </Button>
          ))}
        </div>
      )}

      {filter.trim() && (
        <p className="text-xs text-muted-foreground mb-3">
          {grouped.reduce((n, g) => n + g.specialties.length, 0)} especialidade(s) encontrada(s)
        </p>
      )}

      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
        💡 Em geral, o valor particular corresponde a aproximadamente 3× o valor do Cartão de Todos.
      </p>

      {q.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {!q.isLoading && rows.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Tabela de preços ainda não cadastrada.</p>
        </Card>
      )}
      {!q.isLoading && rows.length > 0 && grouped.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhuma especialidade encontrada para essa busca.</p>
        </Card>
      )}

      <div className="space-y-6">
        {grouped.map(({ category, specialties }) => (
          <section key={category}>
            <h2 className="sticky top-0 z-10 bg-background/95 backdrop-blur text-sm font-semibold uppercase tracking-wide text-primary py-2 mb-2">
              {category}
            </h2>
            <div className="space-y-3">
              {specialties.map(({ specialty, variants }) => (
<Card key={specialty} className="p-4">
                  {(() => {
                    const descKey = `${category}|${specialty}`;
                    const desc = variants.find((v) => v.description)?.description;
                    const isOpen = expandedDesc.has(descKey);
                    return (
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold">{specialty}</h3>
                          {desc && (
                            <button type="button" title="O que é essa especialidade"
                              onClick={() => setExpandedDesc((prev) => {
                                const next = new Set(prev);
                                next.has(descKey) ? next.delete(descKey) : next.add(descKey);
                                return next;
                              })}
                              className="text-muted-foreground hover:text-primary">
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {desc && isOpen && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{desc}</p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="space-y-3">
                    {variants.map((v) => {
                      const eco = economia(v.cartao_price, v.particular_price);
                      const copyText = `${specialty}${v.notes ? ` (${v.notes})` : ""}: ${fmt(v.cartao_price)} pelo Cartão de Todos. Valor particular: ${fmt(v.particular_price)}.`;
                      return (
                        <div key={v.id} className={variants.length > 1 ? "border-t pt-3 first:border-t-0 first:pt-0" : ""}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              {variants.length > 1 && v.notes && (
                                <p className="text-xs font-medium text-foreground mb-0.5">{v.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="text-right">
                                <p className="text-[10px] uppercase text-muted-foreground">Cartão de Todos</p>
                                <p className="font-semibold text-primary">{fmt(v.cartao_price)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] uppercase text-muted-foreground">Particular</p>
                                <p className="text-muted-foreground">{fmt(v.particular_price)}</p>
                              </div>
                              {eco && eco.valor > 0 && (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 whitespace-nowrap">
                                  Economize {fmt(eco.valor)} · {eco.pct}% OFF
                                </Badge>
                              )}
                              <CopyButton text={copyText} size="icon" />
                            </div>
                          </div>
                          {(variants.length === 1 && v.notes) && (
                            <p className="text-xs text-amber-700 mt-1.5 flex items-start gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {v.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
