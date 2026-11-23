import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/content.functions";
import { getRecursos } from "@/lib/roteiros.functions";

/** Quem vê os Scripts de ligação: admin sempre; atendente só com a chave "Liberar para a equipe" ligada. */
export function useAcessoLigacao() {
  const meFn = useServerFn(getMe);
  const recFn = useServerFn(getRecursos);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn({}) });
  const rec = useQuery({ queryKey: ["recursos"], queryFn: () => recFn({}), staleTime: 30_000 });
  const isAdmin = me.data?.isAdmin ?? false;
  const liberado = rec.data?.scripts_ligacao_liberado ?? false;
  return { isAdmin, liberado, podeVer: isAdmin || liberado, isLoading: me.isLoading || rec.isLoading };
}
