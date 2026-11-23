import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDuvidas, registerDuvidaCopy } from "@/lib/duvidas.functions";

export interface Duvida {
  id: string; tema: string; pergunta: string; resposta: string;
  status: "rascunho" | "publicada"; origem: "manual" | "marciana"; position: number; copias_count: number;
}

/** Só as publicadas (o banco já filtra para o atendente; o filtro aqui vale também para o admin). */
export function useDuvidasPublicadas() {
  const fn = useServerFn(listDuvidas);
  const q = useQuery({ queryKey: ["duvidas"], queryFn: () => fn({}), staleTime: 60_000, retry: false });
  const duvidas = useMemo(
    () => ((q.data ?? []) as Duvida[]).filter((d) => d.status === "publicada"),
    [q.data],
  );
  return { duvidas, isLoading: q.isLoading, isError: q.isError };
}

export function useCountDuvidaCopy() {
  const fn = useServerFn(registerDuvidaCopy);
  return (id: string) => { fn({ data: { id } }).catch(() => {}); };
}
