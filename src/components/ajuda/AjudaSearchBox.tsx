import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAjudaSearchData, useAjudaSearchResults } from "./useAjudaSearch";

const TIPO_LABEL: Record<string, string> = {
  Procedimento: "Procedimento",
  "Problema técnico": "Problema técnico",
  Novidade: "Novidade",
};

/**
 * Busca da Central de Ajuda: procura em título e texto de procedimentos,
 * problemas técnicos e novidades, com resultados agrupados por tipo.
 * `variant="hub"` é a busca grande da entrada; `variant="compact"` é a busca
 * "Buscar na Central…" do cabeçalho das demais páginas.
 */
export function AjudaSearchBox({ variant = "compact", className }: { variant?: "hub" | "compact"; className?: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const data = useAjudaSearchData();
  const results = useAjudaSearchResults(query, data);

  const grouped = results.reduce<Record<string, typeof results>>((acc, r) => {
    (acc[r.tipo] ??= []).push(r);
    return acc;
  }, {});

  const go = (r: (typeof results)[number]) => {
    navigate({ to: r.to, search: r.search as never });
    setQuery("");
    setOpen(false);
  };

  const big = variant === "hub";

  return (
    <div className={cn("relative", className)}>
      <label
        className={cn(
          "flex cursor-text items-center gap-3 rounded-[14px] border bg-surface transition-colors",
          big
            ? "border-line-strong px-5 py-[15px] hover:border-ink-muted focus-within:border-gold"
            : "h-9 border-line-strong px-3 focus-within:border-gold",
        )}
      >
        <Search className={cn("shrink-0 text-ink-muted", big ? "h-[18px] w-[18px]" : "h-4 w-4")} strokeWidth={1.5} aria-hidden />
        <input
          type="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={big ? "Busque um procedimento, problema ou novidade…" : "Buscar na Central…"}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden",
            big ? "text-[15px] leading-6" : "text-[13.5px]",
          )}
        />
        {big && <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-px font-sans text-xs leading-5 text-ink-muted sm:inline-block">Ctrl K</kbd>}
      </label>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-[12px] border border-line bg-surface p-1.5 shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">Nada encontrado para "{query}".</p>
          ) : (
            Object.entries(grouped).map(([tipo, items]) => (
              <div key={tipo} className="mb-1 last:mb-0">
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{TIPO_LABEL[tipo] ?? tipo}</p>
                {items.map((r) => (
                  <button
                    key={`${r.tipo}-${r.id}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(r)}
                    className="block w-full truncate rounded-md px-3 py-1.5 text-left text-[14px] text-ink hover:bg-surface-2"
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
