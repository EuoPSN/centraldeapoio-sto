import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBibliotecaConversas, getFichasDasRetomadas } from "@/lib/biblioteca.functions";

export const BIBLIOTECA_CONVERSAS_KEY = ["biblioteca-conversas"] as const;
export const FICHAS_RETOMADAS_KEY = ["fichas-das-retomadas"] as const;

export function useBibliotecaConversas() {
  const fn = useServerFn(getBibliotecaConversas);
  return useQuery({ queryKey: BIBLIOTECA_CONVERSAS_KEY, queryFn: () => fn({}), staleTime: 30_000 });
}

/** Estado das fichas que o atendente enviou, por ticket. */
export function useFichasDasRetomadas() {
  const fn = useServerFn(getFichasDasRetomadas);
  return useQuery({ queryKey: FICHAS_RETOMADAS_KEY, queryFn: () => fn({}), staleTime: 15_000 });
}
