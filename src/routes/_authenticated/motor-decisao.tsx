import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMotors, getMotorFull } from "@/lib/motor-decisao.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ChevronRight, RotateCcw, CheckCircle2, FileText, MessageSquare, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/motor-decisao")({
  component: Page,
});

function Page() {
  const listFn = useServerFn(listMotors);
  const getFullFn = useServerFn(getMotorFull);

  const [selectedMotor, setSelectedMotor] = useState<any>(null);
  const [motorData, setMotorData] = useState<any>(null);
  const [currentNode, setCurrentNode] = useState<any>(null);
  const [history, setHistory] = useState<{ node: any; answer: string }[]>([]);
  const [result, setResult] = useState<any>(null);

  const motorsQ = useQuery({
    queryKey: ["motors"],
    queryFn: () => listFn(),
  });
  const motors = (motorsQ.data ?? []) as any[];
  const activeMotors = motors.filter((m) => m.is_active);

  const startMotor = async (motor: any) => {
    const data = await getFullFn({ data: { motorId: motor.id } });
    const startNode = data.nodes.find((n: any) => n.is_start) ?? data.nodes[0];
    setSelectedMotor(motor);
    setMotorData(data);
    setCurrentNode(startNode);
    setHistory([]);
    setResult(null);
  };

  const handleAnswer = (edge: any) => {
    if (!motorData) return;
    setHistory((h) => [...h, { node: currentNode, answer: edge.label }]);
    const next = motorData.nodes.find((n: any) => n.id === edge.to_node_id);
    if (!next) return;
    if (next.type === "result") {
      setResult(next);
      setCurrentNode(null);
    } else {
      setCurrentNode(next);
    }
  };

  const reset = () => {
    setSelectedMotor(null);
    setMotorData(null);
    setCurrentNode(null);
    setHistory([]);
    setResult(null);
  };

  const currentEdges = motorData?.edges.filter((e: any) => e.from_node_id === currentNode?.id) ?? [];

  if (!selectedMotor) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" /> Motor de Decisão
          </h1>
          <p className="text-muted-foreground text-sm">Selecione um processo para ser guiado até a decisão correta.</p>
        </div>
        {activeMotors.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">
            Nenhum motor de decisão cadastrado ainda. Peça para o administrador criar um.
          </Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeMotors.map((m) => (
            <Card key={m.id} className="p-4 cursor-pointer hover:border-primary/40 transition space-y-2"
              onClick={() => startMotor(m)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{m.name}</h3>
                  {m.category && <Badge variant="outline" className="text-xs mt-1">{m.category}</Badge>}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              </div>
              {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> {selectedMotor.name}
          </h1>
          {selectedMotor.category && <Badge variant="outline" className="text-xs">{selectedMotor.category}</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Reiniciar
        </Button>
      </div>

      {history.length > 0 && (
        <Card className="p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Caminho percorrido</p>
          {history.map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              <span className="text-muted-foreground truncate">{h.node.title}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-primary">{h.answer}</span>
            </div>
          ))}
        </Card>
      )}

      {currentNode && !result && (
        <Card className="p-6 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pergunta {history.length + 1}</p>
            <h2 className="text-lg font-semibold">{currentNode.title}</h2>
          </div>
          {currentEdges.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma opção configurada para esta pergunta.</p>
          )}
          <div className="grid gap-2">
            {currentEdges.map((edge: any) => (
              <Button key={edge.id} variant="outline" className="justify-start h-auto py-3 px-4 text-left"
                onClick={() => handleAnswer(edge)}>
                <ChevronRight className="h-4 w-4 mr-2 flex-shrink-0" />
                {edge.label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-6 space-y-4 border-emerald-200 bg-emerald-50/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-emerald-800">{result.title}</h2>
          </div>
          {result.processo && (
            <div className="bg-background rounded-lg p-4 border space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <FileText className="h-3 w-3" /> Processo a seguir
              </p>
              <p className="text-sm whitespace-pre-line">{result.processo}</p>
            </div>
          )}
          {result.mensagem && (
            <div className="bg-background rounded-lg p-4 border space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Mensagem recomendada
              </p>
              <p className="text-sm whitespace-pre-line">{result.mensagem}</p>
            </div>
          )}
          {result.documentos && (
            <div className="bg-background rounded-lg p-4 border space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <FileText className="h-3 w-3" /> Documentos necessários
              </p>
              <p className="text-sm whitespace-pre-line">{result.documentos}</p>
            </div>
          )}
          {result.orientacoes && (
            <div className="bg-background rounded-lg p-4 border space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Orientações
              </p>
              <p className="text-sm whitespace-pre-line">{result.orientacoes}</p>
            </div>
          )}
          {result.observacoes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-1">
              <p className="text-xs font-semibold text-yellow-700 uppercase">⚠️ Observações</p>
              <p className="text-sm text-yellow-800 whitespace-pre-line">{result.observacoes}</p>
            </div>
          )}
          <Button onClick={reset} variant="outline" className="gap-2 w-full">
            <RotateCcw className="h-4 w-4" /> Nova consulta
          </Button>
        </Card>
      )}
    </div>
  );
}
