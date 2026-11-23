import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RoteirosView, type RoteiroItem } from "@/components/scripts/RoteirosView";
import { AudioPlayer } from "@/components/scripts/AudioPlayer";
import { AUDIO_BUCKET } from "@/components/retomada/AudioExemplo";
import { listRoteirosAudio } from "@/lib/roteiros.functions";
import { CATEGORIAS_AUDIO } from "@/lib/roteiros";
import { ETAPA_LABEL, PONTO_LABEL } from "@/lib/retomada";

type Search = { item?: string };

export const Route = createFileRoute("/_authenticated/scripts/roteiros-audio")({
  validateSearch: (s: Record<string, unknown>): Search => ({ item: typeof s.item === "string" && s.item ? s.item : undefined }),
  component: RoteirosAudioPage,
});

interface Linha { id: string; titulo: string; categoria: string; situacao: string; texto: string; dicas: string[]; audio_url: string | null; duracao: string | null; status: string }
interface Cad { id: string; ponto_parada: keyof typeof PONTO_LABEL; etapa: keyof typeof ETAPA_LABEL; texto: string; por_que: string; audio_exemplo_url: string | null }

function RoteirosAudioPage() {
  const { item } = Route.useSearch();
  const navigate = Route.useNavigate();
  const fn = useServerFn(listRoteirosAudio);
  const q = useQuery({ queryKey: ["roteiros-audio"], queryFn: () => fn({}), staleTime: 60_000 });
  const [grupo, setGrupo] = useState("Todos");

  const { itens, grupos } = useMemo(() => {
    const proprios: RoteiroItem[] = ((q.data?.roteiros ?? []) as Linha[])
      .filter((r) => r.status === "publicada")
      .map((r) => ({
        id: r.id, grupo: r.categoria, titulo: r.titulo, situacao: r.situacao, texto: r.texto, dicas: r.dicas ?? [],
        extra: r.audio_url ? <AudioPlayer bucket="roteiros-audio" path={r.audio_url} duracao={r.duracao} /> : undefined,
      }));
    // Áudios da cadência de retomada: só leitura, sem duplicar o conteúdo.
    const cadencia: RoteiroItem[] = ((q.data?.cadencia ?? []) as Cad[]).map((c) => ({
      id: `cad-${c.id}`,
      grupo: "Retomada",
      titulo: `Retomada ${ETAPA_LABEL[c.etapa] ?? c.etapa} · ${PONTO_LABEL[c.ponto_parada] ?? c.ponto_parada}`,
      situacao: c.por_que,
      texto: c.texto,
      dicas: [],
      somenteLeitura: true,
      extra: c.audio_exemplo_url ? <AudioPlayer bucket={AUDIO_BUCKET} path={c.audio_exemplo_url} /> : undefined,
      acoes: (
        <Link
          to="/retomar"
          className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface px-[18px] text-[15px] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Ver mensagem de texto do {ETAPA_LABEL[c.etapa] ?? c.etapa}
        </Link>
      ),
    }));
    const todos = [...cadencia, ...proprios];
    const extras = [...new Set(todos.map((t) => t.grupo))].filter((g) => !(CATEGORIAS_AUDIO as readonly string[]).includes(g));
    const base = (CATEGORIAS_AUDIO as readonly string[]).filter((g) => todos.some((t) => t.grupo === g));
    return { itens: todos, grupos: [...base, ...extras] };
  }, [q.data]);

  return (
    <RoteirosView
      titulo="Roteiros de áudio"
      breadcrumb="Roteiros de áudio"
      grupos={grupos}
      grupoAtivo={grupo}
      onGrupo={setGrupo}
      itens={itens}
      selecionadoId={item}
      onSelecionar={(id) => navigate({ search: { item: id }, replace: true })}
      carregando={q.isLoading}
      vazio={{ titulo: "Ainda não há roteiros de áudio publicados.", dica: "Quando forem publicados no Painel Admin, aparecem aqui." }}
      rotuloDicas="Dicas de voz"
      tour="roteirosaudio"
    />
  );
}
