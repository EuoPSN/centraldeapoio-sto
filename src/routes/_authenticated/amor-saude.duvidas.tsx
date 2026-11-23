import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { TopbarBreadcrumb, SkeletonLine } from "@/components/scripts/shared";
import { CopyAction } from "@/components/amor-saude/ui";
import { matches } from "@/components/amor-saude/model";
import { useCountDuvidaCopy, useDuvidasPublicadas, type Duvida } from "@/components/amor-saude/useDuvidas";
import { cn } from "@/lib/utils";

type Search = { duvida?: string };

export const Route = createFileRoute("/_authenticated/amor-saude/duvidas")({
  validateSearch: (s: Record<string, unknown>): Search => ({ duvida: typeof s.duvida === "string" && s.duvida ? s.duvida : undefined }),
  component: DuvidasPage,
});

function DuvidasPage() {
  const { duvida } = Route.useSearch();
  const { duvidas, isLoading } = useDuvidasPublicadas();
  const [query, setQuery] = useState("");
  const [tema, setTema] = useState<string>("Todas");
  // Só uma aberta por vez. Começa pela que veio de link ou da busca (?duvida=).
  const [aberta, setAberta] = useState<string | null>(duvida ?? null);

  const temas = useMemo(() => {
    const vistos = new Set<string>();
    duvidas.forEach((d) => vistos.add(d.tema));
    return ["Todas", ...vistos];
  }, [duvidas]);
  const lista = useMemo(
    () => duvidas.filter((d) => (tema === "Todas" || d.tema === tema) && matches(query, d.pergunta, d.resposta, d.tema)),
    [duvidas, tema, query],
  );

  return (
    <div className="min-h-0 flex-1 md:overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 sm:px-7 lg:pt-8">
        <TopbarBreadcrumb items={[{ label: "Amor Saúde", to: "/amor-saude" }, { label: "Dúvidas frequentes" }]} />

        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <h1 className="text-2xl font-medium leading-8 text-ink">Dúvidas frequentes</h1>
          <label data-tour="duvidas-1" className="flex h-9 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 focus-within:border-gold sm:w-[300px]">
            <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">Buscar dúvida</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar dúvida…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
        </div>

        <div data-tour="duvidas-2" role="group" aria-label="Tema" className="mt-4 flex flex-wrap gap-1.5">
          {temas.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tema === t}
              onClick={() => setTema(t)}
              className={cn(
                "h-8 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                tema === t ? "border-ink bg-ink text-surface" : "border-line-strong text-ink hover:bg-surface-2",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4 max-w-[860px]">
          {isLoading ? (
            <div className="space-y-4 py-4">{Array.from({ length: 5 }, (_, i) => <SkeletonLine key={i} className="h-5 w-full" />)}</div>
          ) : duvidas.length === 0 ? (
            <p className="py-8 text-[15px] text-ink-muted">Ainda não há dúvidas publicadas. Quando o Paulo publicar, elas aparecem aqui.</p>
          ) : lista.length === 0 ? (
            <p className="py-8 text-[15px] text-ink-muted">Nenhuma dúvida encontrada. Tente outra palavra ou outro tema.</p>
          ) : (
            <ul data-tour="duvidas-3" className="divide-y divide-line border-y border-line">
              {lista.map((d) => (
                <Item key={d.id} d={d} aberta={aberta === d.id} onToggle={() => setAberta(aberta === d.id ? null : d.id)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({ d, aberta, onToggle }: { d: Duvida; aberta: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const contar = useCountDuvidaCopy();
  const idResposta = `duvida-${d.id}`;
  return (
    <li>
      <h2>
        <button
          type="button"
          aria-expanded={aberta}
          aria-controls={idResposta}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center justify-between gap-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <span className="text-[17px] font-medium leading-6 text-ink">{d.pergunta}</span>
          <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {d.tema}
            {aberta ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
          </span>
        </button>
      </h2>
      {aberta && (
        <div id={idResposta} className="pb-5">
          <p className="max-w-[72ch] whitespace-pre-line text-[15px] leading-6 text-ink-muted">{d.resposta}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <CopyAction variant="gold" text={d.resposta} onCopied={() => contar(d.id)}>Copiar resposta</CopyAction>
            <button
              type="button"
              onClick={() => navigate({ to: "/assistente", search: { pergunta: d.pergunta } })}
              className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface px-[18px] text-[15px] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Perguntar à MarcIAna
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
