import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Caixa branca com borda fina e título curto em versalete, como no esboço
 * aprovado. Linhas internas separadas por fio, sem sombra.
 */
export function Panel({
  title,
  action,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { title?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-[14px] border border-border bg-card", className)} {...props}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
          {title && <h2 className="text-xs font-bold uppercase tracking-[0.05em] text-muted-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Linha de um Panel: conteúdo à esquerda, valor/ação alinhados à direita. */
export function PanelRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-[#eef1ef] px-4 py-2.5 first:border-t-0", className)}
      {...props}
    />
  );
}
