import type * as React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Cabeçalho de página: título enxuto, sem ícone decorativo. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground [text-wrap:balance]">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Container padrão das telas: respiro menor em meia tela. */
export function PageBody({ className, wide = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return (
    <div
      className={cn("mx-auto w-full px-4 py-5 sm:px-5 lg:px-8 lg:py-7", wide ? "max-w-7xl" : "max-w-5xl", className)}
      {...props}
    />
  );
}
