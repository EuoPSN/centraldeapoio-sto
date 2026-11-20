import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { getClienteDisseBase, registrarUsoClienteDisse } from "@/lib/cliente-disse.functions";
import { useCopy } from "@/components/scripts/shared";
import { cn } from "@/lib/utils";

export const BASE_KEY = ["cliente-disse-base"] as const;

export function useClienteDisseBase() {
  const fn = useServerFn(getClienteDisseBase);
  return useQuery({ queryKey: BASE_KEY, queryFn: () => fn({}), staleTime: 60_000 });
}
export type ClienteDisseBase = NonNullable<ReturnType<typeof useClienteDisseBase>["data"]>;

/** Registra o uso (cada "Copiar") e atualiza as contagens em segundo plano. */
export function useRegistrarUso() {
  const fn = useServerFn(registrarUsoClienteDisse);
  const qc = useQueryClient();
  return (data: { objecao_id?: string; fechamento_item_id?: string; angulo?: string; caso_id?: string }) => {
    fn({ data: { objecao_id: data.objecao_id ?? null, fechamento_item_id: data.fechamento_item_id ?? null, angulo: data.angulo ?? null, caso_id: data.caso_id ?? null } })
      .then(() => qc.invalidateQueries({ queryKey: BASE_KEY }))
      .catch(() => undefined);
  };
}

/** Botão "Copiar" com contorno (cartões) ou como link dourado. */
export function CopyText({ text, onCopied, variant = "outline", label = "Copiar", className }: {
  text: string; onCopied?: () => void; variant?: "outline" | "link"; label?: string; className?: string;
}) {
  const { copied, copy } = useCopy(onCopied);
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      disabled={!text.trim()}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
        variant === "outline"
          ? "h-8 rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] font-medium text-ink hover:bg-surface-2"
          : "text-[13.5px] font-semibold text-gold-text hover:underline",
        className,
      )}
    >
      {copied ? <><Check className="h-3.5 w-3.5" strokeWidth={2} /> Copiado</> : label}
    </button>
  );
}

export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11.5px] font-semibold uppercase leading-4 tracking-[0.12em]", className ?? "text-ink-muted")}>{children}</p>;
}

/** Etiqueta pequena com borda tracejada ("Objeção nova", "Sugestão da IA…"). */
export function DashedTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-ink px-2.5 py-0.5 text-[12.5px] font-semibold text-ink">
      {children}
    </span>
  );
}

export function GoldPill({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-gold px-2.5 py-0.5 text-[12.5px] font-semibold text-on-gold">{children}</span>;
}

/** Pílula selecionável (plano, usos, travamentos). */
export function ChoicePill({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "border-ink bg-surface-2 font-semibold text-ink" : "border-line-strong text-ink hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ErroDiscreto({ children }: { children: ReactNode }) {
  return <p role="status" className="text-[13.5px] text-ink-muted">{children}</p>;
}
