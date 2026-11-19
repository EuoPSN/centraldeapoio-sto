import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode, type SVGProps } from "react";
import { Check, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TopbarBreadcrumb, SkeletonLine, useCopy } from "@/components/scripts/shared";
import { cn } from "@/lib/utils";
import { enderecoCurto, type AmorItem, type ClinicaOrdenada, type Proximidade } from "./model";
import { setRegiao, toggleOrcamento, useOrcamento, useRegiao, noOrcamento } from "./store";

// ---------------------------------------------------------------------------
// Ícone de dente (o lucide não tem), no mesmo traço dos demais.
// ---------------------------------------------------------------------------

export function ToothIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M7.5 3.5c-2.4 0-4 1.9-4 4.6 0 2.2.9 3.6 1.5 5.2.7 1.9.8 4 1.4 5.9.4 1.2 1 1.8 1.7 1.8.9 0 1.2-1 1.5-2.4l.6-2.8c.2-.9.8-1.4 1.8-1.4s1.6.5 1.8 1.4l.6 2.8c.3 1.4.6 2.4 1.5 2.4.7 0 1.3-.6 1.7-1.8.6-1.9.7-4 1.4-5.9.6-1.6 1.5-3 1.5-5.2 0-2.7-1.6-4.6-4-4.6-1.8 0-2.9 1-4.5 1s-2.7-1-4.5-1Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Cabeçalho comum das subpáginas
// ---------------------------------------------------------------------------

const TABS = [
  { to: "/amor-saude", label: "Início" },
  { to: "/amor-saude/consultas", label: "Consultas" },
  { to: "/amor-saude/exames", label: "Exames" },
  { to: "/amor-saude/odontologia", label: "Odontologia" },
  { to: "/amor-saude/clinicas", label: "Clínicas" },
] as const;

export function SubpageHeader({
  title, active, search, onSearch, searchPlaceholder, regioes,
}: {
  title: string;
  active: (typeof TABS)[number]["to"];
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  regioes: string[];
}) {
  return (
    <header className="shrink-0 px-4 pt-6 sm:px-7 lg:pt-7">
      <TopbarBreadcrumb items={[{ label: "Amor Saúde", to: "/amor-saude" }, { label: title }]} />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="text-2xl font-medium leading-8 text-ink">{title}</h1>
        <RegionSelect regioes={regioes} />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-line">
        <nav aria-label="Seções do Amor Saúde" className="-mb-px flex min-w-0 flex-1 gap-6 overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => {
            const on = t.to === active;
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on ? "border-gold font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <label className="mb-2 flex h-9 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 focus-within:border-gold sm:w-[300px]">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
      </div>
    </header>
  );
}

const SEM_REGIAO = "__sem-regiao";

export function RegionSelect({ regioes }: { regioes: string[] }) {
  const regiao = useRegiao();
  const valid = regiao && regioes.includes(regiao) ? regiao : SEM_REGIAO;
  return (
    <div className="flex items-center gap-3">
      <span id="regiao-cliente" className="whitespace-nowrap text-sm text-ink-muted">Região do cliente</span>
      <Select value={valid} onValueChange={(v) => setRegiao(v === SEM_REGIAO ? null : v)}>
        <SelectTrigger aria-labelledby="regiao-cliente" className="h-9 min-w-[150px] rounded-lg border-line-strong bg-surface text-sm font-semibold text-ink">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={SEM_REGIAO}>Não informada</SelectItem>
          {regioes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças da lista e do detalhe
// ---------------------------------------------------------------------------

export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted", className)}>{children}</p>;
}

/** Caixa do orçamento na linha da lista. */
export function OrcamentoCheck({ item, label }: { item: AmorItem; label: string }) {
  const lista = useOrcamento();
  const on = noOrcamento(lista, item);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={on ? `Tirar ${label} do orçamento` : `Pôr ${label} no orçamento`}
      title={on ? "No orçamento" : "Pôr no orçamento"}
      onClick={(e) => {
        e.stopPropagation();
        toggleOrcamento({ tipo: item.tipo, id: item.id });
      }}
      className="grid h-11 w-11 shrink-0 place-items-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
    >
      <span
        className={cn(
          "grid h-[17px] w-[17px] place-items-center rounded-[4px] border-[1.5px] transition-colors",
          on ? "border-gold bg-gold text-on-gold" : "border-line-strong bg-surface",
        )}
      >
        {on && <Check className="h-3 w-3" strokeWidth={2.5} />}
      </span>
    </button>
  );
}

/** Linha selecionável da lista (52px). */
export function ListRow({
  item, label, selected, onSelect, children, rowRef,
}: {
  item: AmorItem;
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  rowRef?: (el: HTMLLIElement | null) => void;
}) {
  return (
    <li
      ref={rowRef}
      className={cn(
        "relative flex h-[52px] items-center pl-2 pr-4 transition-colors",
        selected ? "bg-sidebar before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-gold" : "hover:bg-sidebar/60",
      )}
    >
      <OrcamentoCheck item={item} label={label} />
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {children}
      </button>
    </li>
  );
}

/** "Mais procuradas": pílulas com os 5 itens mais copiados. */
export function MaisProcuradas({ label, itens, onPick }: { label: string; itens: { id: string; nome: string }[]; onPick: (id: string) => void }) {
  if (!itens.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 px-4 pt-3 sm:px-5">
      <span className="mr-0.5 text-[13px] text-ink-muted">{label}:</span>
      {itens.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => onPick(i.id)}
          className="rounded-full border border-line-strong px-2.5 py-0.5 text-[13px] leading-5 text-ink transition-colors hover:border-gold hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          {i.nome}
        </button>
      ))}
    </div>
  );
}

