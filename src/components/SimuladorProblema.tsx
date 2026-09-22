import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, StopCircle, RotateCcw, BookOpen } from "lucide-react";
import { ClienteAvatar } from "@/components/ClienteAvatar";
import { WhatsAppText } from "@/components/WhatsAppText";
import { toast } from "sonner";
import { problemScenarioChat, evaluateProblemScenario } from "@/lib/problemscenarios.functions";
import { saveProblemSimulatorResult } from "@/lib/gamification.functions";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/components/SimuladorIA";

export const FAIXA_ETARIA_LABELS: Record<string, string> = {
  "20-30": "20 a 30 anos", "30-40": "30 a 40 anos", "40-60": "40 a 60 anos", "60-80": "60 a 80 anos",
};

interface Scenario {
  id: string; name: string; enredo: string; personalidade: string; difficulty: string;
  category?: { name?: string | null } | null;
  cliente_nome?: string | null; cliente_cpf?: string | null; cliente_regiao?: string | null;
  cliente_genero?: string | null; faixa_etaria?: string | null;
}
interface Message { role: "atendente" | "cliente"; content: string; }
interface Avaliacao { nota: number; resumo: string; pontos_fortes: string[]; pontos_melhoria: string[]; erros: string[]; }

export function SimuladorProblema({ scenario, onReset }: { scenario: Scenario; onReset: () => void }) {
  const [briefingLido, setBriefingLido] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [encerrado, setEncerrado] = useState(false);
  const [xpGanho, setXpGanho] = useState<number | null>(null);
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatFn = useServerFn(problemScenarioChat);
  const evalFn = useServerFn(evaluateProblemScenario);
  const saveResultFn = useServerFn(saveProblemSimulatorResult);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: async (history: Message[]) => {
      const { content } = await chatFn({ data: { scenario_id: scenario.id, history } });
      return content;
    },
    onSuccess: (result) => {
      const partes = result.split("||BREAK||").map((p) => p.trim()).filter(Boolean);
      setMessages((prev) => [...prev, ...partes.map((p) => ({ role: "cliente" as const, content: p }))]);
    },
    onError: () => toast.error("Erro ao obter resposta do cliente virtual."),
  });

  const iniciar = () => {
    setBriefingLido(true);
    sendMut.mutate([]);
  };

  const handleSend = () => {
    if (!input.trim() || encerrado) return;
    const novaMsg: Message = { role: "atendente", content: input.trim() };
    const novoHistorico = [...messages, novaMsg];
    setMessages(novoHistorico);
    setInput("");
    sendMut.mutate(novoHistorico);
  };

  const avaliarMut = useMutation({
    mutationFn: async () => {
      const transcript = messages.map((m) => `${m.role === "atendente" ? "Atendente" : "Cliente"}: ${m.content}`).join("\n");
      const { content } = await evalFn({ data: { scenario_id: scenario.id, transcript } });
      return content;
    },
    onSuccess: async (result) => {
      try {
        const clean = result.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean) as Avaliacao;
        setAvaliacao(parsed);
        try {
          const saved = await saveResultFn({ data: {
            scenario_id: scenario.id,
            scenario_name: scenario.name,
            difficulty: scenario.difficulty,
            nota: parsed.nota,
            resumo: parsed.resumo,
            pontos_fortes: parsed.pontos_fortes ?? [],
            pontos_melhoria: parsed.pontos_melhoria ?? [],
            erros: parsed.erros ?? [],
          } });
          setXpGanho(saved.ganho);
        } catch {
          // segue sem XP se salvar falhar
        }
      } catch {
        toast.error("Não foi possível gerar a avaliação. Tente novamente.");
      }
    },
    onError: () => toast.error("Erro ao gerar avaliação."),
  });

  const handleEncerrar = () => {
    setEncerrado(true);
    avaliarMut.mutate();
  };

  // Tela de resultado
  if (avaliacao) {
    const nota = avaliacao.nota ?? 0;
    const cor = nota >= 70 ? "text-emerald-600" : nota >= 40 ? "text-yellow-600" : "text-red-600";
    return (
      <Card className="p-6 space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Avaliação do atendimento</p>
          <p className={`text-5xl font-bold ${cor}`}>{nota}<span className="text-2xl">/100</span></p>
          <p className="text-sm text-muted-foreground mt-2">{avaliacao.resumo}</p>
          {xpGanho !== null && (
            <Badge className="mt-2 bg-amber-200 text-amber-800">+{xpGanho} XP em Solução de Problemas!</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {avaliacao.pontos_fortes?.length > 0 && (
            <Card className="p-4 bg-emerald-50 border-emerald-200">
              <h4 className="font-semibold text-emerald-800 text-sm mb-2">✅ Pontos fortes</h4>
              <ul className="space-y-1">{avaliacao.pontos_fortes.map((p, i) => <li key={i} className="text-xs text-emerald-700">• {p}</li>)}</ul>
            </Card>
          )}
          {avaliacao.pontos_melhoria?.length > 0 && (
            <Card className="p-4 bg-yellow-50 border-yellow-200">
              <h4 className="font-semibold text-yellow-800 text-sm mb-2">⚠️ Melhorar</h4>
              <ul className="space-y-1">{avaliacao.pontos_melhoria.map((p, i) => <li key={i} className="text-xs text-yellow-700">• {p}</li>)}</ul>
            </Card>
          )}
          {avaliacao.erros?.length > 0 && (
            <Card className="p-4 bg-red-50 border-red-200">
              <h4 className="font-semibold text-red-800 text-sm mb-2">❌ Erros</h4>
              <ul className="space-y-1">{avaliacao.erros.map((p, i) => <li key={i} className="text-xs text-red-700">• {p}</li>)}</ul>
            </Card>
          )}
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Novo cenário
          </Button>
        </div>
      </Card>
    );
  }

  // Tela de briefing — o atendente lê o enredo antes de começar
  if (!briefingLido) {
    return (
      <Card className="p-6 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">O que aconteceu</h3>
          <Badge className={`ml-auto text-xs ${DIFFICULTY_COLORS[scenario.difficulty]}`}>{DIFFICULTY_LABELS[scenario.difficulty]}</Badge>
        </div>
        {scenario.category?.name && <Badge variant="secondary">{scenario.category.name}</Badge>}
        <p className="text-sm leading-relaxed whitespace-pre-line">{scenario.enredo}</p>
        <p className="text-xs text-muted-foreground border-t pt-3">
          Leia com atenção. Ao começar, o cliente virtual já abre a conversa contando o problema — você precisa se apresentar,
          entender o caso e conduzir até a solução.
        </p>
        <div className="flex justify-between gap-3">
          <Button variant="outline" onClick={onReset} className="gap-2"><RotateCcw className="h-4 w-4" /> Voltar</Button>
          <Button onClick={iniciar} className="gap-2">Já entendi, atender agora</Button>
        </div>
      </Card>
    );
  }

  // Tela de chat
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
      <Card className="p-4 space-y-4 sticky top-4">
        <div className="flex flex-col items-center text-center gap-2">
          <ClienteAvatar genero={scenario.cliente_genero ?? undefined} size={80} />
          <div>
            <p className="font-semibold text-sm">{scenario.cliente_nome || scenario.name}</p>
            <Badge className={`text-xs mt-1 ${DIFFICULTY_COLORS[scenario.difficulty]}`}>{DIFFICULTY_LABELS[scenario.difficulty]}</Badge>
          </div>
        </div>
        <div className="space-y-2 text-xs border-t pt-3">
          {scenario.cliente_cpf && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">CPF</span>
              <span className="font-mono font-medium">{scenario.cliente_cpf}</span>
            </div>
          )}
          {scenario.cliente_regiao && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Região</span>
              <span className="font-medium text-right">{scenario.cliente_regiao}</span>
            </div>
          )}
          {scenario.faixa_etaria && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Idade</span>
              <span className="font-medium text-right">{FAIXA_ETARIA_LABELS[scenario.faixa_etaria] ?? scenario.faixa_etaria}</span>
            </div>
          )}
          {scenario.category?.name && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Categoria</span>
              <span className="font-medium text-right">{scenario.category.name}</span>
            </div>
          )}
        </div>
        <div className="border-t pt-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Enredo</p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6 whitespace-pre-line">{scenario.enredo}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onReset} className="w-full gap-2 mt-2">
          <RotateCcw className="h-3 w-3" /> Trocar cenário
        </Button>
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{scenario.name}</span>
            <Badge className={DIFFICULTY_COLORS[scenario.difficulty]}>{DIFFICULTY_LABELS[scenario.difficulty]}</Badge>
          </div>
          <Button size="sm" variant="destructive" onClick={handleEncerrar} disabled={messages.length === 0} className="gap-2">
            <StopCircle className="h-4 w-4" />
            {avaliarMut.isPending ? "Avaliando..." : "Encerrar e Avaliar"}
          </Button>
        </div>

        <div ref={scrollRef} className="flex flex-col gap-2 min-h-[300px] max-h-[400px] overflow-y-auto p-2 bg-muted/20 rounded-md">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "atendente" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.role === "atendente" ? "bg-primary text-primary-foreground" : "bg-background border text-foreground"}`}>
                <p className="text-[10px] font-medium mb-1 opacity-70">{m.role === "atendente" ? "Você" : scenario.name}</p>
                <WhatsAppText text={m.content} />
              </div>
            </div>
          ))}
          {sendMut.isPending && (
            <div className="flex justify-start">
              <div className="bg-background border rounded-xl px-3 py-2 text-sm text-muted-foreground">
                {scenario.name} está digitando...
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Digite sua mensagem..." rows={2} className="resize-none" disabled={encerrado} />
          <Button onClick={handleSend} disabled={!input.trim() || encerrado || sendMut.isPending} className="gap-1 text-xs shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
