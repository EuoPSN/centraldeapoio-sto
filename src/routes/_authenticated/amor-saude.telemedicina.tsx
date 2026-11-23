import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  matches, nomeModalidade, reais, textoPassosTelemedicina, textoTelemedicina, useAmorSaude, useCountUse,
  type Modalidade, type Telemedicina,
} from "@/components/amor-saude/model";
import {
  ColumnHeads, CopyAction, DetailSkeleton, EmptyState, ListRow, ListSkeleton, MaisProcuradas, OrcamentoLink, Overline,
  SubpageHeader, useScrollIntoView,
} from "@/components/amor-saude/ui";
import { cn } from "@/lib/utils";

type Search = { item?: string; tipo?: Modalidade };

export const Route = createFileRoute("/_authenticated/amor-saude/telemedicina")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    item: typeof s.item === "string" && s.item ? s.item : undefined,
    tipo: s.tipo === "pa_digital" ? "pa_digital" : s.tipo === "teleconsulta" ? "teleconsulta" : undefined,
  }),
  component: TelemedicinaPage,
});

function TelemedicinaPage() {
  const { item, tipo: tipoUrl } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { telemedicina, siteUrl, regioes, isLoading } = useAmorSaude();
  const [query, setQuery] = useState("");

  const doTipo = (m: Modalidade) => telemedicina.filter((t) => t.modalidade === m);
  // Link direto (?item=) abre na aba do próprio item.
  const doItem = telemedicina.find((t) => t.id === item);
  const tipo: Modalidade = doItem?.modalidade ?? tipoUrl ?? "teleconsulta";
  const todos = doTipo(tipo);
  const minPA = Math.min(...doTipo("pa_digital").map((t) => t.tempoEsperaMin ?? 15), 15);
  const esperaPA = doTipo("pa_digital").length ? Math.max(...doTipo("pa_digital").map((t) => t.tempoEsperaMin ?? 15)) : minPA;

  const list = useMemo(
    () => todos.filter((t) => matches(query, t.nome, t.descricao, t.paraQuem)).sort((a, b) => a.position - b.position || a.nome.localeCompare(b.nome, "pt-BR")),
    [todos, query],
  );
  const maisProcurados = useMemo(
    () => todos.filter((t) => t.useCount > 0).sort((a, b) => b.useCount - a.useCount || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 5),
    [todos],
  );
  const selected = list.find((t) => t.id === item) ?? list[0] ?? null;
  const select = (id: string) => navigate({ search: { item: id, tipo }, replace: true });
  const trocar = (m: Modalidade) => { setQuery(""); navigate({ search: { tipo: m }, replace: true }); };
  const rowRef = useScrollIntoView(item, [list.length]);

  return (
    <>
      <SubpageHeader
        title="Teleconsulta e PA digital"
        active="/amor-saude/telemedicina"
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Buscar especialidade…"
        regioes={regioes}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(340px,460px)_minmax(0,1fr)] 2xl:grid-cols-[540px_minmax(0,1fr)]">
        <section aria-label="Especialidades por vídeo" data-tour="telemedicina-2" className="min-h-0 border-line pb-4 md:overflow-y-auto md:border-r">
          <div role="group" aria-label="Tipo de atendimento" data-tour="telemedicina-1" className="mx-4 mt-4 inline-flex overflow-hidden rounded-lg border border-line-strong sm:mx-5">
            {([
              ["teleconsulta", "Teleconsulta · agendada"],
              ["pa_digital", `PA digital · até ${esperaPA} min`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={tipo === id}
                onClick={() => trocar(id)}
                className={cn(
                  "h-10 px-4 text-[14.5px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  tipo === id ? "bg-ink font-semibold text-surface" : "text-ink-muted hover:bg-surface-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <MaisProcuradas label="Mais procuradas" itens={maisProcurados} onPick={select} />

          {isLoading ? (
            <ListSkeleton />
          ) : todos.length === 0 ? (
            <EmptyState
              title={tipo === "teleconsulta" ? "Nenhuma teleconsulta cadastrada ainda." : "Nenhum PA digital cadastrado ainda."}
              hint="Cadastre no Painel Admin → Amor Saúde → Teleconsulta e PA."
            />
          ) : list.length === 0 ? (
            <EmptyState title="Nenhuma especialidade encontrada." hint="Tente outra palavra." />
          ) : (
            <>
              <p className="px-5 pt-3 text-[13px] text-ink-muted">
                {tipo === "pa_digital"
                  ? "Atendimento agora, sem escolher horário"
                  : `${todos.length} ${todos.length === 1 ? "especialidade" : "especialidades"} por vídeo${list.length !== todos.length ? ` · mostrando ${list.length}` : ""}`}
              </p>
              <ColumnHeads>
                <div className="grid w-full grid-cols-[minmax(0,1fr)_96px] gap-3"><span>Especialidade</span><span>{tipo === "pa_digital" ? "Espera" : "Tipo"}</span></div>
              </ColumnHeads>
              <ul>
                {list.map((t) => (
                  <ListRow key={t.id} item={t} label={t.nome} selected={selected?.id === t.id} onSelect={() => select(t.id)} rowRef={rowRef(t.id)}>
                    <span className="grid w-full grid-cols-[minmax(0,1fr)_96px] items-center gap-3">
                      <span className="truncate text-[15px] text-ink" title={t.nome}>{t.nome}</span>
                      <span className="text-[13px] text-ink-muted">{t.modalidade === "pa_digital" ? `até ${t.tempoEsperaMin ?? 15} min` : "agendada"}</span>
                    </span>
                  </ListRow>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-label="Especialidade selecionada" data-tour="telemedicina-3" className="min-h-0 border-t border-line md:overflow-y-auto md:border-t-0">
          {isLoading ? <DetailSkeleton /> : selected ? <TelemedicinaDetail key={selected.id} t={selected} siteUrl={siteUrl} /> : null}
        </section>
      </div>
    </>
  );
}

function TelemedicinaDetail({ t, siteUrl }: { t: Telemedicina; siteUrl: string | null }) {
  const countUse = useCountUse();
  const counted = () => countUse("telemedicina", t.id);
  const pa = t.modalidade === "pa_digital";
  const link = t.linkAgendamento ?? siteUrl;
  const passos = textoPassosTelemedicina(t);

  return (
    <article className="max-w-[720px] px-4 py-7 sm:px-8 lg:py-8">
      <Overline>{pa ? "PA digital · pronto atendimento" : "Teleconsulta · por agendamento"}</Overline>
      <h2 className="mt-1.5 text-[26px] font-semibold leading-8 text-ink">{t.nome}</h2>
      {t.descricao && <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-ink-muted">{t.descricao}</p>}
      {t.paraQuem && <p className="mt-1 max-w-[68ch] text-[15px] leading-6 text-ink-muted">{t.paraQuem}</p>}

      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3 rounded-xl bg-surface-2 px-5 py-4">
        <div>
          <Overline className="text-[11.5px]">Cartão de TODOS</Overline>
          <p className={cn("mt-0.5 font-semibold leading-8 tabular-nums", t.cartao != null ? "text-[21px] text-gold-text" : "text-[17px] text-ink")}>
            {t.cartao != null ? reais(t.cartao) : "Consulte o valor"}
          </p>
        </div>
        {t.particular != null && (
          <div>
            <Overline className="text-[11.5px]">Particular</Overline>
            <p className="mt-0.5 text-[17px] font-medium leading-8 tabular-nums text-ink-muted line-through">{reais(t.particular)}</p>
          </div>
        )}
        {pa && t.tempoEsperaMin != null && <p className="pb-1 text-[13px] leading-[18px] text-ink-muted">Atendimento em até {t.tempoEsperaMin} min</p>}
      </div>

      {t.passos.length > 0 && (
        <section className="mt-6">
          <Overline>Como o cliente usa</Overline>
          <ol className="mt-2 divide-y divide-line border-b border-line">
            {t.passos.map((p, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink">{i + 1}</span>
                <span className="text-[15px] leading-6 text-ink">{p}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {t.indiqueQuando && (
        <section className="mt-6">
          <Overline>Indique quando</Overline>
          <p className="mt-1.5 max-w-[68ch] text-[15px] leading-6 text-ink">{t.indiqueQuando}</p>
        </section>
      )}

      <div data-tour="telemedicina-4" className="mt-7 flex flex-wrap items-center gap-3">
        <CopyAction variant="gold" text={textoTelemedicina(t)} onCopied={counted}>Copiar sobre {pa ? "o PA digital" : "a teleconsulta"}</CopyAction>
        {passos && <CopyAction text={passos} onCopied={counted}>Copiar passo a passo</CopyAction>}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg px-2 text-[15px] font-semibold text-gold-text transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Abrir o site da Amor Saúde
          </a>
        )}
        <OrcamentoLink item={t} />
      </div>
      {!link && <p className="mt-3 text-[13px] text-ink-muted">O link do site da Amor Saúde ainda não foi cadastrado (Painel Admin → Amor Saúde → Teleconsulta e PA).</p>}
      <p className="sr-only">{nomeModalidade(t.modalidade)}</p>
    </article>
  );
}
