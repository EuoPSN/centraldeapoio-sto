import { useMemo, type ReactNode } from "react";
import { TopbarBreadcrumb, SkeletonLine } from "@/components/scripts/shared";
import { CopyAction } from "@/components/amor-saude/ui";
import { partesDoRoteiro } from "@/lib/roteiros";
import { cn } from "@/lib/utils";

export interface RoteiroItem {
  id: string;
  grupo: string;            // categoria (áudio) ou etapa (ligação)
  titulo: string;
  situacao: string;
  texto: string;
  dicas: string[];
  /** Conteúdo extra no detalhe, antes do texto (player de áudio). */
  extra?: ReactNode;
  /** Botões extras ao lado de "Copiar roteiro". */
  acoes?: ReactNode;
  somenteLeitura?: boolean;
}

/** Lista + detalhe dos roteiros, no mesmo desenho para áudio e ligação. */
export function RoteirosView({
  titulo, breadcrumb, grupos, grupoAtivo, onGrupo, itens, selecionadoId, onSelecionar, carregando, vazio, rotuloDicas, tour, selo,
}: {
  titulo: string;
  breadcrumb: string;
  grupos: string[];
  grupoAtivo: string;
  onGrupo: (g: string) => void;
  itens: RoteiroItem[];
  selecionadoId: string | undefined;
  onSelecionar: (id: string) => void;
  carregando: boolean;
  vazio: { titulo: string; dica: string };
  rotuloDicas: string;
  tour: string;
  selo?: ReactNode;
}) {
  const visiveis = useMemo(() => itens.filter((i) => grupoAtivo === "Todos" || i.grupo === grupoAtivo), [itens, grupoAtivo]);
  const sel = visiveis.find((i) => i.id === selecionadoId) ?? visiveis[0] ?? null;

  return (
    <div className="flex min-h-[calc(100dvh-var(--topbar-h))] flex-col md:h-[calc(100dvh-var(--topbar-h))]">
      <TopbarBreadcrumb items={[{ label: "Scripts", to: "/scripts" }, { label: breadcrumb }]} />
      <header className="shrink-0 px-4 pt-6 sm:px-7 lg:pt-7">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-medium leading-8 text-ink">{titulo}</h1>
            {selo}
          </div>
          <div data-tour={`${tour}-1`} role="group" aria-label="Filtrar" className="flex flex-wrap gap-1.5">
            {["Todos", ...grupos].map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={grupoAtivo === g}
                onClick={() => onGrupo(g)}
                className={cn(
                  "h-8 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  grupoAtivo === g ? "border-ink bg-ink text-surface" : "border-line-strong text-ink hover:bg-surface-2",
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 border-t border-line md:grid-cols-[minmax(340px,480px)_minmax(0,1fr)]">
        <section aria-label={titulo} data-tour={`${tour}-2`} className="min-h-0 border-line pb-4 md:overflow-y-auto md:border-r">
          {carregando ? (
            <div className="space-y-5 px-5 py-5">{Array.from({ length: 6 }, (_, i) => <SkeletonLine key={i} className="h-4 w-full" />)}</div>
          ) : itens.length === 0 ? (
            <div className="px-5 py-8"><p className="text-[15px] font-medium text-ink">{vazio.titulo}</p><p className="mt-1 text-sm text-ink-muted">{vazio.dica}</p></div>
          ) : visiveis.length === 0 ? (
            <div className="px-5 py-8"><p className="text-[15px] font-medium text-ink">Nada nesta categoria.</p></div>
          ) : (
            <ul>
              {visiveis.map((i) => {
                const on = sel?.id === i.id;
                return (
                  <li key={i.id} className={cn("relative", on ? "bg-sidebar before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-gold" : "hover:bg-sidebar/60")}>
                    <button
                      type="button"
                      onClick={() => onSelecionar(i.id)}
                      aria-current={on ? "true" : undefined}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="text-[15px] leading-5 text-ink">{i.titulo}</span>
                      <span className="shrink-0 rounded-full border border-line-strong px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{i.grupo}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Roteiro selecionado" className="min-h-0 border-t border-line md:overflow-y-auto md:border-t-0">
          {sel && <Detalhe key={sel.id} i={sel} rotuloDicas={rotuloDicas} tour={tour} />}
        </section>
      </div>
    </div>
  );
}

function Detalhe({ i, rotuloDicas, tour }: { i: RoteiroItem; rotuloDicas: string; tour: string }) {
  const partes = partesDoRoteiro(i.texto);
  return (
    <article className="max-w-[760px] px-4 py-7 sm:px-8 lg:py-8">
      <p className="text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">{i.grupo}{i.somenteLeitura ? " · da cadência de retomada" : ""}</p>
      <h2 className="mt-1.5 text-[26px] font-semibold leading-8 text-ink">{i.titulo}</h2>
      {i.situacao && <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-ink-muted">{i.situacao}</p>}

      {i.extra && (
        <section data-tour={`${tour}-3`} className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">Exemplo para ouvir</p>
          {i.extra}
        </section>
      )}

      <section className="mt-5" {...(i.extra ? {} : { "data-tour": `${tour}-3` })}>
        <p className="mb-2 text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">O que falar</p>
        <div className="whitespace-pre-line rounded-xl bg-surface-2 px-5 py-4 text-[15.5px] leading-[26px] text-ink">
          {partes.map((p, k) => (p.marca ? <strong key={k} className="font-semibold text-gold-text">{p.texto}</strong> : <span key={k}>{p.texto}</span>))}
        </div>
      </section>

      {i.dicas.length > 0 && (
        <section className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-ink-muted">{rotuloDicas}</p>
          <ul className="space-y-2">
            {i.dicas.map((d, k) => (
              <li key={k} className="flex gap-3 text-[15px] leading-6 text-ink">
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div data-tour={`${tour}-4`} className="mt-7 flex flex-wrap items-center gap-3">
        <CopyAction variant="gold" text={i.texto}>Copiar roteiro</CopyAction>
        {i.acoes}
      </div>
    </article>
  );
}

