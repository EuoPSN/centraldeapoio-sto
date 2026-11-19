import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPricing } from "@/lib/content.functions";
import { listExames } from "@/lib/exames.functions";
import { listProcedimentos } from "@/lib/odontologia.functions";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/CopyButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Info, MapPin, AlertTriangle } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { PageHeader } from "@/components/PageHeader";
import { Panel, PanelRow } from "@/components/Panel";
import { Pill, PillRow } from "@/components/Pill";
import { PriceTag } from "@/components/PriceTag";
import { PromoPlansPanel } from "@/components/PromoPlansPanel";

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
  unidades: { destaque: boolean; unidade: { id: string; nome: string } | null }[] | null;
}

interface ExameRow {
  id: string;
  nome: string;
  tipo: "laboratorial" | "imagem";
  categoria: string | null;
  material: string | null;
  jejum: boolean;
  preparo: string | null;
  descricao: string | null;
  observacoes: string | null;
  unidades: { unidade: { id: string; nome: string } | null }[] | null;
}

interface ProcedimentoRow {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  cuidados_pos: string | null;
  observacoes: string | null;
  unidades: { unidade: { id: string; nome: string } | null }[] | null;
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
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-5 lg:py-7">
      <PageHeader title="Preços" description="Valores pelo Cartão de TODOS, exames e procedimentos." />

      <Tabs defaultValue="consultas">
        <TabsList className="mb-4">
          <TabsTrigger value="consultas">Consultas</TabsTrigger>
          <TabsTrigger value="exames">Exames</TabsTrigger>
          <TabsTrigger value="odontologia">Odontologia</TabsTrigger>
          <TabsTrigger value="planos">Planos</TabsTrigger>
        </TabsList>
        <TabsContent value="consultas"><ConsultasPublico /></TabsContent>
        <TabsContent value="exames"><ExamesPublico /></TabsContent>
        <TabsContent value="odontologia"><OdontologiaPublico /></TabsContent>
        <TabsContent value="planos"><PromoPlansPanel showEmpty /></TabsContent>
      </Tabs>
    </div>
  );
}

