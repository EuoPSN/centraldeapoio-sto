import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRetomadaBase, getRetomadaContagem } from "@/lib/retomada.functions";

export const RETOMADA_BASE_KEY = ["retomada-base"] as const;
export const RETOMADA_CONTAGEM_KEY = ["retomada-contagem"] as const;

/** Quantas retomadas pedem atenção hoje (follow-ups vencidos + retrabalhos de hoje + atrasados). */
export function useRetomadaContagem(enabled = true) {
  const fn = useServerFn(getRetomadaContagem);
  return useQuery({
    queryKey: RETOMADA_CONTAGEM_KEY,
    queryFn: () => fn({}),
    enabled,
    staleTime: 30_000,
    // Enquanto a Omnia estiver aberta, confere a cada minuto (aviso de follow-up e contagem).
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}

export function useRetomadaBase() {
  const fn = useServerFn(getRetomadaBase);
  return useQuery({ queryKey: RETOMADA_BASE_KEY, queryFn: () => fn({}), staleTime: 15_000 });
}
