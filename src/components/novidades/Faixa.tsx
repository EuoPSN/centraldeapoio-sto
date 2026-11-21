import { Link } from "@tanstack/react-router";
import { useStatusMudancas } from "@/components/novidades/hooks";

/** Faixa dourada do Início: mudanças importantes esperando o "Li e entendi". Some quando não há nenhuma. */
export function MudancaFaixa() {
  const { data } = useStatusMudancas();
  if (!data || data.pendentes <= 0) return null;
  const n = data.pendentes;
  return (
    <section
      aria-label="Mudanças para confirmar"
      className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-gold/60 bg-surface px-5 py-4"
    >
      <div className="min-w-0">
        <p className="text-[16px] font-semibold leading-6 text-ink">
          {n} {n === 1 ? "mudança importante" : "mudanças importantes"} para confirmar
        </p>
        {data.mais_antiga && <p className="truncate text-[13.5px] leading-5 text-ink-muted">{data.mais_antiga.title}</p>}
      </div>
      <Link
        to="/novidades"
        className="inline-flex h-10 shrink-0 items-center rounded-lg bg-gold px-[18px] text-[15px] font-semibold text-on-gold transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Ver e confirmar
      </Link>
    </section>
  );
}
