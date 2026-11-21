import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCasosParecidos } from "@/lib/biblioteca.functions";
import { resumoFicha } from "@/lib/biblioteca";
import type { Ponto } from "@/lib/retomada";
import { Overline } from "@/components/cliente-disse/shared";
import { cn } from "@/lib/utils";

/** "Casos parecidos que fecharam": até 2 fichas publicadas, achadas só por etiquetas (sem chamada de IA).
 * Sem caso parecido, não mostra nada. */
export function CasosParecidos({ objecaoIds, ponto, compacto, className }: {
  objecaoIds: string[];
  ponto?: Ponto | null;
  compacto?: boolean;
  className?: string;
}) {
  const fn = useServerFn(getCasosParecidos);
  const navigate = useNavigate();
  const chave = objecaoIds.join(",");
  const q = useQuery({
    queryKey: ["casos-parecidos", chave, ponto ?? null],
    queryFn: () => fn({ data: { objecao_ids: objecaoIds, ponto: ponto ?? null } }),
    enabled: objecaoIds.length > 0 || !!ponto,
    staleTime: 60_000,
  });

  const fichas = q.data?.fichas ?? [];
  if (!fichas.length) return null;
  const filtro = q.data?.filtro ?? {};

  return (
    <section aria-label="Casos parecidos que fecharam" className={className}>
      <Overline>Casos parecidos que fecharam</Overline>
      <ul className={cn("mt-2", compacto ? "space-y-2" : "space-y-3")}>
        {fichas.map((f) => (
          <li key={f.id} className={cn("rounded-xl border border-line", compacto ? "px-3 py-2.5" : "px-4 py-3")}>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {f.objecao_rotulo && (
                <span className="rounded-full border border-gold px-2.5 py-0.5 text-[12px] font-semibold text-gold-text">{f.objecao_rotulo}</span>
              )}
              <span className="text-[14.5px] font-semibold text-ink">{f.titulo}</span>
            </div>
            <p className="mt-1 text-[13px] text-ink-muted">
              {[f.autor_nome, f.plano !== "outro" && f.plano, f.perfil_cliente && f.perfil_cliente.toLowerCase()].filter(Boolean).join(" · ")}
            </p>
            {!compacto && <p className="mt-1 text-[14px] leading-5 text-ink">{resumoFicha(f)}</p>}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-3 text-[14px] font-semibold text-gold-text hover:underline"
        onClick={() => navigate({ to: "/biblioteca", search: { aba: "conversas", objecao: filtro.objecao, ponto: filtro.ponto } })}
      >
        Ver todos os casos na Biblioteca →
      </button>
    </section>
  );
}