// Campo de busca local de cada aba.
function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-3">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="h-10 pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function EmptyBox({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function UnidadesLine({ principais, outras }: { principais: string[]; outras: string[] }) {
  if (principais.length === 0 && outras.length === 0) return null;
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
      <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-gold-text" />
      <span>
        {principais.length > 0 && <><span className="font-medium text-foreground">{principais.join(", ")}</span></>}
        {principais.length > 0 && outras.length > 0 && " · "}
        {outras.length > 0 && <>outras regiões: {outras.join(", ")}</>}
      </span>
    </p>
  );
}

// ============================================================
// Consultas
// ============================================================
function ConsultasPublico() {
  const fn = useServerFn(listPricing);
  const q = useQuery({ queryKey: ["pricing"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");
  const [activeCat, setActiveCat] = useState<string>("todos");
  const [expandedDesc, setExpandedDesc] = useState<Set<string>>(new Set());

  const rows = (q.data ?? []) as any as PricingRow[];

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

  const toggleDesc = (key: string) =>
    setExpandedDesc((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

  return (
    <div>
      <FilterInput value={filter} onChange={setFilter} placeholder="Buscar especialidade…" />

      {categories.length > 1 && (
        <PillRow className="mb-3 ml-1 border-l border-border pl-3" role="group" aria-label="Categoria">
          <Pill active={activeCat === "todos"} onClick={() => setActiveCat("todos")}>Todas</Pill>
          {categories.map((c) => (
            <Pill key={c} active={activeCat === c} onClick={() => setActiveCat(c)}>{c}</Pill>
          ))}
        </PillRow>
      )}

      {!q.isLoading && rows.length > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          {filter.trim()
            ? `${grouped.reduce((n, g) => n + g.specialties.length, 0)} especialidade(s) encontrada(s)`
            : `${totalEspecialidades} especialidades`}
          {menorPreco != null && ` · a partir de ${fmt(menorPreco)}`}
          {maiorDesconto != null && ` · até ${maiorDesconto}% abaixo do particular`}
          {" · o particular costuma ser cerca de 3× o valor do cartão"}
        </p>
      )}

      {q.isLoading && <div className="grid gap-3"><SkeletonCard /><SkeletonCard /></div>}
      {!q.isLoading && rows.length === 0 && <EmptyBox title="Tabela de preços ainda não cadastrada." hint="Cadastre no Painel Admin → Tabela de Preços." />}
      {!q.isLoading && rows.length > 0 && grouped.length === 0 && <EmptyBox title="Nenhuma especialidade encontrada." hint="Tente outra palavra ou escolha outra categoria." />}

      <div className="space-y-4">
        {grouped.map(({ category, specialties }) => (
          <Panel key={category} title={category}>
            {specialties.map(({ specialty, variants }) => {
              const descKey = `${category}|${specialty}`;
              const desc = variants.find((v) => v.description)?.description;
              const isOpen = expandedDesc.has(descKey);
              const multi = variants.length > 1;

              const nameLine = (
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold">{specialty}</span>
                  {desc && (
                    <button type="button" aria-label={`O que é ${specialty}`} aria-expanded={isOpen}
                      onClick={() => toggleDesc(descKey)}
                      className="rounded text-muted-foreground transition-colors hover:text-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              );
              const descLine = desc && isOpen && <p className="mt-1 max-w-prose text-xs text-muted-foreground">{desc}</p>;

              const priceRow = (v: PricingRow, label: ReactNode) => {
                const eco = economia(v.cartao_price, v.particular_price);
                const copyText = `${specialty}${v.notes ? ` (${v.notes})` : ""}: ${fmt(v.cartao_price)} pelo Cartão de Todos. Valor particular: ${fmt(v.particular_price)}.`;
                const principais = (v.unidades ?? []).filter((l) => l.destaque && l.unidade).map((l) => l.unidade!.nome);
                const outras = (v.unidades ?? []).filter((l) => !l.destaque && l.unidade).map((l) => l.unidade!.nome);
                return (
                  <PanelRow key={v.id} className={multi ? "border-t-0 pt-1" : undefined}>
                    <div className="min-w-0 flex-1">
                      {label}
                      {!multi && v.notes && <p className="text-[12.5px] text-muted-foreground">{v.notes}</p>}
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        Particular {fmt(v.particular_price)}
                        {eco && eco.valor > 0 && <> · economia de {fmt(eco.valor)} ({eco.pct}%)</>}
                      </p>
                      <UnidadesLine principais={principais} outras={outras} />
                    </div>
                    <PriceTag value={v.cartao_price} />
                    <CopyButton text={copyText} size="icon" label={`Copiar preço de ${specialty}`} />
                  </PanelRow>
                );
              };

              if (!multi) {
                return priceRow(variants[0], <>{nameLine}{descLine}</>);
              }
              return (
                <div key={specialty} className="border-t border-border pb-1.5">
                  <div className="px-4 pt-2.5">{nameLine}{descLine}</div>
                  {variants.map((v) => priceRow(v, <p className="text-sm">{v.notes || "Variação"}</p>))}
                </div>
              );
            })}
          </Panel>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Exames
// ============================================================
function ExamesPublico() {
  const fn = useServerFn(listExames);
  const q = useQuery({ queryKey: ["exames"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");
  const [activeTipo, setActiveTipo] = useState<"todos" | "laboratorial" | "imagem">("todos");

  const rows = (q.data ?? []) as any as ExameRow[];
  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim();
    return rows.filter((r) => {
      if (activeTipo !== "todos" && r.tipo !== activeTipo) return false;
      if (!needle) return true;
      return r.nome.toLowerCase().includes(needle) || (r.categoria ?? "").toLowerCase().includes(needle) || (r.descricao ?? "").toLowerCase().includes(needle);
    });
  }, [rows, filter, activeTipo]);

  return (
    <div>
      <FilterInput value={filter} onChange={setFilter} placeholder="Buscar exame…" />
      <PillRow className="mb-4" role="group" aria-label="Tipo de exame">
        <Pill active={activeTipo === "todos"} onClick={() => setActiveTipo("todos")}>Todos</Pill>
        <Pill active={activeTipo === "laboratorial"} onClick={() => setActiveTipo("laboratorial")}>Laboratoriais</Pill>
        <Pill active={activeTipo === "imagem"} onClick={() => setActiveTipo("imagem")}>De imagem</Pill>
      </PillRow>

      {q.isLoading && <div className="grid gap-3"><SkeletonCard /><SkeletonCard /></div>}
      {!q.isLoading && rows.length === 0 && <EmptyBox title="Nenhum exame cadastrado ainda." />}
      {!q.isLoading && rows.length > 0 && filtered.length === 0 && <EmptyBox title="Nenhum exame encontrado." hint="Tente outra palavra ou outro tipo." />}

      {filtered.length > 0 && (
        <Panel title={`Exames · ${filtered.length}`}>
          {filtered.map((e) => {
            const unidades = (e.unidades ?? []).filter((l) => l.unidade).map((l) => l.unidade!.nome);
            const copyText = [
              `${e.nome}${e.categoria ? ` (${e.categoria})` : ""}`,
              `Jejum: ${e.jejum ? "sim" : "não"}.`,
              e.preparo ? `Preparo: ${e.preparo}` : null,
            ].filter(Boolean).join(" ");
            return (
              <PanelRow key={e.id} className="items-start py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold">{e.nome}</span>
                    <span className="rounded bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                      {e.tipo === "imagem" ? "Imagem" : "Laboratorial"}
                    </span>
                  </p>
                  {e.categoria && <p className="text-[12.5px] text-muted-foreground">{e.categoria}</p>}
                  {e.descricao && <p className="mt-1 max-w-prose text-sm">{e.descricao}</p>}
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    <span className="font-medium text-foreground">Jejum:</span> {e.jejum ? "sim" : "não"}
                    {e.material && <> · <span className="font-medium text-foreground">Material/método:</span> {e.material}</>}
                  </p>
                  {e.preparo && (
                    <p className="mt-0.5 flex items-start gap-1 text-[12.5px] text-warning">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e.preparo}
                    </p>
                  )}
                  {e.observacoes && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{e.observacoes}</p>}
                  <UnidadesLine principais={unidades} outras={[]} />
                </div>
                <CopyButton text={copyText} size="icon" label={`Copiar informações de ${e.nome}`} />
              </PanelRow>
            );
          })}
        </Panel>
      )}
    </div>
  );
}

// ============================================================
// Procedimentos Odontológicos
// ============================================================
function OdontologiaPublico() {
  const fn = useServerFn(listProcedimentos);
  const q = useQuery({ queryKey: ["procedimentos"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");

  const rows = (q.data ?? []) as any as ProcedimentoRow[];
  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim();
    if (!needle) return rows;
    return rows.filter((r) => r.nome.toLowerCase().includes(needle) || (r.categoria ?? "").toLowerCase().includes(needle) || (r.descricao ?? "").toLowerCase().includes(needle));
  }, [rows, filter]);

  return (
    <div>
      <FilterInput value={filter} onChange={setFilter} placeholder="Buscar procedimento…" />

      {q.isLoading && <div className="grid gap-3"><SkeletonCard /><SkeletonCard /></div>}
      {!q.isLoading && rows.length === 0 && <EmptyBox title="Nenhum procedimento cadastrado ainda." />}
      {!q.isLoading && rows.length > 0 && filtered.length === 0 && <EmptyBox title="Nenhum procedimento encontrado." hint="Tente outra palavra." />}

      {filtered.length > 0 && (
        <Panel title={`Procedimentos odontológicos · ${filtered.length}`}>
          {filtered.map((p) => {
            const unidades = (p.unidades ?? []).filter((l) => l.unidade).map((l) => l.unidade!.nome);
            const copyText = [
              `${p.nome}${p.categoria ? ` (${p.categoria})` : ""}.`,
              p.descricao,
              p.cuidados_pos ? `Cuidados depois do procedimento: ${p.cuidados_pos}` : null,
            ].filter(Boolean).join(" ");
            return (
              <PanelRow key={p.id} className="items-start py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.nome}</p>
                  {p.categoria && <p className="text-[12.5px] text-muted-foreground">{p.categoria}</p>}
                  {p.descricao && <p className="mt-1 max-w-prose text-sm">{p.descricao}</p>}
                  {p.cuidados_pos && (
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      <span className="font-medium text-foreground">Cuidados pós-procedimento:</span> {p.cuidados_pos}
                    </p>
                  )}
                  {p.observacoes && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{p.observacoes}</p>}
                  <UnidadesLine principais={unidades} outras={[]} />
                </div>
                <CopyButton text={copyText} size="icon" label={`Copiar informações de ${p.nome}`} />
              </PanelRow>
            );
          })}
        </Panel>
      )}
    </div>
  );
}
