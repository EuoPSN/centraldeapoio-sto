import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  clinicasDoItem, economia, matches, reais, textoClinicas, textoConsulta, useAmorSaude, useCountUse,
  type Clinica, type Consulta,
} from "@/components/amor-saude/model";
import { useRegiao } from "@/components/amor-saude/store";
import { TodasEspecialidadesButton } from "@/components/amor-saude/TodasEspecialidades";
import {
  ColumnHeads, CopyAction, DetailSkeleton, EmptyState, ListRow, ListSkeleton, MaisProcuradas, OndeAtende,
  OrcamentoLink, Overline, SubpageHeader, TextBlock, useScrollIntoView,
} from "@/components/amor-saude/ui";
import { cn } from "@/lib/utils";

type Search = { item?: string };

export const Route = createFileRoute("/_authenticated/amor-saude/consultas")({
  validateSearch: (s: Record<string, unknown>): Search => ({ item: typeof s.item === "string" && s.item ? s.item : undefined }),
  component: ConsultasPage,
});

const COLS = "grid-cols-[minmax(0,1fr)_84px_86px_36px]";

function ConsultasPage() {
  const { item } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { consultas, clinicas, regioes, isLoading } = useAmorSaude();
  const regiao = useRegiao();
  const [query, setQuery] = useState("");

  const list = useMemo(
    () => consultas
      .filter((c) => matches(query, c.nome, c.descricao, c.area, c.paraQuem, c.notes))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [consultas, query],
  );
  const maisProcuradas = useMemo(
    () => consultas.filter((c) => c.useCount > 0).sort((a, b) => b.useCount - a.useCount || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 5),
    [consultas],
  );
  const selected = consultas.find((c) => c.id === item) ?? list[0] ?? null;
  const select = (id: string) => navigate({ search: { item: id }, replace: true });
  const rowRef = useScrollIntoView(item, [list.length]);

  return (
    <>
      <SubpageHeader
        title="Consultas"
        active="/amor-saude/consultas"
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Buscar especialidade…"
        regioes={regioes}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(380px,480px)_minmax(0,1fr)] 2xl:grid-cols-[580px_minmax(0,1fr)]">
        <section aria-label="Especialidades" className="min-h-0 border-line pb-4 md:overflow-y-auto md:border-r">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5">
            <TodasEspecialidadesButton consultas={consultas} />
            <p className="text-[13px] leading-5 text-ink-muted">O particular custa cerca de 3× o valor do Cartão de TODOS.</p>
          </div>
          <MaisProcuradas label="Mais procuradas" itens={maisProcuradas} onPick={select} />

          {isLoading ? (
            <ListSkeleton />
          ) : consultas.length === 0 ? (
            <EmptyState title="Nenhuma especialidade cadastrada ainda." hint="Cadastre no Painel Admin → Tabela de Preços → Consultas." />
          ) : list.length === 0 ? (
            <EmptyState title="Nenhuma especialidade encontrada." hint="Tente outra palavra." />
          ) : (
            <>
              <ColumnHeads>
                <div className={cn("grid w-full gap-3", COLS)}>
                  <span>Especialidade</span><span>Cartão</span><span>Particular</span><span />
                </div>
              </ColumnHeads>
              <ul>
                {list.map((c) => (
                  <ConsultaRow key={c.id} c={c} selected={selected?.id === c.id} onSelect={() => select(c.id)} rowRef={rowRef(c.id)} />
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-label="Especialidade selecionada" className="min-h-0 border-t border-line md:overflow-y-auto md:border-t-0">
          {isLoading ? <DetailSkeleton /> : selected ? <ConsultaDetail key={selected.id} c={selected} clinicas={clinicas} regiao={regiao} /> : null}
        </section>
      </div>
    </>
  );
}

function ConsultaRow({ c, selected, onSelect, rowRef }: { c: Consulta; selected: boolean; onSelect: () => void; rowRef: (el: HTMLLIElement | null) => void }) {
  const eco = economia(c);
  return (
    <ListRow item={c} label={c.nome} selected={selected} onSelect={onSelect} rowRef={rowRef}>
      <span className={cn("grid w-full items-center gap-3 whitespace-nowrap tabular-nums", COLS)}>
        <span className="truncate text-[15px] text-ink" title={c.nome}>{c.nome}</span>
        <span className="text-[15px] font-semibold text-gold-text">{c.cartao != null ? reais(c.cartao) : "—"}</span>
        <span className="text-[14px] text-ink-muted">{c.particular != null ? <s>{reais(c.particular)}</s> : "—"}</span>
        <span className="text-[13px] text-ink-muted">{eco ? `−${eco.pct}%` : ""}</span>
      </span>
    </ListRow>
  );
}

function ConsultaDetail({ c, clinicas, regiao }: { c: Consulta; clinicas: Clinica[]; regiao: string | null }) {
  const countUse = useCountUse();
  const ordenadas = useMemo(() => clinicasDoItem(c, clinicas, regiao), [c, clinicas, regiao]);
  const eco = economia(c);
  const counted = () => countUse("consulta", c.id);

  return (
    <article className="max-w-[720px] px-4 py-7 sm:px-8 lg:py-8">
      <Overline>Consulta</Overline>
      <h2 className="mt-1.5 text-[26px] font-semibold leading-8 text-ink">{c.nome}</h2>
      {c.descricao && <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-ink-muted">{c.descricao}</p>}
      {c.notes && <p className="mt-1.5 text-sm leading-[22px] text-ink"><span className="font-semibold">Observação:</span> {c.notes}</p>}

      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3 rounded-xl bg-surface-2 px-5 py-4">
        <div>
          <Overline className="text-[11.5px]">Cartão de TODOS</Overline>
          <p className="mt-0.5 text-[30px] font-semibold leading-9 tabular-nums text-gold-text">{c.cartao != null ? reais(c.cartao) : "Consulte a clínica"}</p>
        </div>
        {c.particular != null && (
          <div className="pb-0.5">
            <Overline className="text-[11.5px]">Particular</Overline>
            <p className="mt-0.5 text-lg font-medium leading-7 tabular-nums text-ink-muted"><s>{reais(c.particular)}</s></p>
          </div>
        )}
        {eco && (
          <p className="ml-auto pb-1 text-[15px] font-semibold tabular-nums text-ink">
            Economia de {reais(eco.valor)} · {eco.pct}%
          </p>
        )}
      </div>

      <TextBlock titulo="Para quem indicar">{c.paraQuem}</TextBlock>
      <OndeAtende titulo="Onde atende · perto do cliente primeiro" ordenadas={ordenadas} />
      {!ordenadas.length && (
        <p className="mt-6 text-sm text-ink-muted">Nenhuma clínica marcada para esta especialidade ainda.</p>
      )}
      <TextBlock titulo="Como agendar">{c.comoAgendar}</TextBlock>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <CopyAction variant="gold" text={textoConsulta(c, ordenadas, regiao)} onCopied={counted}>Copiar sobre a especialidade</CopyAction>
        {ordenadas.length > 0 && (
          <CopyAction text={textoClinicas(c.nome, ordenadas)} onCopied={counted}>Copiar clínicas próximas</CopyAction>
        )}
        <OrcamentoLink item={c} />
      </div>
    </article>
  );
}
