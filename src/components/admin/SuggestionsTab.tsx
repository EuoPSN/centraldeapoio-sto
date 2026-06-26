import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listSuggestions, updateSuggestionStatus, deleteSuggestion } from "@/lib/suggestions.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS = [
  { v: "pendente", label: "Pendente" },
  { v: "em_analise", label: "Em análise" },
  { v: "implementado", label: "Implementado" },
  { v: "rejeitado", label: "Rejeitado" },
];

export function SuggestionsTab() {
  const list = useServerFn(listSuggestions);
  const upd = useServerFn(updateSuggestionStatus);
  const del = useServerFn(deleteSuggestion);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["all-suggestions"], queryFn: () => list({ data: { all: true } }) });

  const [responses, setResponses] = useState<Record<string, string>>({});

  const updMut = useMutation({
    mutationFn: (v: { id: string; status: string; admin_response?: string | null }) => upd({ data: v as { id: string; status: "pendente" | "em_analise" | "implementado" | "rejeitado"; admin_response?: string | null } }),
    onSuccess: () => { toast.success("Atualizada."); qc.invalidateQueries({ queryKey: ["all-suggestions"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removida."); qc.invalidateQueries({ queryKey: ["all-suggestions"] }); },
  });

  return (
    <div className="space-y-3">
      {q.isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {(q.data ?? []).length === 0 && <Card className="p-10 text-center text-muted-foreground">Nenhuma sugestão.</Card>}
      {(q.data ?? []).map((s: { id: string; title: string; description: string; status: string; category: string; admin_response: string | null; created_at: string; profile: { display_name: string | null; email: string } | null }) => (
        <Card key={s.id} className="p-4">
          <div className="flex justify-between items-start gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge>{s.category}</Badge>
                <span className="text-xs text-muted-foreground">
                  {s.profile?.display_name ?? s.profile?.email ?? "—"} · {new Date(s.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <h3 className="font-semibold mt-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{s.description}</p>
            </div>
            <div className="flex flex-col gap-2 w-48 shrink-0">
              <Select value={s.status} onValueChange={(v) => updMut.mutate({ id: s.id, status: v, admin_response: s.admin_response })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((x) => <SelectItem key={x.v} value={x.v}>{x.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(s.id)} className="gap-2">
                <Trash2 className="h-4 w-4 text-destructive" /> Excluir
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <Textarea
              placeholder="Resposta para o autor (opcional)..."
              rows={2}
              defaultValue={s.admin_response ?? ""}
              onChange={(e) => setResponses((r) => ({ ...r, [s.id]: e.target.value }))}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="outline" onClick={() => updMut.mutate({ id: s.id, status: s.status, admin_response: responses[s.id] ?? s.admin_response })}>
                Salvar resposta
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
