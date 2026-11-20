import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getCasosParecidos } from "@/lib/fichas.functions";
import type { Ponto } from "@/lib/retomada";
import { Overline } from "@/components/cliente-disse/shared";
import { cn } from "@/lib/utils";

/** "Casos parecidos que fecharam": até 2 fichas publicadas que combinam com a objeção detectada
 * (ou, sem objeção, com o ponto de parada). É só busca por etiquetas: sem chamada de IA.
 * Sem caso parecido, não mostra nada. */
export function CasosParecidos({ objecaoIds, ponto = null, compacto = false }: {
  objecaoIds: string[];
  ponto?: Ponto | null;
  /** Versão do Copiloto: menos espaço, sem a linha do que o atendente fez. */
  compacto?: boolean;
}) {
  const fn = useServerFn(getCasosParecidos);
  const q = useQuery({
    queryKey: ["casos-parecidos", objecaoIds.join(","), ponto],
    queryFn: () => fn({ data: { objecao_ids: objecaoIds, ponto_parada: ponto } }),
    enabled: objecaoIds.length > 0 || !!ponto,
    staleTime: 60_000,
  });
  const casos = q.data ?? [];
  if (!casos.length) return null;

  const filtro = objecaoIds.length ? { objecao: casos.find((c) => c.objecao_id)?.objecao_id ?? objecaoIds[0] } : { ponto: ponto ?? undefined };

  return (
    <section aria-label="Casos parecidos que fecharam" className={compacto ? "space-y-2" : "space-y-3"}>
      <Overline>Casos parecidos que fecharam</Overline>
      {casos.map((c) => (
        <Link
          key={c.id}
          to="/biblioteca"
          search={{ aba: "conversas", ficha: c.id, ...filtro }}
          className={cn("block rounded-xl border border-line px-4 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", compacto ? "py-2.5" : "py-3")}
        >
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {c.objecao_rotulo && <span className="rounded-full border border-gold px-2.5 py-0.5 text-[12px] font-semibold text-gold-text">{c.objecao_rotulo}</span>}
            <span className="text-[14.5px] font-semibold text-ink">{c.titulo}</span>
          </span>
          <span className="mt-1 block text-[13px] text-ink-muted">
            {[c.autor, c.plano, c.perfil_cliente && c.perfil_cliente.toLowerCase()].filter(Boolean).join(" · ")}
          </span>
          {!compacto && c.uma_linha && <span className="mt-1 block text-[14px] leading-5 text-ink">{c.uma_linha}</span>}
        </Link>
      ))}
      <Link
        to="/biblioteca"
        search={{ aba: "conversas", ...filtro }}
        className="inline-block text-[13.5px] font-semibold text-gold-text hover:underline"
      >
        Ver todos os casos na Biblioteca →
      </Link>
    </section>
  );
}
