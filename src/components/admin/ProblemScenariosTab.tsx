import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listProblemScenarios, upsertProblemScenario, deleteProblemScenario,
} from "@/lib/problemscenarios.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Wrench, Sparkles, FlaskConical } from "lucide-react";
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

  // ---- Gerar cenário com IA ----
  const genAI = useServerFn(simulatorChat);
  const [genOpen, setGenOpen] = useState(false);
  const [genCategoria, setGenCategoria] = useState("");
  const [genDescricao, setGenDescricao] = useState("");
  const [generating, setGenerating] = useState(false);

  const generateScenario = async () => {
    setGenerating(true);
    try {
      const categoriaNome = categories.find((c) => c.id === genCategoria)?.name || "Sem categoria";
      const prompt = `Você cria cenários de situação-problema para simulações de treinamento de atendimento de suporte do "Cartão de Todos" (cartão de descontos em saúde).

Categoria do problema: ${categoriaNome}
Descrição breve dada pelo administrador sobre este caso específico: "${genDescricao || "-"}"

Crie um cenário coerente com a categoria e a descrição dada. Responda APENAS com JSON válido, sem markdown e sem texto fora do JSON, neste formato exato:
{"nome_sugerido": "...", "enredo": "...", "personalidade": "...", "solucao_esperada": "..."}

- "nome_sugerido": nome curto do cliente/caso, ex: "Marcos - documento recusado no KYC".
- "enredo": 2 a 4 frases contando o que aconteceu com o cliente, com detalhe suficiente pra dar pra resolver na conversa.
- "personalidade": 1 frase de como o cliente reage/se comporta durante a conversa.
- "solucao_esperada": a resolução correta e específica pra esse caso, como um procedimento real que um atendente seguiria.`;

      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: "Gere o cenário." }], model: "google/gemini-2.5-flash" } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const created: any = await upsert({
        data: {
          category_id: genCategoria || null,
          name: parsed.nome_sugerido || "Novo cenário gerado por IA",
          difficulty: "medio",
          enredo: parsed.enredo || "",
          personalidade: parsed.personalidade || "",
          solucao_esperada: parsed.solucao_esperada || "",
        },
      });

      qc.invalidateQueries({ queryKey: ["problem-scenarios"] });
      setGenOpen(false);
      setGenDescricao("");
      setEdit({ ...created, category_id: created.category_id ?? "" });
      toast.success("Cenário gerado! Revise os campos — principalmente a solução esperada — antes de usar em simulação.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar cenário com IA.");
    } finally {
      setGenerating(false);
    }
  };

  // ---- Teste automático de estabilidade: IA joga como cliente E como atendente ----
  const testAI = useServerFn(simulatorChat);
  const [testOpen, setTestOpen] = useState(false);
  const [testScenarioName, setTestScenarioName] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testLog, setTestLog] = useState<{ role: "atendente" | "cliente"; text: string }[]>([]);
  const [testResult, setTestResult] = useState<null | { status: "sucesso" | "nao_resolveu"; diagnostico?: string }>(null);

  const runStabilityTest = async (s: ScenarioRow) => {
    setTestScenarioName(s.name);
    setTestOpen(true);
    setTestRunning(true);
    setTestLog([]);
    setTestResult(null);

    try {
      const clientePrompt = `Você é um cliente virtual chamado ${s.name}, cliente do Cartão de Todos.
O que aconteceu (só você sabe disso): ${s.enredo}
Como você se comporta: ${s.personalidade || "normal, educado"}.
A solução correta pro seu problema (NUNCA revele diretamente, só reaja quando o atendente chegar nela): ${s.solucao_esperada}.
Responda em JSON: {"resolvido": true ou false, "mensagens": ["fala curta 1", "fala curta 2"]}
"resolvido" só pode ser true quando o atendente já tiver proposto de fato a solução correta acima — nunca com base numa promessa vaga.`;

      const atendentePrompt = `Você é um atendente humano experiente de suporte do Cartão de Todos, conduzindo um atendimento real pelo WhatsApp.
Seu objetivo: entender o problema do cliente fazendo perguntas, e resolvê-lo com empatia e clareza, usando os procedimentos internos que você já domina.
Escreva sua próxima mensagem pro cliente (1-2 frases). Responda APENAS com o texto da mensagem, sem JSON, sem aspas.`;

      const log: { role: "atendente" | "cliente"; text: string }[] = [];
      const maxTurns = 10;
      let turns = 0;
      let resolvido = false;

      while (turns < maxTurns) {
        turns++;
        const historyForAtendente = log.map((l) => ({ role: l.role === "atendente" ? ("assistant" as const) : ("user" as const), content: l.text }));
        const { content: atendMsg } = await testAI({ data: { messages: [{ role: "system", content: atendentePrompt }, ...historyForAtendente], model: "google/gemini-2.5-flash" } });
        log.push({ role: "atendente", text: atendMsg.trim() });
        setTestLog([...log]);

        const historyForCliente = log.map((l) => ({ role: l.role === "atendente" ? ("user" as const) : ("assistant" as const), content: l.text }));
        const { content: clienteRaw } = await testAI({ data: { messages: [{ role: "system", content: clientePrompt }, ...historyForCliente], model: "google/gemini-2.5-flash" } });
        let falas: string[] = [];
        try {
          const parsed = JSON.parse(clienteRaw.replace(/```json|```/g, "").trim());
          resolvido = !!parsed.resolvido;
          falas = Array.isArray(parsed.mensagens) && parsed.mensagens.length > 0 ? parsed.mensagens : [String(parsed.mensagens ?? clienteRaw)];
        } catch {
          falas = [clienteRaw];
        }
        falas.forEach((f: string) => log.push({ role: "cliente", text: f }));
        setTestLog([...log]);

        if (resolvido) break;
      }

      if (resolvido) {
        setTestResult({ status: "sucesso" });
      } else {
        const transcript = log.map((l) => `${l.role === "atendente" ? "Atendente" : "Cliente"}: ${l.text}`).join("\n");
        const diagPrompt = `Leia esta simulação automática de atendimento que NÃO chegou na solução esperada ("${s.solucao_esperada}") depois de ${maxTurns} turnos. Em até 3 frases, diga o que provavelmente está mal definido no cenário (ex: enredo confuso, solução esperada específica ou pouco óbvia demais pela conversa, personalidade travando o diálogo). Seja direto, sem rodeios.\n\nTranscrição:\n${transcript}`;
        const { content } = await testAI({ data: { messages: [{ role: "user", content: diagPrompt }], model: "google/gemini-2.5-flash" } });
        setTestResult({ status: "nao_resolveu", diagnostico: content.trim() });
      }
    } catch (e) {
      setTestResult({ status: "nao_resolveu", diagnostico: e instanceof Error ? e.message : "Erro ao rodar o teste." });
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> Situações-Problema ({scenarios.length})
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenOpen(true)} className="gap-2"><Sparkles className="h-4 w-4" /> Gerar cenário com IA</Button>
          <Button size="sm" className="gap-2" onClick={() => setEdit({
            category_id: "", name: "", enredo: "", personalidade: "", solucao_esperada: "", difficulty: "medio",
          })}>
            <Plus className="h-4 w-4" /> Novo cenário
          </Button>
        </div>
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
                  <Button size="icon" variant="ghost" title="Testar estabilidade" onClick={() => runStabilityTest(s)}><FlaskConical className="h-4 w-4" /></Button>
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

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar cenário com IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoria</Label>
              <Select value={genCategoria || "none"} onValueChange={(v) => setGenCategoria(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descreva o caso em poucas palavras</Label>
              <Textarea rows={4} value={genDescricao} onChange={(e) => setGenDescricao(e.target.value)}
                placeholder="Ex: cliente pagou a adesão mas o cartão físico nunca chegou pelos Correios" />
            </div>
            <p className="text-xs text-muted-foreground">
              A IA usa a categoria e a descrição pra gerar enredo, personalidade e a solução esperada.
              Você vai poder revisar e ajustar tudo antes de salvar.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={generateScenario} disabled={generating}>
              {generating ? "Gerando..." : "Gerar cenário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testOpen} onOpenChange={(v) => !v && setTestOpen(false)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Teste de estabilidade — {testScenarioName}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            A IA joga dos dois lados: banca um atendente experiente (sem saber o gabarito) e banca o cliente do cenário,
            até ou chegar na solução esperada, ou esgotar as tentativas.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-md p-3 bg-muted/20">
            {testLog.length === 0 && testRunning && <p className="text-xs text-muted-foreground">Iniciando...</p>}
            {testLog.map((l, i) => (
              <div key={i} className={`flex ${l.role === "atendente" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-2 py-1.5 text-xs ${l.role === "atendente" ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                  <span className="font-medium opacity-70">{l.role === "atendente" ? "Atendente" : "Cliente"}: </span>{l.text}
                </div>
              </div>
            ))}
          </div>
          {testRunning && <p className="text-xs text-muted-foreground">Rodando teste...</p>}
          {testResult && (
            <Card className={`p-3 ${testResult.status === "sucesso" ? "bg-emerald-50 border-emerald-200" : "bg-yellow-50 border-yellow-200"}`}>
              {testResult.status === "sucesso" ? (
                <p className="text-sm text-emerald-800 font-medium">✅ O atendente-IA chegou na solução esperada.</p>
              ) : (
                <>
                  <p className="text-sm text-yellow-800 font-medium mb-1">⚠️ Não chegou na solução esperada nas tentativas.</p>
                  <p className="text-xs text-yellow-700">{testResult.diagnostico}</p>
                </>
              )}
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
