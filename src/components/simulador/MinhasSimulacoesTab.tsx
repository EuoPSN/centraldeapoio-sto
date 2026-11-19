import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";
import { getMyHistory } from "@/lib/gamification.functions";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill } from "@/components/Pill";
import { DIFFICULTY_DOT_CLASSES, DIFFICULTY_LABELS, DIFFICULTY_TEXT_CLASSES } from "@/components/simulador/difficulty";
import { AvaliacaoScreen } from "@/components/simulador/AvaliacaoScreen";

export function MinhasSimulacoesTab() {
  const [tipo, setTipo] = useState<"atendimento" | "problema">("atendimento");
  const [selecionado, setSelecionado] = useState<any>(null);

  const historyFn = useServerFn(getMyHistory);
  const historyQ = useQuery({ queryKey: ["my-history", tipo], queryFn: () => historyFn({ data: { tipo } }) });
  const data = historyQ.data as any;

  const evolucao = (data?.evolucao ?? []) as { nota: number; created_at: string }[];
  const chartData = evolucao.map((e, i) => ({ idx: i + 1, nota: e.nota }));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Pill active={tipo === "atendimento"} onClick={() => setTipo("atendimento")}>Atendimentos</Pill>
        <Pill active={tipo === "problema"} onClick={() => setTipo("problema")}>Solução de problemas</Pill>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-3xl font-semibold">{data?.total ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Simulações</p>
        </Card>
        <Card className="p-4">
          <p className="text-3xl font-semibold">{data?.media ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Média geral</p>
        </Card>
        <Card className="p-4">
          <p className="text-3xl font-semibold">{data?.melhor ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Melhor nota</p>
        </Card>
        <Card className="p-4">
          <p className="text-lg font-semibold truncate">{data?.maisUsado || "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">Mais treinado</p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="type-overline text-muted-foreground mb-2">Evolução · últimas 10 simulações</p>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma simulação ainda. Comece pelo Treine este hoje.</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <YAxis hide domain={[0, 100]} />
                {data?.metaNota != null && (
                  <ReferenceLine y={data.metaNota} stroke="var(--line-strong)" strokeDasharray="4 4"
                    label={{ value: `meta ${data.metaNota}`, position: "insideTopLeft", fill: "var(--ink-muted)", fontSize: 11 }} />
                )}
                <Line type="monotone" dataKey="nota" stroke="var(--gold)" strokeWidth={2}
                  dot={{ r: 4, fill: "var(--gold)", strokeWidth: 0 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[120px_1fr_120px_80px_80px] gap-2 px-4 py-2 type-overline text-muted-foreground border-b">
          <span>Data</span><span>Cliente</span><span>Dificuldade</span><span>Nota</span><span />
        </div>
        {(data?.results ?? []).length === 0 && (
          <p className="text-center text-muted-foreground p-8 text-sm">Nenhuma simulação ainda. Comece pelo Treine este hoje.</p>
        )}
        {(data?.results ?? []).map((r: any) => (
          <button key={r.id} onClick={() => setSelecionado(r)}
            className="w-full grid grid-cols-[120px_1fr_120px_80px_80px] gap-2 items-center px-4 h-[50px] text-left text-sm hover:bg-muted/50 transition border-b last:border-0">
            <span className="text-muted-foreground text-xs">
              {new Date(r.created_at).toLocaleDateString("pt-BR")} · {new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="font-medium truncate">{r.profile_name}</span>
            <span className={`flex items-center gap-1.5 ${DIFFICULTY_TEXT_CLASSES[r.difficulty] ?? ""}`}>
              <span className={`h-2 w-2 rounded-full ${DIFFICULTY_DOT_CLASSES[r.difficulty] ?? "bg-muted-foreground"}`} />
              {DIFFICULTY_LABELS[r.difficulty] ?? r.difficulty}
            </span>
            <span className="font-semibold">{r.nota}</span>
            <span className="text-gold-text font-medium">Ver →</span>
          </button>
        ))}
      </Card>

      <Dialog open={!!selecionado} onOpenChange={() => setSelecionado(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selecionado && (
            <>
              <DialogHeader>
                <DialogTitle>{selecionado.profile_name} — {new Date(selecionado.created_at).toLocaleDateString("pt-BR")}</DialogTitle>
              </DialogHeader>
              <AvaliacaoScreen
                avaliacao={selecionado}
                xpGanho={null}
                melhorNota={null}
                nomePerfil={selecionado.profile_name}
                resumoPersonalidade=""
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
