import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFlowGraph } from "@/lib/flow-graph.functions";
import { startSimSession, finishSimSession } from "@/lib/simulator.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/CopyButton";
import { RotateCcw, CheckCircle2, GraduationCap } from "lucide-react";

interface NodeRow {
  id: string; node_type: string; title: string; message: string | null; note: string | null;
  color: string | null;
}
interface EdgeRow {
  id: string; source_node_id: string; target_node_id: string; label: string | null;
}

function labelFor(t: string) {
  return ({
    start: "Início", step: "Etapa", question: "Pergunta",
    objection: "Objeção", script: "Script", end: "Encerramento",
    answer: "Resposta", action: "Ação",
  } as Record<string, string>)[t] ?? t;
}

export function SimulatorRunner({ flowId }: { flowId: string }) {
  const getFn = useServerFn(getFlowGraph);
  const startFn = useServerFn(startSimSession);
  const finishFn = useServerFn(finishSimSession);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["flow-graph", flowId], queryFn: () => getFn({ data: { id: flowId } }) });

  const nodes = (q.data?.nodes ?? []) as NodeRow[];
  const edges = (q.data?.edges ?? []) as EdgeRow[];

  // Acha nó inicial: tipo "start" se existir; senão, nó sem inbound edges; senão, o primeiro
  const startId = useMemo(() => {
    if (!nodes.length) return null;
    const startNode = nodes.find((n) => n.node_type === "start");
    if (startNode) return startNode.id;
    const targets = new Set(edges.map((e) => e.target_node_id));
    const roots = nodes.filter((n) => !targets.has(n.id));
    return (roots[0] ?? nodes[0]).id;
  }, [nodes, edges]);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [path, setPath] = useState<Array<{ node_id: string; title: string }>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const startMut = useMutation({
    mutationFn: () => startFn({ data: { flow_id: flowId } }),
    onSuccess: (r) => setSessionId(r.id),
  });

  useEffect(() => {
    if (startId && !sessionId) {
      setCurrentId(startId);
      startMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startId]);

  const current = currentId ? nodes.find((n) => n.id === currentId) : null;
  const outgoing = current ? edges.filter((e) => e.source_node_id === current.id) : [];
  const finished = current && outgoing.length === 0;

  const choose = (edge: EdgeRow) => {
    const next = nodes.find((n) => n.id === edge.target_node_id);
    if (!next) return;
    setPath((p) => [...p, { node_id: next.id, title: `${edge.label ? edge.label + " → " : ""}${next.title}` }]);
    setCurrentId(next.id);
  };

  const reset = () => {
    setPath([]);
    setCurrentId(startId);
    if (sessionId) finishFn({ data: { id: sessionId, path } }).catch(() => undefined);
    startMut.mutate();
    qc.invalidateQueries({ queryKey: ["flow-graph", flowId] });
  };

  useEffect(() => {
    if (finished && sessionId) {
      finishFn({ data: { id: sessionId, path } }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (q.isLoading) return <p className="text-muted-foreground">Carregando cenário...</p>;
  if (!nodes.length) return <Card className="p-10 text-center text-muted-foreground">Cenário vazio. Cadastre blocos na Central de Fluxos.</Card>;
  if (!current) return null;

  const color = current.color || "#10b981";

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Simulação em andamento</h2>
        </div>
        <Button size="sm" variant="outline" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Reiniciar
        </Button>
      </div>

      {path.length > 0 && (
        <div className="mb-4 text-xs text-muted-foreground">
          Caminho: {path.map((p) => p.title).join(" → ")}
        </div>
      )}

      <Card className="p-4 mb-4 border-l-4" style={{ borderLeftColor: color }}>
        <Badge variant="secondary" style={{ background: color + "20", color }}>{labelFor(current.node_type)}</Badge>
        <h3 className="font-semibold mt-2">{current.title}</h3>
        {current.message && (
          <div className="mt-3 flex gap-2 items-start">
            <div className="flex-1 rounded-md bg-muted/40 border border-border p-3 text-sm whitespace-pre-wrap">{current.message}</div>
            <CopyButton text={current.message} />
          </div>
        )}
        {current.note && <p className="text-xs text-muted-foreground italic mt-2">💡 {current.note}</p>}
      </Card>

      {!finished ? (
        <div>
          <p className="text-sm font-medium mb-2">O que acontece em seguida?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {outgoing.map((e) => {
              const next = nodes.find((n) => n.id === e.target_node_id);
              if (!next) return null;
              return (
                <Button key={e.id} variant="outline" className="justify-start h-auto py-3 text-left whitespace-normal"
                  onClick={() => choose(e)}>
                  <div className="flex flex-col items-start gap-1 w-full">
                    {e.label && <Badge variant="secondary" className="text-[10px]">{e.label}</Badge>}
                    <span className="text-sm font-medium">{next.title}</span>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="p-6 text-center bg-emerald-500/5 border-emerald-500/30">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600 mb-2" />
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">Atendimento finalizado!</p>
          <p className="text-sm text-muted-foreground mt-1">Você percorreu {path.length + 1} etapa(s). Clique em Reiniciar para treinar de novo.</p>
        </Card>
      )}
    </Card>
  );
}
