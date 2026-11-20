import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContent } from "@/lib/content.functions";
import { listChangelog } from "@/lib/changelog.functions";
import { normalize } from "@/components/scripts/shared";

export interface AjudaSearchResult {
  id: string;
  title: string;
  tipo: "Procedimento" | "Problema técnico" | "Novidade";
  to: string;
  search?: Record<string, unknown>;
}

/** Carrega procedimentos, problemas técnicos e novidades para a busca da Central de Ajuda. */
export function useAjudaSearchData() {
  const contentFn = useServerFn(listContent);
  const changelogFn = useServerFn(listChangelog);

  const procedimentos = useQuery({
    queryKey: ["content", "tutoriais"],
    queryFn: () => contentFn({ data: { section: "tutoriais" } }),
  });
  const problemas = useQuery({
    queryKey: ["content", "problemas"],
    queryFn: () => contentFn({ data: { section: "problemas" } }),
  });
  const novidades = useQuery({ queryKey: ["changelog"], queryFn: () => changelogFn({}) });

  const isLoading = procedimentos.isLoading || problemas.isLoading || novidades.isLoading;
  return { procedimentos: procedimentos.data ?? [], problemas: problemas.data ?? [], novidades: novidades.data ?? [], isLoading };
}

interface ContentRow { id: string; title: string; content: string }
interface ChangelogRow { id: string; title: string; summary: string; published: boolean }

export function useAjudaSearchResults(
  query: string,
  data: { procedimentos: ContentRow[]; problemas: ContentRow[]; novidades: ChangelogRow[] },
): AjudaSearchResult[] {
  return useMemo(() => {
    const n = normalize(query.trim());
    if (!n) return [];
    const matches = (r: ContentRow) => normalize(r.title).includes(n) || normalize(r.content).includes(n);

    const out: AjudaSearchResult[] = [];
    for (const r of data.procedimentos.filter(matches)) {
      out.push({ id: r.id, title: r.title, tipo: "Procedimento", to: "/ajuda/procedimentos", search: { artigo: r.id } });
    }
    for (const r of data.problemas.filter(matches)) {
      out.push({ id: r.id, title: r.title, tipo: "Problema técnico", to: "/ajuda/problemas", search: { artigo: r.id } });
    }
    for (const r of data.novidades.filter((e) => e.published && (normalize(e.title).includes(n) || normalize(e.summary).includes(n)))) {
      out.push({ id: r.id, title: r.title, tipo: "Novidade", to: "/ajuda/novidades" });
    }
    return out.slice(0, 20);
  }, [query, data]);
}
