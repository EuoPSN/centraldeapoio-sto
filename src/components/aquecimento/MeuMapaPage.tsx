import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMeuMapa } from "@/lib/mapa-dominio.functions";
import { NIVEL_LABEL, type Nivel } from "@/lib/aquecimento";
import { TopbarBreadcrumb } from "@/components/scripts/shared";
import { ErroDiscreto } from "@/components/cliente-disse/shared";
import { cn } from "@/lib/utils";

/** Pílula do nível: cheia (dominando), contorno dourado (aprendendo), tracejada (não testado). */
export function NivelPill({ nivel, className }: { nivel: Nivel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold",
        nivel === "dominando" && "bg-gold text-on-gold",
        nivel === "aprendendo" && "border border-gold text-ink",
        nivel === "nao_testado" && "border border-dashed border-line-strong text-ink-muted",
        className,
      )}
    >
      {NIVEL_LABEL[nivel]}
    </span>
  );
}

export function MeuMapaPage() {
  const fn = useServerFn(getMeuMapa);
  const q = useQuery({ queryKey: ["meu-mapa"], queryFn: () => fn({}) });
  const d = q.data;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Treino e evolução" }, { label: "Meu mapa" }]} />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
        <h1 className="text-2xl font-medium leading-8 text-ink">Meu mapa</h1>
        <p className="text-[14px] text-ink-muted">Onde você domina e onde ainda pode treinar</p>
      </div>

      {q.isLoading && <div className="mt-6"><ErroDiscreto>Carregando o seu mapa…</ErroDiscreto></div>}
      {q.isError && <div className="mt-6"><ErroDiscreto>Não consegui carregar o seu mapa agora. Tente de novo.</ErroDiscreto></div>}
      {d && d.temas.length === 0 && <div className="mt-6"><ErroDiscreto>Ainda não há temas de domínio cadastrados.</ErroDiscreto></div>}

      {d && d.temas.length > 0 && (
        <>
          <ul data-tour="meu-mapa-1" className="mt-4 max-w-[860px]">
            {d.temas.map((t, i) => (
              <li key={t.tema_id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-4">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-[16px] font-medium leading-6 text-ink">{t.nome}</p>
                  {t.descricao && <p className="text-[13.5px] leading-5 text-ink-muted">{t.descricao}</p>}
                </div>
                <div data-tour={i === 0 ? "meu-mapa-2" : undefined} className="w-44 shrink-0">
                  <NivelPill nivel={t.nivel} />
                  <p className="mt-1 text-[13px] text-ink-muted">
                    {t.nivel === "nao_testado"
                      ? `menos de ${d.min_respostas} respostas`
                      : `${t.respostas} respostas · ${Math.round((t.acertos / Math.max(1, t.respostas)) * 100)}% certas`}
                  </p>
                </div>
                <Link
                  to="/aquecimento"
                  search={{ tema: t.tema_id }}
                  data-tour={i === 0 ? "meu-mapa-3" : undefined}
                  className="inline-flex h-[34px] shrink-0 items-center rounded-lg border border-line-strong bg-surface px-3.5 text-[14px] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Treinar este tema
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-[860px] text-[13px] leading-5 text-ink-muted">
            O nível vem do que você acertou no aquecimento nos últimos {d.janela_dias} dias, com pelo menos {d.min_respostas} respostas por tema.
            O Paulo vê o mapa da equipe para escolher treinamentos; o aquecimento não entra no Ranking.
          </p>
        </>
      )}
    </div>
  );
}
