import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listProblemScenarios, upsertProblemScenario, deleteProblemScenario,
} from "@/lib/problemscenarios.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { DIFFICULTY_LABELS } from "@/components/SimuladorIA";

interface ScenarioRow {
  id: string; name: string; enredo: string; personalidade: string; solucao_esperada: string;
  difficulty: string; category_id: string | null; category?: { id: string; name: string } | null;
}

export function ProblemScenariosTab() {
  const list = useServerFn(listProblemScenarios);
  const upsert = useServerFn(upsertProblemScenario);
  const del = useServerFn(deleteProblemScenario);
  const catFn = useServerFn(listCategories);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["problem-scenarios"], queryFn: () => list({}) });
  const catsQ = useQuery({ queryKey: ["cats", "problema"], queryFn: () => catFn({ data: { scope: "problema" } }) });
  const scenarios = (q.data ?? []) as ScenarioRow[];
  const categories = (catsQ.data ?? []) as { id: string; name: string }[];

  const [edit, setEdit] = useState<null | {
    id?: string; category_id: string; name: string; enredo: string;
    personalidade: string; solucao_esperada: string; difficulty: string;
  }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: { ...edit!, category_id: edit!.category_id || null } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["problem-scenarios"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["problem-scenarios"] }); },
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> Situações-Problema ({scenarios.length})
        </h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({
          category_id: "", name: "", enredo: "", personalidade: "", solucao_esperada: "", difficulty: "medio",
        })}>
          <Plus className="h-4 w-4" /> Novo cenário
        </Button>
      </div>
      <p className="px-4 pt-3 text-sm text-muted-foreground">
        O atendente lê o "enredo" antes de começar, depois conduz o atendimento no chat até chegar na "solução esperada" —
        que fica escondida dele e é usada só pra IA avaliar no final.
      </p>
      <div className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Cenário</TableHead><TableHead>Categoria</TableHead><TableHead>Dificuldade</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {scenarios.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.category?.name ? <Badge variant="secondary">{s.category.name}</Badge> : "—"}</TableCell>
                <TableCell>{DIFFICULTY_LABELS[s.difficulty] ?? s.difficulty}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => setEdit({
                    id: s.id, category_id: s.category_id ?? "", name: s.name, enredo: s.enredo,
                    personalidade: s.personalidade, solucao_esperada: s.solucao_esperada, difficulty: s.difficulty,
                  })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm(`Excluir "${s.name}"?`) && delMut.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {scenarios.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum cenário cadastrado ainda.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar cenário" : "Novo cenário"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome do cliente/caso</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ex: João, cobrança duplicada" /></div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={edit.category_id || "none"} onValueChange={(v) => setEdit({ ...edit, category_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Dificuldade</Label>
                <Select value={edit.difficulty} onValueChange={(v) => setEdit({ ...edit, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIFFICULTY_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Enredo — o que aconteceu (o atendente lê isso antes de começar)</Label>
                <Textarea rows={5} value={edit.enredo} onChange={(e) => setEdit({ ...edit, enredo: e.target.value })}
                  placeholder="Ex: O cliente pagou a adesão do Refuturiza há 3 dias, mas o acesso à plataforma nunca chegou por e-mail. Ele já tentou de novo e continua sem acesso." />
              </div>
              <div>
                <Label>Personalidade do cliente durante a conversa</Label>
                <Input value={edit.personalidade} onChange={(e) => setEdit({ ...edit, personalidade: e.target.value })}
                  placeholder="Ex: Educado mas impaciente, já ligou duas vezes antes" />
              </div>
              <div>
                <Label>Solução esperada (fica escondida do atendente — só a IA usa pra avaliar)</Label>
                <Textarea rows={4} value={edit.solucao_esperada} onChange={(e) => setEdit({ ...edit, solucao_esperada: e.target.value })}
                  placeholder="Ex: Confirmar o CPF e reenviar o e-mail de acesso manualmente pelo painel do Refuturiza; se não resolver, abrir chamado pro suporte técnico do parceiro." />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
