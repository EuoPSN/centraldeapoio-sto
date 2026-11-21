import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getNovidades, getStatusMudancas } from "@/lib/mudancas.functions";

export const STATUS_MUDANCAS_KEY = ["mudancas-status"] as const;
export const NOVIDADES_KEY = ["novidades"] as const;

/** Mudanças importantes pendentes (faixa do Início, bolinha do menu e notificação das urgentes). */
export function useStatusMudancas(enabled = true) {
  const fn = useServerFn(getStatusMudancas);
  return useQuery({
    queryKey: STATUS_MUDANCAS_KEY,
    queryFn: () => fn({}),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 600_000,
  });
}

export function useNovidades() {
  const fn = useServerFn(getNovidades);
  return useQuery({ queryKey: NOVIDADES_KEY, queryFn: () => fn({}) });
}
