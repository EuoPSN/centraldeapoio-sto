import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  clinicasDoItem, matches, reais, textoClinicas, textoProcedimento, useAmorSaude, useCountUse,
  type Clinica, type Procedimento,
} from "@/components/amor-saude/model";
import { useRegiao } from "@/components/amor-saude/store";
import {
  ColumnHeads, CopyAction, DetailSkeleton, EmptyState, ListRow, ListSkeleton, MaisProcuradas, OndeAtende,
  OrcamentoLink, Overline, SubpageHeader, TextBlock, ValorBloco, useScrollIntoView,
} from "@/components/amor-saude/ui";

type Search = { item?: string };

export const Route = createFileRoute("/_authenticated/amor-saude/odontologia")({
  validateSearch: (s: Record<string, unknown>): Search => ({ item: typeof s.item === "string" && s.item ? s.item : undefined }),
  component: OdontologiaPage,
});

function OdontologiaPage() {
  const { item } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { procedimentos, clinicas, regioes, avaliacaoOdonto, isLoading } = useAmorSaude();
  const regiao = useRegiao();
  const [query, setQuery] = useState("");

  // Mantém a ordem do Admin (Clínico Geral, a porta de entrada, vem primeiro).
  const list = useMemo(
    () => procedimentos.filter((p) => matches(query, p.nome, p.categoria, p.descricao)),
    [procedimentos, query],
  );
  const maisProcurados = useMemo(
    () => procedimentos.filter((p) => p.useCount > 0).sort((a, b) => b.useCount - a.useCount || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 5),
    [procedimentos],
  );
  const selected = procedimentos.find((p) => p.id === item) ?? list[0] ?? null;
  const select = (id: string) => navigate({ search: { item: id }, replace: true });
  const rowRef = useScrollIntoView(item, [list.length]);

  return (
    <>
      <SubpageHeader
        title="Odontologia"
        active="/amor-saude/odontologia"
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Buscar procedimento…"
        regioes={regioes}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(340px,460px)_minmax(0,1fr)] 2xl:grid-cols-[540px_minmax(0,1fr)]">
        <section aria-label="Procedimentos" className="min-h-0 border-line pb-4 md:overflow-y-auto md:border-r">
          <MaisProcuradas label="Mais procurados" itens={maisProcurados} onPick={select} />

          {isLoading ? (
            <ListSkeleton />
          ) : procedimentos.length === 0 ? (
            <EmptyState title="Nenhum procedimento cadastrado ainda." hint="Cadastre no Painel Admin → Tabela de Preços → Procedimentos Odontológicos." />
          ) : list.length === 0 ? (
            <EmptyState title="Nenhum procedimento encontrado." hint="Tente outra palavra." />
          ) : (
            <>
              <ColumnHeads>
                <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,150px)] gap-3"><span>Procedimento</span><span>Categoria</span></div>
              </ColumnHeads>
              <ul>
                {list.map((p) => (
                  <ListRow key={p.id} item={p} label={p.nome} selected={selected?.id === p.id} onSelect={() => select(p.id)} rowRef={rowRef(p.id)}>
                    <span className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,150px)] items-center gap-3">
                      <span className="truncate text-[15px] text-ink" title={p.nome}>{p.nome}</span>
                      <span className="truncate text-[13px] text-ink-muted" title={p.categoria ?? undefined}>{p.categoria ?? ""}</span>
                    </span>
                  </ListRow>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-label="Procedimento selecionado" className="min-h-0 border-t border-line md:overflow-y-auto md:border-t-0">
          {isLoading ? <DetailSkeleton /> : selected ? (
            <ProcedimentoDetail key={selected.id} p={selected} clinicas={clinicas} regiao={regiao} avaliacao={avaliacaoOdonto} />
          ) : null}
        </section>
      </div>
    </>
  );
}

function ProcedimentoDetail({ p, clinicas, regiao, avaliacao }: { p: Procedimento; clinicas: Clinica[]; regiao: string | null; avaliacao: number | null }) {
  const countUse = useCountUse();
  const ordenadas = useMemo(() => clinicasDoItem(p, clinicas, regiao), [p, clinicas, regiao]);
  const counted = () => countUse("odontologia", p.id);

  return (
    <article className="max-w-[720px] px-4 py-7 sm:px-8 lg:py-8">
      <Overline>{["Odontologia", p.categoria].filter(Boolean).join(" · ")}</Overline>
      <h2 className="mt-1.5 text-[26px] font-semibold leading-8 text-ink">{p.nome}</h2>
      {p.descricao && <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-ink-muted">{p.descricao}</p>}

      <ValorBloco
        principal={{ label: "Valor", value: "Valor após avaliação" }}
        secundario={avaliacao != null ? { label: "Avaliação odontológica pelo Cartão de TODOS", value: reais(avaliacao) } : null}
      />

      <TextBlock titulo="Cuidados depois do procedimento">{p.cuidadosPos}</TextBlock>
      <OndeAtende titulo="Onde faz · perto do cliente primeiro" ordenadas={ordenadas} />
      {!ordenadas.length && <p className="mt-6 text-sm text-ink-muted">Nenhuma clínica marcada para este procedimento ainda.</p>}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <CopyAction variant="gold" text={textoProcedimento(p, ordenadas, regiao, avaliacao)} onCopied={counted}>Copiar sobre o procedimento</CopyAction>
        {ordenadas.length > 0 && <CopyAction text={textoClinicas(p.nome, ordenadas)} onCopied={counted}>Copiar clínicas</CopyAction>}
        <OrcamentoLink item={p} />
      </div>
    </article>
  );
}
