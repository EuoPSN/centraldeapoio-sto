import { cn } from "@/lib/utils";

interface PriceTagProps {
  value: number | string | null | undefined;
  /** Preço de promoção: mesmo texto, em gold-text. */
  promo?: boolean;
  size?: "md" | "sm";
  className?: string;
}

function toNumber(v: number | string | null | undefined) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatPriceNumber(v: number | string | null | undefined) {
  const n = toNumber(v);
  if (n == null) return null;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Preço em texto normal da marca (Montserrat, numerais tabulares).
 * A etiqueta de gôndola do redesign anterior saiu; cada página de preço
 * ganha seu próprio tratamento quando for redesenhada.
 */
export function PriceTag({ value, promo = false, size = "md", className }: PriceTagProps) {
  const num = formatPriceNumber(value);
  if (num == null) {
    return <span className={cn("text-sm text-muted-foreground", className)}>Sem preço</span>;
  }
  return (
    <span
      className={cn(
        "whitespace-nowrap font-semibold tabular-nums",
        size === "sm" ? "text-sm" : "text-base",
        promo ? "text-gold-text" : "text-foreground",
        className,
      )}
    >
      R$ {num}
      {promo && <span className="sr-only"> (promoção)</span>}
    </span>
  );
}
