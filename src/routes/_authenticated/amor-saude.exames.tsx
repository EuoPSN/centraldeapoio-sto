import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  clinicasDoItem, matches, reais, textoClinicas, textoExame, textoPreparo, tipoExameLabel, useAmorSaude, useCountUse,
  type Clinica, type Exame,
} from "@/components/amor-saude/model";
import { useRegiao } from "@/components/amor-saude/store";
import {
  ColumnHeads, CopyAction, DetailSkeleton, EmptyState, ListRow, ListSkeleton, MaisProcuradas, OndeAtende,
  OrcamentoLink, Overline, SubpageHeader, ValorBloco, useScrollIntoView,
} from "@/components/amor-saude/ui";
import { cn } from "@/lib/utils";

type Search = { item?: string };

export const Route = createFileRoute("/_authenticated/amor-saude/exames")({
  validateSearch: (s: Record<string, unknown>): Search => ({ item: typeof s.item === "string" && s.item ? s.item : undefined }),
  component: ExamesPage,
});

type Filtro = "todos" | Exame["kind"];
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "laboratorial", label: "Laboratoriais" },
  { id: "imagem", label: "De imagem" },
];

function ExamesPage() {
  const { item } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { exames, clinicas, regioes, isLoading } = useAmorSaude();
  const regiao = useRegiao();
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const list = useMemo(
    () => exames
      .filter((e) => filtro === "todos" || e.kind === filtro)
      .filter((e) => matches(query, e.nome, e.categoria, e.descricao))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [exames, query, filtro],
  );
  const maisProcurados = useMemo(
    () => exames.filter((e) => e.useCount > 0).sort((a, b) => b.useCount - a.useCount || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 5),
    [exames],
  );
  const selected = exames.find((e) => e.id === item) ?? list[0] ?? null;
  const select = (id: string) => navigate({ search: { item: id }, replace: true });
  const rowRef = useScrollIntoView(item, [list.length]);

  return (
    <>
      <SubpageHeader
        title="Exames"
        active="/amor-saude/exames"
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Buscar exame…"
        regioes={regioes}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(340px,460px)_minmax(0,1fr)] 2xl:grid-cols-[540px_minmax(0,1fr)]">
        <section aria-label="Exames" className="min-h-0 border-line pb-4 md:overflow-y-auto md:border-r">
          <div role="group" aria-label="Tipo de exame" className="flex flex-wrap gap-1.5 px-4 pt-4 sm:px-5">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={cn(
                  "h-8 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  filtro === f.id ? "border-ink bg-ink text-surface" : "border-line-strong text-ink hover:bg-surface-2",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <MaisProcuradas label="Mais procurados" itens={maisProcurados} onPick={select} />

          {isLoading ? (
            <ListSkeleton />
          ) : exames.length === 0 ? (
            <EmptyState title="Nenhum exame cadastrado ainda." hint="Cadastre no Painel Admin → Tabela de Preços → Exames." />
          ) : list.length === 0 ? (
            <EmptyState title="Nenhum exame encontrado." hint="Tente outra palavra ou outro tipo." />
          ) : (
            <>
              <ColumnHeads>
                <div className="grid w-full grid-cols-[minmax(0,1fr)_96px] gap-3"><span>Exame</span><span>Tipo</span></div>
              </ColumnHeads>
              <ul>
                {list.map((e) => (
                  <ListRow key={e.id} item={e} label={e.nome} selected={selected?.id === e.id} onSelect={() => select(e.id)} rowRef={rowRef(e.id)}>
                    <span className="grid w-full grid-cols-[minmax(0,1fr)_96px] items-center gap-3">
                      <span className="truncate text-[15px] text-ink" title={e.nome}>{e.nome}</span>
                      <span className="text-[13px] text-ink-muted">{tipoExameLabel(e.kind)}</span>
                    </span>
                  </ListRow>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-label="Exame selecionado" className="min-h-0 border-t border-line md:overflow-y-auto md:border-t-0">
          {isLoading ? <DetailSkeleton /> : selected ? <ExameDetail key={selected.id} e={selected} clinicas={clinicas} regiao={regiao} /> : null}
        </section>
      </div>
    </>
  );
}

function ExameDetail({ e, clinicas, regiao }: { e: Exame; clinicas: Clinica[]; regiao: string | null }) {
  const countUse = useCountUse();
  const ordenadas = useMemo(() => clinicasDoItem(e, clinicas, regiao), [e, clinicas, regiao]);
  const counted = () => countUse("exame", e.id);
  const overline = [e.kind === "imagem" ? "Exame de imagem" : "Exame laboratorial", e.categoria].filter(Boolean).join(" · ");

  return (
    <article className="max-w-[720px] px-4 py-7 sm:px-8 lg:py-8">
      <Overline>{overline}</Overline>
      <h2 className="mt-1.5 text-[26px] font-semibold leading-8 text-ink">{e.nome}</h2>
      {e.descricao && <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-ink-muted">{e.descricao}</p>}

      <ValorBloco
        principal={{ label: "Valor", value: "Consulte a clínica" }}
        secundario={e.media != null ? { label: "Média de referência", value: reais(e.media) } : null}
        nota="Varia conforme o pedido médico"
      />

      {e.preparo.length > 0 && (
        <section className="mt-6">
          <Overline>Preparo</Overline>
          <ul className="mt-2 space-y-2">
            {e.preparo.map((p, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-6 text-ink">
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <OndeAtende titulo="Onde faz · perto do cliente primeiro" ordenadas={ordenadas} />
      {!ordenadas.length && <p className="mt-6 text-sm text-ink-muted">Nenhuma clínica marcada para este exame ainda.</p>}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <CopyAction variant="gold" text={textoExame(e, ordenadas, regiao)} onCopied={counted}>Copiar sobre o exame</CopyAction>
        {e.preparo.length > 0 && <CopyAction text={textoPreparo(e)} onCopied={counted}>Copiar preparo</CopyAction>}
        {ordenadas.length > 0 && <CopyAction text={textoClinicas(e.nome, ordenadas)} onCopied={counted}>Copiar clínicas</CopyAction>}
        <OrcamentoLink item={e} />
      </div>
    </article>
  );
}
