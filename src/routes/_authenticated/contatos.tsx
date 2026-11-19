import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { Pill, PillRow } from "@/components/Pill";
import { TopbarBreadcrumb, SkeletonLine } from "@/components/scripts/shared";
import {
  buildResultado, contatoRapido, flatten, formatAtualizado, subtituloLinha, telefonePrincipal,
  textoSoEndereco, textoSuporte, textoUnidade, useContatos, useCountContatoUse,
  type Contato, type Filtro,
} from "@/components/contatos/model";
import { cn } from "@/lib/utils";

type Search = { item?: string };

export const Route = createFileRoute("/_authenticated/contatos")({
  validateSearch: (s: Record<string, unknown>): Search => ({ item: typeof s.item === "string" && s.item ? s.item : undefined }),
  component: ContatosPage,
});

function ContatosPage() {
  const { item } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { contatos, isLoading } = useContatos();
  const countUse = useCountContatoUse();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [query, setQuery] = useState("");

  const unidades = useMemo(() => contatos.filter((c) => c.tipo === "unidade"), [contatos]);
  const suportes = useMemo(() => contatos.filter((c) => c.tipo === "suporte"), [contatos]);
  const resultado = useMemo(() => buildResultado(contatos, filtro, query), [contatos, filtro, query]);
  const visiveis = useMemo(() => flatten(resultado), [resultado]);
  const selected = visiveis.find((c) => c.id === item) ?? visiveis[0] ?? null;
  const select = (id: string) => navigate({ search: { item: id }, replace: true });

  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 lg:py-7">
      <TopbarBreadcrumb items={[{ label: "Atendimento" }, { label: "Contatos e Endereços" }]} />

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-2xl font-medium text-ink">Contatos e Endereços</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Unidades para o cliente ir e suportes para ele resolver.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <PillRow role="group" aria-label="Filtro">
          <Pill active={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos {contatos.length}</Pill>
          <Pill active={filtro === "unidade"} onClick={() => setFiltro("unidade")}>Unidades CDT {unidades.length}</Pill>
          <Pill active={filtro === "suporte"} onClick={() => setFiltro("suporte")}>Suporte e setores {suportes.length}</Pill>
        </PillRow>
        <label className="flex h-9 w-full max-w-[360px] items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 focus-within:border-gold">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
          <span className="sr-only">Buscar cidade, bairro ou suporte</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cidade, bairro ou suporte…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[minmax(420px,600px)_minmax(0,1fr)]">
        <section aria-label="Contatos">
          {isLoading ? (
            <div className="space-y-5 py-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex gap-3"><SkeletonLine className="h-4 w-40" /><SkeletonLine className="ml-auto h-4 w-20" /></div>)}</div>
          ) : resultado.kind === "vazio" ? (
            <div className="rounded-xl border border-line bg-surface px-5 py-6">
              <p className="text-[15px] text-ink">Nada encontrado para <span className="font-semibold">{resultado.termo}</span>.</p>
              <button type="button" onClick={() => setQuery("")} className="mt-2 text-sm font-medium text-gold-text underline-offset-4 hover:underline">
                Limpar busca
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {resultado.kind === "sem-unidade" && (
                <div className="rounded-xl border border-line bg-surface px-5 py-4">
                  <p className="text-[15px] text-ink">Não há unidade em <span className="font-semibold">{resultado.termo}</span>.</p>
                  <p className="mt-0.5 text-sm text-ink-muted">Mais próximas, segundo o cadastro:</p>
                </div>
              )}

              {resultado.kind === "sem-unidade" && (
                <ul>
                  {resultado.itens.map((c) => (
                    <ContatoRow
                      key={c.id}
                      c={c}
                      selected={selected?.id === c.id}
                      onSelect={() => select(c.id)}
                      onCopied={() => countUse(c.id)}
                      subtitleOverride={`Atende também ${resultado.termo}`}
                      rowRef={(el) => (el ? rowRefs.current.set(c.id, el) : rowRefs.current.delete(c.id))}
                    />
                  ))}
                </ul>
              )}

              {resultado.kind === "grupos" && resultado.grupos.map((g) => (
                <section key={g.label} aria-label={g.label}>
                  <p className="px-1 text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">
                    {g.label}{g.showCount && <> · {g.itens.length}</>}
                  </p>
                  <ul className="mt-1.5">
                    {g.itens.map((c) => (
                      <ContatoRow
                        key={c.id}
                        c={c}
                        selected={selected?.id === c.id}
                        onSelect={() => select(c.id)}
                        onCopied={() => countUse(c.id)}
                        rowRef={(el) => (el ? rowRefs.current.set(c.id, el) : rowRefs.current.delete(c.id))}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Contato selecionado" className="min-w-0">
          {!isLoading && selected && <ContatoDetail key={selected.id} c={selected} onCopied={() => countUse(selected.id)} />}
        </section>
      </div>
    </div>
  );
}

function ContatoRow({
  c, selected, onSelect, onCopied, subtitleOverride, rowRef,
}: {
  c: Contato;
  selected: boolean;
  onSelect: () => void;
  onCopied: () => void;
  subtitleOverride?: string;
  rowRef?: (el: HTMLLIElement | null) => void;
}) {
  const telefone = telefonePrincipal(c);
  const texto = c.tipo === "unidade" ? textoUnidade(c) : textoSuporte(c);
  return (
    <li
      ref={rowRef}
      className={cn(
        "relative flex h-[50px] items-center gap-3 pr-2 transition-colors",
        selected ? "bg-sidebar before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-gold" : "hover:bg-sidebar/60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="flex h-full min-w-0 flex-1 flex-col justify-center pl-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="truncate text-[14.5px] font-semibold leading-5 text-ink">{c.nome}</span>
        <span className="truncate text-[12.5px] leading-4 text-ink-muted">{subtitleOverride ?? subtituloLinha(c)}</span>
      </button>
      {telefone && <span className="hidden shrink-0 tabular-nums text-[13.5px] text-ink-muted sm:inline">{telefone}</span>}
      <CopyButton text={texto} onCopy={onCopied} />
    </li>
  );
}

function CampoLinha({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className="flex items-start gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="w-[108px] shrink-0 pt-0.5 text-xs font-semibold uppercase leading-4 tracking-[0.1em] text-ink-muted">{label}</span>
      <div className="min-w-0 flex-1 text-[14.5px] leading-[22px] text-ink">{children}</div>
    </div>
  );
}

function ContatoDetail({ c, onCopied }: { c: Contato; onCopied: () => void }) {
  const unidade = c.tipo === "unidade";
  const texto = unidade ? textoUnidade(c) : textoSuporte(c);
  const atualizado = formatAtualizado(c.updatedAt);
  const rapido = contatoRapido(c);

  return (
    <article className="rounded-xl border border-line bg-surface px-5 py-5 sm:px-7 sm:py-6">
      <p className="text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">{unidade ? "Unidade Cartão de TODOS" : "Suporte"}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <h2 className="text-[24px] font-semibold leading-8 text-ink">{c.nome}</h2>
        {c.destaque && unidade && (
          <span className="inline-flex h-5 items-center rounded-full bg-gold px-2 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-on-gold">
            Principal
          </span>
        )}
      </div>
      {subtituloLinha(c) && <p className="mt-0.5 text-[14.5px] text-ink-muted">{subtituloLinha(c)}</p>}

      <div className="mt-4">
        {unidade ? (
          <>
            <CampoLinha label="Endereço">{c.endereco ? `${c.endereco}${c.numero ? `, nº ${c.numero}` : ""}${c.bairro ? ` – ${c.bairro}` : ""}` : null}</CampoLinha>
            <CampoLinha label="Referência">{c.pontoReferencia}</CampoLinha>
            <CampoLinha label="Horário">{c.horario}</CampoLinha>
            <CampoLinha label="Telefones">{c.telefones.length > 0 ? c.telefones.join(" · ") : null}</CampoLinha>
            <CampoLinha label="Maps">
              {c.mapsUrl && (
                <a href={c.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-gold-text hover:underline">
                  Abrir rota no Google Maps <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </a>
              )}
            </CampoLinha>
            <CampoLinha label="Atende também">
              {c.atendeTambem.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.atendeTambem.map((t) => (
                    <span key={t} className="rounded-full border border-line-strong px-2.5 py-0.5 text-[13px] leading-5 text-ink">{t}</span>
                  ))}
                </div>
              )}
            </CampoLinha>
          </>
        ) : (
          <>
            <CampoLinha label="Quando indicar">{c.quandoIndicar}</CampoLinha>
            <CampoLinha label="WhatsApp">{c.whatsapp}</CampoLinha>
            <CampoLinha label="Telefones">{c.telefones.length > 0 ? c.telefones.join(" · ") : null}</CampoLinha>
            <CampoLinha label="E-mail">{c.email}</CampoLinha>
            <CampoLinha label="Site">
              {c.site && (
                <a href={/^https?:\/\//.test(c.site) ? c.site : `https://${c.site}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-gold-text hover:underline">
                  {c.site} <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </a>
              )}
            </CampoLinha>
            <CampoLinha label="Horário">{c.horario}</CampoLinha>
          </>
        )}
      </div>

      <div className="mt-5 rounded-xl bg-surface-2 px-5 py-4">
        <p className="mb-1.5 text-xs font-semibold uppercase leading-4 tracking-[0.1em] text-ink-muted">Mensagem que vai ser copiada</p>
        <p className="whitespace-pre-line text-[14.5px] leading-[1.6] text-ink">{texto}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <CopyButton text={texto} label="Copiar mensagem" variant="default" size="default" onCopy={onCopied} />
        {unidade ? (
          <CopyButton text={textoSoEndereco(c)} label="Copiar só o endereço" variant="outline" size="default" onCopy={onCopied} />
        ) : (
          rapido && <CopyButton text={rapido} label={c.whatsapp ? "Copiar só o WhatsApp" : "Copiar só o telefone"} variant="outline" size="default" onCopy={onCopied} />
        )}
      </div>

      {atualizado && <p className="mt-4 text-xs text-ink-muted">Atualizado em {atualizado}</p>}
    </article>
  );
}
