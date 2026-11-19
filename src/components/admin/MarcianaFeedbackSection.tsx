import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminListNegativeFeedback,
  adminMarkFeedbackResolved,
  adminFeedbackCounts,
} from "@/lib/marciana-feedback.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThumbsDown, ThumbsUp, MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackRow = {
  id: string;
  motivos: string[];
  comentario: string | null;
  created_at: string;
  resolvido_em: string | null;
  quem: string;
  pergunta: string | null;
  resposta: string;
  conversation_id: string | null;
};

const MOTIVOS = [
  "Informação errada",
  "Incompleta",
  "Desatualizada",
  "Não entendeu minha pergunta",
  "Não serviu para o cliente",
];

// Dentro do Admin > IA/MarcIAna: lista os 👎 (mais recentes primeiro) e um
// contador simples de 👍/👎 dos últimos 30 dias.
export function MarcianaFeedbackSection() {
  const listFn = useServerFn(adminListNegativeFeedback);
  const resolveFn = useServerFn(adminMarkFeedbackResolved);
  const countsFn = useServerFn(adminFeedbackCounts);
  const qc = useQueryClient();

  const [motivoFiltro, setMotivoFiltro] = useState<string>("todos");

  const q = useQuery({ queryKey: ["marciana-feedback-negativo"], queryFn: () => listFn({}) });
  const countsQ = useQuery({ queryKey: ["marciana-feedback-counts"], queryFn: () => countsFn({}) });

  const resolveMut = useMutation({
    mutationFn: (v: { id: string; resolvido: boolean }) => resolveFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marciana-feedback-negativo"] }),
  });

  const rows = ((q.data ?? []) as unknown as FeedbackRow[]).filter(
    (r) => motivoFiltro === "todos" || r.motivos.includes(motivoFiltro),
  );
  const counts = countsQ.data as { util: number; naoUtil: number } | undefined;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-gold-text" /> Perguntas sem boa resposta
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Respostas marcadas como não úteis pelos atendentes, mais recentes primeiro.
          </p>
        </div>
        {counts && (
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <ThumbsUp className="h-3.5 w-3.5 text-gold-text" /> {counts.util}
            </span>
            <span className="flex items-center gap-1.5">
              <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" /> {counts.naoUtil}
            </span>
            <span className="text-muted-foreground text-xs">últimos 30 dias</span>
          </div>
        )}
      </div>

      <Select value={motivoFiltro} onValueChange={setMotivoFiltro}>
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os motivos</SelectItem>
          {MOTIVOS.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-3">
        {rows.length === 0 && !q.isLoading && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum feedback negativo por aqui.
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className={cn(
              "rounded-md border border-border p-3 space-y-2",
              r.resolvido_em && "opacity-60",
            )}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
              <span>
                {r.quem} · {new Date(r.created_at).toLocaleString("pt-BR")}
              </span>
              <Button
                size="sm"
                variant={r.resolvido_em ? "ghost" : "outline"}
                className="h-6 text-xs"
                onClick={() => resolveMut.mutate({ id: r.id, resolvido: !r.resolvido_em })}
              >
                {r.resolvido_em ? "Reabrir" : "Marcar como resolvida"}
              </Button>
            </div>
            {r.pergunta && (
              <p className="text-sm">
                <strong>Pergunta:</strong> {r.pergunta}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              <strong>Resposta:</strong> {r.resposta.slice(0, 300)}
            </p>
            {r.motivos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {r.motivos.map((m) => (
                  <Badge key={m} variant="secondary">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
            {r.comentario && (
              <p className="text-sm italic text-muted-foreground">"{r.comentario}"</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
