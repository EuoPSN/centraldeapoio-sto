import { SELO_LABEL, type Selo } from "@/lib/mensagens-vendem";
import { cn } from "@/lib/utils";

/** Selo de desempenho da mensagem. "Funciona bem": ponto dourado. "Vale testar outra": contorno tracejado.
 * O atendente nunca vê percentuais. */
export function SeloPill({ selo }: { selo: Selo }) {
  return selo === "funciona_bem" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold px-2.5 py-0.5 text-[12.5px] font-semibold text-gold-text">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
      {SELO_LABEL.funciona_bem}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-dashed border-ink px-2.5 py-0.5 text-[12.5px] font-semibold text-ink">
      {SELO_LABEL.vale_testar_outra}
    </span>
  );
}

export function SeloLinha({ selo, envios, className, children }: { selo: Selo | null; envios: number; className?: string; children?: React.ReactNode }) {
  if (!selo && envios <= 0) return children ? <div className={cn("mt-3 flex justify-end", className)}>{children}</div> : null;
  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      {selo && <SeloPill selo={selo} />}
      {envios > 0 && <span className="text-[13px] text-ink-muted">Usada {envios} {envios === 1 ? "vez" : "vezes"} pela equipe.</span>}
      {children && <span className="ml-auto">{children}</span>}
    </div>
  );
}
