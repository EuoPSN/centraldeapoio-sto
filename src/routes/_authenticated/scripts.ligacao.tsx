import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RoteirosView, type RoteiroItem } from "@/components/scripts/RoteirosView";
import { supabase } from "@/integrations/supabase/client";
import { listRoteirosLigacao } from "@/lib/roteiros.functions";
import { ETAPAS_LIGACAO } from "@/lib/roteiros";

type Search = { item?: string };

export const Route = createFileRoute("/_authenticated/scripts/ligacao")({
  validateSearch: (s: Record<string, unknown>): Search => ({ item: typeof s.item === "string" && s.item ? s.item : undefined }),
  // Enquanto a chave estiver desligada, o atendente volta para Scripts. (O banco também esconde os
  // roteiros dele: a política de leitura de roteiros_ligacao exige a chave ligada.)
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    if (roles?.some((r) => r.role === "admin")) return;
    const { data, error } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { valor: boolean } | null; error: unknown }> } } } })
      .from("recursos_config").select("valor").eq("chave", "scripts_ligacao_liberado").maybeSingle();
    if (error || !data?.valor) throw redirect({ to: "/scripts", replace: true });
  },
  component: LigacaoPage,
});

interface Linha { id: string; titulo: string; etapa: string; situacao: string; texto: string; dicas: string[]; status: string }

function LigacaoPage() {
  const { item } = Route.useSearch();
  const navigate = Route.useNavigate();
  const fn = useServerFn(listRoteirosLigacao);
  const q = useQuery({ queryKey: ["roteiros-ligacao"], queryFn: () => fn({}), staleTime: 60_000 });
  const [grupo, setGrupo] = useState("Todos");

  const itens: RoteiroItem[] = useMemo(
    () => ((q.data ?? []) as Linha[])
      .filter((r) => r.status === "publicada")
      .map((r) => ({ id: r.id, grupo: r.etapa, titulo: r.titulo, situacao: r.situacao, texto: r.texto, dicas: r.dicas ?? [] })),
    [q.data],
  );
  const grupos = (ETAPAS_LIGACAO as readonly string[]).filter((g) => itens.some((i) => i.grupo === g));

  return (
    <RoteirosView
      titulo="Scripts de ligação"
      breadcrumb="Scripts de ligação"
      grupos={grupos}
      grupoAtivo={grupo}
      onGrupo={setGrupo}
      itens={itens}
      selecionadoId={item}
      onSelecionar={(id) => navigate({ search: { item: id }, replace: true })}
      carregando={q.isLoading}
      vazio={{ titulo: "Ainda não há scripts de ligação publicados.", dica: "Publique no Painel Admin → Scripts de ligação." }}
      rotuloDicas="Dicas da ligação"
      ancoras={{ filtros: "scriptsligacao-1", lista: "scriptsligacao-2", texto: "scriptsligacao-3", copiar: "scriptsligacao-4" }}
    />
  );
}
