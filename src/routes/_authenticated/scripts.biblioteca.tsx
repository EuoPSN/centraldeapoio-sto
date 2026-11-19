import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { DownloadImageButton } from "@/components/DownloadImageButton";
import {
  TopbarBreadcrumb, TextTabs, WhatsAppMessage, CopyIconButton, GoldButton, OutlineButton, SkeletonLine,
  useMessages, useMessageCategories, useCountCopy, useCopy, byMostUsed, matchesMessage,
  plainText, previewLine, shortNames, type MessageRow,
} from "@/components/scripts/shared";
import { cn } from "@/lib/utils";

type BibliotecaSearch = { categoria?: string; sub?: string; msg?: string };
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/_authenticated/scripts/biblioteca")({
  validateSearch: (s: Record<string, unknown>): BibliotecaSearch => ({
    categoria: str(s.categoria),
    sub: str(s.sub),
    msg: str(s.msg),
  }),
  component: Biblioteca,
});

const SEM_CATEGORIA = "sem-categoria";
const TODAS = "todas";
const SUBS_VISIVEIS = 9;

function Biblioteca() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const messages = useMessages();
  const cats = useMessageCategories();
  const countCopy = useCountCopy();
  const [query, setQuery] = useState("");
  const [showAllSubs, setShowAllSubs] = useState(false);

  const rows = messages.rows;

  // Abas: categorias que têm mensagens, na ordem do admin.
  const categoryTabs = useMemo(() => {
    const withMsgs = new Map<string, string>();
    let semCategoria = false;
    rows.forEach((r) => (r.category ? withMsgs.set(r.category.id, r.category.name) : (semCategoria = true)));
    const order = new Map(cats.rows.map((c) => [c.id, c.position]));
    const tabs = [...withMsgs.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999) || a.name.localeCompare(b.name));
    if (semCategoria) tabs.push({ id: SEM_CATEGORIA, name: "Sem categoria" });
    return tabs;
  }, [rows, cats.rows]);

  // Link só com ?msg= (busca global, links antigos): abre na categoria da mensagem.
  const linked = search.msg ? rows.find((r) => r.id === search.msg) : undefined;
  const linkedCat = linked ? (linked.category?.id ?? SEM_CATEGORIA) : undefined;
  const activeCat =
    categoryTabs.find((t) => t.id === search.categoria)?.id ??
    categoryTabs.find((t) => t.id === linkedCat)?.id ??
    categoryTabs[0]?.id ?? null;
  const activeCatName = categoryTabs.find((t) => t.id === activeCat)?.name ?? "";
  const inCat = useMemo(
    () => rows.filter((r) => (activeCat === SEM_CATEGORIA ? !r.category : r.category?.id === activeCat)),
    [rows, activeCat],
  );

  // Subcategorias da categoria, das que têm mais mensagens para as que têm menos.
  const subs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    inCat.forEach((r) => {
      if (!r.subcategory) return;
      const cur = map.get(r.subcategory.id) ?? { ...r.subcategory, count: 0 };
      cur.count += 1;
      map.set(r.subcategory.id, cur);
    });
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [inCat]);
  const names = useMemo(() => shortNames(subs, activeCatName), [subs, activeCatName]);
  const activeSub = subs.some((s) => s.id === search.sub) ? search.sub! : TODAS;

  const list = useMemo(
    () => inCat
      .filter((r) => activeSub === TODAS || r.subcategory?.id === activeSub)
      .filter((r) => matchesMessage(r, query))
      .sort(byMostUsed),
    [inCat, activeSub, query],
  );

  // Abrir a Biblioteca já seleciona a primeira mensagem da lista.
  const selected = list.find((m) => m.id === search.msg) ?? list[0] ?? null;

  const setSearch = (next: BibliotecaSearch) => navigate({ search: next, replace: true });
  const selectCat = (id: string) => {
    setQuery("");
    setShowAllSubs(false);
    setSearch({ categoria: id });
  };
  const selectSub = (id: string) => setSearch({ categoria: activeCat ?? undefined, sub: id === TODAS ? undefined : id });
  const selectMsg = (id: string) => setSearch({ categoria: activeCat ?? undefined, sub: activeSub === TODAS ? undefined : activeSub, msg: id });

  // A mensagem que veio por link fica visível na lista.
  const listRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    if (!search.msg || !listRef.current) return;
    listRef.current.querySelector(`[data-msg="${search.msg}"]`)?.scrollIntoView({ block: "nearest" });
  }, [search.msg, list.length]);

  // Subcategorias visíveis: as 9 maiores (+ a selecionada, se estiver fora delas).
  const hiddenCount = Math.max(0, subs.length - SUBS_VISIVEIS);
  const visibleSubs = showAllSubs
    ? subs
    : subs.filter((s, i) => i < SUBS_VISIVEIS || s.id === activeSub);

  const loading = messages.isLoading || cats.isLoading;
  const subLabel = activeSub === TODAS ? null : names.get(activeSub);

  return (
    <div className="flex min-h-[calc(100dvh-var(--topbar-h))] flex-col md:h-[calc(100dvh-var(--topbar-h))]">
      <TopbarBreadcrumb items={[{ label: "Scripts", to: "/scripts" }, { label: "Biblioteca de mensagens" }]} />

      <header className="px-4 pt-6 sm:px-7 lg:pt-7">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold leading-8 text-ink">Biblioteca de mensagens</h1>
          <Link to="/scripts/fluxo" className="text-sm font-medium text-gold-text underline-offset-4 hover:underline">
            Ir para o Fluxo de atendimento <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex gap-6 border-b border-line pb-3"><SkeletonLine className="h-4 w-28" /><SkeletonLine className="h-4 w-36" /><SkeletonLine className="h-4 w-24" /></div>
          ) : (
            <TextTabs
              label="Categorias"
              items={categoryTabs}
              value={activeCat}
              onChange={selectCat}
              trailing={
                <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 focus-within:border-gold sm:w-[340px]">
                  <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">Buscar nesta categoria</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar nesta categoria…"
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
                  />
                </label>
              }
            />
          )}
        </div>
      </header>

      {!loading && categoryTabs.length === 0 ? (
        <p className="px-4 py-10 text-sm text-ink-muted sm:px-7">Nenhuma mensagem cadastrada ainda.</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(260px,340px)_1fr] md:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[190px_minmax(300px,400px)_1fr] lg:grid-rows-[minmax(0,1fr)]">
          {/* Subcategorias: coluna à esquerda (lg+) ou linha rolável acima da lista. */}
          <nav aria-label="Subcategorias" className="min-h-0 overflow-x-auto border-line px-4 py-2 sm:px-7 md:col-span-2 lg:col-span-1 lg:overflow-y-auto lg:overflow-x-visible lg:py-4 lg:pl-2 lg:pr-3">
            {loading ? (
              <div className="space-y-4 px-3 py-2">{Array.from({ length: 6 }, (_, i) => <SkeletonLine key={i} className="h-3.5 w-24" />)}</div>
            ) : (
              <ul className="flex gap-1 lg:flex-col lg:gap-0">
                <SubItem label="Todas" active={activeSub === TODAS} count={inCat.length} onClick={() => selectSub(TODAS)} />
                {visibleSubs.map((s) => (
                  <SubItem key={s.id} label={names.get(s.id) ?? s.name} title={s.name} active={activeSub === s.id} count={s.count} onClick={() => selectSub(s.id)} />
                ))}
                {hiddenCount > 0 && !showAllSubs && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setShowAllSubs(true)}
                      className="whitespace-nowrap rounded px-3 py-1.5 text-left text-sm font-semibold text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-ring lg:py-2"
                    >
                      + {hiddenCount} {hiddenCount === 1 ? "subcategoria" : "subcategorias"}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </nav>

          {/* Lista de mensagens */}
          <section aria-label="Mensagens" className="min-h-0 border-line md:overflow-y-auto md:border-r lg:border-l">
            {loading ? (
              <div className="space-y-6 px-5 py-5">{Array.from({ length: 6 }, (_, i) => <div key={i} className="space-y-2"><SkeletonLine className="h-4 w-36" /><SkeletonLine className="h-3 w-64" /></div>)}</div>
            ) : list.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted">
                {query.trim() ? "Nenhuma mensagem encontrada nesta categoria." : "Nenhuma mensagem nesta subcategoria ainda."}
              </p>
            ) : (
              <ul ref={listRef} className="py-1">
                {list.map((m) => (
                  <MessageListRow
                    key={m.id}
                    m={m}
                    selected={selected?.id === m.id}
                    onSelect={() => selectMsg(m.id)}
                    onCopied={() => countCopy(m.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Detalhe */}
          <section aria-label="Mensagem selecionada" className="min-h-0 border-t border-line md:overflow-y-auto md:border-t-0">
            {loading ? (
              <div className="space-y-4 px-6 py-8 lg:px-10"><SkeletonLine className="h-3 w-40" /><SkeletonLine className="h-6 w-56" /><SkeletonLine className="h-32 w-full rounded-xl" /></div>
            ) : selected ? (
              <MessageDetail key={selected.id} m={selected} categoryName={activeCatName} subName={selected.subcategory ? (names.get(selected.subcategory.id) ?? selected.subcategory.name) : subLabel} onCopied={() => countCopy(selected.id)} />
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

function SubItem({ label, title, active, count, onClick }: { label: string; title?: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        title={title}
        aria-current={active ? "true" : undefined}
        onClick={onClick}
        className={cn(
          "relative flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-r px-3 py-1.5 text-left text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-ring lg:py-2 lg:whitespace-normal",
          active
            ? "font-semibold text-ink before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-gold"
            : "text-ink-muted hover:text-ink",
        )}
      >
        <span className="min-w-0">{label}</span>
        {active && <span className="text-[13px] font-semibold tabular-nums text-gold-text">{count}</span>}
      </button>
    </li>
  );
}

function MessageListRow({ m, selected, onSelect, onCopied }: { m: MessageRow; selected: boolean; onSelect: () => void; onCopied: () => void }) {
  return (
    <li data-msg={m.id} className={cn("flex h-16 items-center gap-2 pr-3 transition-colors", selected ? "bg-sidebar" : "hover:bg-sidebar/60")}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="flex h-full min-w-0 flex-1 flex-col justify-center pl-5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="truncate text-[14.5px] font-semibold leading-5 text-ink">{m.title}</span>
        <span className="truncate text-[13px] leading-5 text-ink-muted">{previewLine(m.content) || "Sem texto"}</span>
      </button>
      <CopyIconButton text={m.content} framed={selected} label={`Copiar “${m.title}”`} onCopied={onCopied} />
    </li>
  );
}

function MessageDetail({ m, categoryName, subName, onCopied }: { m: MessageRow; categoryName: string; subName: string | null | undefined; onCopied: () => void }) {
  const formatted = useCopy(onCopied);
  const plain = useCopy(onCopied);
  const overline = [m.category?.name ?? categoryName, subName].filter(Boolean).join(" · ");
  const meta = [
    m.shortcut ? `Atalho /${m.shortcut}` : null,
    `usada ${m.use_count ?? 0}×`,
    m.updated_at ? `atualizada em ${new Date(m.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <article className="mx-auto max-w-[680px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      {overline && <p className="text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">{overline}</p>}
      <h2 className="mt-1.5 text-[22px] font-semibold leading-8 text-ink">{m.title}</h2>
      <p className="mt-0.5 text-[13px] leading-5 text-ink-muted">{meta}</p>

      <div className="mt-5 rounded-xl bg-surface-2 px-5 py-4">
        {m.content.trim() ? <WhatsAppMessage content={m.content} /> : <p className="text-sm text-ink-muted">Mensagem sem texto.</p>}
      </div>

      {m.image_url && (
        <div className="mt-4 flex flex-col items-start gap-2">
          <img src={m.image_url} alt={m.title} className="max-h-56 rounded-lg border border-line object-contain" />
          <DownloadImageButton url={m.image_url} filename={`${m.title}.${m.image_ext || "jpg"}`} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <GoldButton onClick={() => formatted.copy(m.content)} aria-live="polite">
          {formatted.copied ? "Copiado" : "Copiar mensagem"}
        </GoldButton>
        <OutlineButton onClick={() => plain.copy(plainText(m.content))} aria-live="polite">
          {plain.copied ? "Copiado" : "Sem formatação"}
        </OutlineButton>
      </div>

      {m.internal_note?.trim() && (
        <p className="mt-6 border-t border-line pt-4 text-sm leading-[22px] text-ink-muted">
          <span className="font-semibold text-ink">Quando usar:</span> {m.internal_note}
        </p>
      )}
    </article>
  );
}
