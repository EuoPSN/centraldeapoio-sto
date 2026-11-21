import { Link } from "@tanstack/react-router";
import { useState, type ComponentType, type ReactNode } from "react";
import { Search } from "lucide-react";
import { openGlobalSearch, type SearchScope } from "@/components/GlobalSearch";
import { cn } from "@/lib/utils";

// Cartão de entrada dos hubs (Scripts, Amor Saúde).

export function HubCard({
  to, icon: Icon, title, text, footer, badge, recommended, soon, className, dataTour,
}: {
  to?: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  text: string;
  footer?: ReactNode;
  badge?: string;
  recommended?: boolean;
  soon?: boolean;
  className?: string;
  /** Âncora do tutorial da página (data-tour). */
  dataTour?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full border",
            soon ? "border-line-strong text-ink-muted" : "border-gold text-gold-text",
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </span>
        {badge && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.06em]",
              recommended ? "bg-gold text-on-gold" : "bg-surface-2 text-ink-muted",
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <h2 className="mt-5 text-[17px] font-semibold leading-[22px] text-ink [text-wrap:balance]">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-5 text-ink-muted">{text}</p>
      <p className={cn("mt-auto pt-4 text-[13px] leading-5", soon ? "text-ink-muted" : "font-semibold text-gold-text")}>
        {soon ? "Em construção" : footer}
      </p>
    </>
  );

  const base = cn("flex min-h-[212px] flex-col rounded-[14px] border p-5", className);
  if (!to) {
    return (
      <div aria-disabled data-tour={dataTour} className={cn(base, "border-line bg-sidebar")}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={to}
      data-tour={dataTour}
      className={cn(
        base,
        "bg-surface transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        recommended ? "border-gold border-[1.5px] hover:bg-surface-2/60" : "border-line hover:border-line-strong hover:bg-surface-2/60",
      )}
    >
      {body}
    </Link>
  );
}

/** Campo grande do hub: ao digitar, abre a busca global já filtrada. */
export function HubSearchField({ placeholder, label, scope, dataTour }: { placeholder: string; label: string; scope: SearchScope; dataTour?: string }) {
  const [value, setValue] = useState("");
  return (
    <label data-tour={dataTour} className="mt-10 flex w-full max-w-[640px] cursor-text items-center gap-3 rounded-[14px] border border-line-strong bg-surface px-5 py-[15px] transition-colors hover:border-ink-muted focus-within:border-gold focus-within:hover:border-gold">
      <Search className="h-[18px] w-[18px] shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          const q = e.target.value;
          if (q.trim()) {
            openGlobalSearch(q, scope);
            setValue("");
          } else setValue(q);
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-px font-sans text-xs leading-5 text-ink-muted sm:inline-block">Ctrl K</kbd>
    </label>
  );
}
