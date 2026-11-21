import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useStatusAquecimento } from "@/components/aquecimento/hooks";

/** Faixa do Início: aquecimento do dia pronto ou, depois de feito, uma linha discreta.
 * `contornada`: sem fundo dourado, quando há a faixa de mudança importante acima dela. */
export function AquecimentoFaixa({ contornada = false }: { contornada?: boolean }) {
  const { data } = useStatusAquecimento();
  if (!data || !data.disponivel) return null;

  if (data.concluido_hoje) {
    return (
      <p className="mt-4 px-1 text-[13px] leading-5 text-ink-muted">
        Aquecimento de hoje concluído · {data.dias_semana} {data.dias_semana === 1 ? "dia" : "dias"} nesta semana
      </p>
    );
  }

  return (
    <section
      aria-label="Aquecimento de hoje"
      className={cn(
        "mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border px-5 py-4",
        contornada ? "border-line bg-surface" : "border-gold/50 bg-surface-2",
      )}
    >
      <div className="min-w-0">
        <p className="text-[16px] font-semibold leading-6 text-ink">Seu aquecimento de hoje está pronto · 5 minutos</p>
        <p className="text-[13.5px] leading-5 text-ink-muted">3 cartões: produto, uma objeção e um hábito de escrita. Opcional, mas ajuda a começar o dia afiada.</p>
      </div>
      <Link
        to="/aquecimento"
        className={cn(
          "inline-flex h-10 shrink-0 items-center rounded-lg px-[18px] text-[15px] transition-[filter] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          contornada ? "border border-line-strong font-medium text-ink hover:bg-accent" : "bg-gold font-semibold text-on-gold hover:brightness-105",
        )}
      >
        Começar
      </Link>
    </section>
  );
}
