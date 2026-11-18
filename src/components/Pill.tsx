import * as React from "react";
import { cn } from "@/lib/utils";

interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** "brand" usa o verde no ativo (trilha de etapas); "ink" usa o grafite (filtros). */
  tone?: "ink" | "brand";
}

/** Pílula de filtro / segmento. Mesmo desenho das abas (TabsTrigger). */
export const Pill = React.forwardRef<HTMLButtonElement, PillProps>(
  ({ active = false, tone = "ink", className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5",
        active
          ? tone === "brand"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:bg-accent",
        className,
      )}
      {...props}
    />
  ),
);
Pill.displayName = "Pill";

/** Linha de pílulas: quebra em várias linhas na meia tela. */
export function PillRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-1.5", className)} {...props} />;
}
