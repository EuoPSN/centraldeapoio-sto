import { cn } from "@/lib/utils";

interface PriceTagProps {
  value: number | string | null | undefined;
  /** Vermelha: preço de promoção. */
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
 * Etiqueta de preço de gôndola: o único elemento chamativo da Central.
 * Amarela por padrão; vermelha quando `promo`.
 */
export function PriceTag({ value, promo = false, size = "md", className }: PriceTagProps) {
  const num = formatPriceNumber(value);
  if (num == null) {
    return <span className={cn("text-sm text-muted-foreground", className)}>Sem preço</span>;
  }
  return (
    <span
      className={cn("price-tag", size === "sm" && "price-tag-sm", promo && "price-tag-promo", className)}
      aria-label={`R$ ${num}`}
    >
      <span aria-hidden className={cn("mt-px font-bold", size === "sm" ? "text-[9px]" : "text-[11px]")}>R$</span>
      <span aria-hidden>{num}</span>
    </span>
  );
}
