import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { garantirFechamentoDoMesAnterior, getDestaquesMes } from "@/lib/ranking.functions";
import { nomeDoMes, PODIO_DESTAQUE } from "@/lib/ranking";

/** Linha do Início: "Destaques de <mês anterior>", um selo por pódio. Some se não houve fechamento.
 * Abrir o Início também garante o fechamento do mês anterior (idempotente). */
export function DestaquesDoMes() {
  const fechar = useServerFn(garantirFechamentoDoMesAnterior);
  const fn = useServerFn(getDestaquesMes);
  const qc = useQueryClient();
  const fechamento = useQuery({ queryKey: ["ranking-fechamento"], queryFn: () => fechar({}), staleTime: 3_600_000 });
  const q = useQuery({ queryKey: ["ranking-destaques"], queryFn: () => fn({}), staleTime: 300_000, enabled: fechamento.isSuccess || fechamento.isError });
  useEffect(() => { if (fechamento.isSuccess) void qc.invalidateQueries({ queryKey: ["ranking-destaques"] }); }, [fechamento.isSuccess, qc]);

  if (!q.data || q.data.destaques.length === 0) return null;
  return (
    <section aria-label={`Destaques de ${nomeDoMes(q.data.mes)}`} className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
      <h2 className="text-[13.5px] font-semibold text-ink">Destaques de {nomeDoMes(q.data.mes)}</h2>
      <ul className="flex flex-wrap gap-2">
        {q.data.destaques.map((d) => (
          <li key={d.podio}>
            <Link
              to="/ranking" search={{ aba: "hall" }}
              className="inline-flex items-center rounded-full border border-gold/60 px-2.5 py-0.5 text-[12.5px] text-gold-text transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {d.nome} · {PODIO_DESTAQUE[d.podio]}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