export function ColumnHeads({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="flex h-10 items-end pb-2 pl-[52px] pr-4 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
      {children}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-5 px-5 py-5">
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="flex gap-4"><SkeletonLine className="h-4 w-4" /><SkeletonLine className="h-4 w-40" /><SkeletonLine className="ml-auto h-4 w-16" /></div>)}
    </div>
  );
}
export function DetailSkeleton() {
  return (
    <div className="space-y-4 px-6 py-8 lg:px-10"><SkeletonLine className="h-3 w-24" /><SkeletonLine className="h-7 w-56" /><SkeletonLine className="h-4 w-full max-w-md" /><SkeletonLine className="h-20 w-full rounded-xl" /></div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-8">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Mantém a linha selecionada visível quando ela vem por link (?item=). */
export function useScrollIntoView(id: string | undefined, deps: unknown[]) {
  const refs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (id) refs.current.get(id)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ...deps]);
  return (key: string) => (el: HTMLLIElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  };
}

const SELO: Record<Proximidade, string> = { proxima: "Mais próxima", principal: "Principal", outra: "Outra região" };

export function Selo({ tipo }: { tipo: Proximidade }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em]",
        tipo === "proxima" ? "bg-gold text-on-gold" : "border border-line-strong text-ink-muted",
      )}
    >
      {SELO[tipo]}
    </span>
  );
}

export function OndeAtende({ titulo, ordenadas }: { titulo: string; ordenadas: ClinicaOrdenada[] }) {
  if (!ordenadas.length) return null;
  return (
    <section className="mt-6">
      <Overline>{titulo}</Overline>
      <ul className="mt-2">
        {ordenadas.map(({ clinica: c, selo }) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2.5 text-[14.5px] leading-5 last:border-b-0">
            <Selo tipo={selo} />
            <span className="font-semibold text-ink">{c.nome}</span>
            {(enderecoCurto(c) || c.regiao) && <span className="text-ink-muted">{enderecoCurto(c) || c.regiao}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TextBlock({ titulo, children }: { titulo: string; children: ReactNode }) {
  if (children == null || children === "") return null;
  return (
    <section className="mt-6">
      <Overline>{titulo}</Overline>
      <div className="mt-1.5 max-w-[68ch] whitespace-pre-line text-[15px] leading-6 text-ink">{children}</div>
    </section>
  );
}

/** Botão de texto "+ Orçamento" / "✓ No orçamento". */
export function OrcamentoLink({ item }: { item: AmorItem }) {
  const lista = useOrcamento();
  const on = noOrcamento(lista, item);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => toggleOrcamento({ tipo: item.tipo, id: item.id })}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-[15px] font-semibold text-gold-text transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {on ? <><Check className="h-4 w-4" strokeWidth={2} /> No orçamento</> : <>+ Orçamento</>}
    </button>
  );
}

/** Botão de copiar com confirmação no próprio botão. */
export function CopyAction({ text, children, variant = "outline", onCopied }: { text: string; children: ReactNode; variant?: "gold" | "outline"; onCopied?: () => void }) {
  const { copied, copy } = useCopy(onCopied);
  const cls = variant === "gold"
    ? "bg-gold text-on-gold font-semibold hover:brightness-105"
    : "border border-line-strong bg-surface font-medium text-ink hover:bg-surface-2";
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-live="polite"
      className={cn(
        "inline-grid h-10 items-center justify-items-center rounded-lg px-[18px] text-[15px] transition-[filter,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        cls,
      )}
    >
      {/* As duas legendas ocupam a mesma célula: o botão não muda de largura ao copiar. */}
      <span className={cn("col-start-1 row-start-1", copied && "invisible")}>{children}</span>
      <span className={cn("col-start-1 row-start-1 inline-flex items-center gap-1.5", !copied && "invisible")}>
        <Check className="h-4 w-4" strokeWidth={2} /> Copiado
      </span>
    </button>
  );
}

/** Bloco de valor dos itens sem preço fixo (exames e odontologia). */
export function ValorBloco({
  principal, secundario, nota,
}: {
  principal: { label: string; value: string };
  secundario: { label: string; value: string } | null;
  nota?: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3 rounded-xl bg-surface-2 px-5 py-4">
      <div>
        <Overline className="text-[11.5px]">{principal.label}</Overline>
        <p className="mt-0.5 text-[21px] font-semibold leading-8 text-ink">{principal.value}</p>
      </div>
      {secundario && (
        <div>
          <Overline className="text-[11.5px]">{secundario.label}</Overline>
          <p className="mt-0.5 text-[21px] font-semibold leading-8 tabular-nums text-gold-text">{secundario.value}</p>
        </div>
      )}
      {nota && <p className="max-w-[22ch] pb-1 text-[13px] leading-[18px] text-ink-muted">{nota}</p>}
    </div>
  );
}
