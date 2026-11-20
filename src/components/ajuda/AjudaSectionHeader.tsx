import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { AjudaSearchBox } from "./AjudaSearchBox";

const TABS = [
  { to: "/ajuda", label: "Início" },
  { to: "/ajuda/procedimentos", label: "Procedimentos" },
  { to: "/ajuda/problemas", label: "Problemas técnicos" },
  { to: "/ajuda/novidades", label: "Novidades" },
  { to: "/ajuda/sugestoes", label: "Sugestões e dúvidas" },
] as const;

/** Cabeçalho comum às páginas de Procedimentos/Problemas, Novidades e Sugestões. */
export function AjudaSectionHeader({ title }: { title: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-ink">{title}</h1>
        <AjudaSearchBox variant="compact" className="w-full max-w-[320px]" />
      </div>
      <nav aria-label="Central de Ajuda" className="mt-4 flex gap-6 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {TABS.map((t) => {
          const active = t.to === "/ajuda" ? pathname === "/ajuda" : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active ? "border-gold font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
