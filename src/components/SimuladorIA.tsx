import { useState } from "react";

import { useMutation } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, StopCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { simulatorChat } from "@/lib/simulator.chat.functions";


interface Profile {
  id: string; name: string; personality: string; difficulty: string;
  objectives: string; objections: string; behaviors: string;
}
interface Message { role: "atendente" | "cliente"; content: string; }

const DIFFICULTY_COLORS: Record<string, string> = {
  facil: "bg-green-100 text-green-800", medio: "bg-yellow-100 text-yellow-800",
  dificil: "bg-orange-100 text-orange-800", especialista: "bg-red-100 text-red-800"
};
const DIFFICULTY_LABELS: Record<string, string> = {
  facil: "Fácil", medio: "Médio", dificil: "Difícil", especialista: "Especialista"
};

export function SimuladorIA({ profile, onReset }: { profile: Profile; onReset: () => void }) {
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [encerrado, setEncerrado] = useState(false);
  const [avaliacao, setAvaliacao] = useState<any>(null);

  const systemPrompt = `Você é um cliente virtual chamado ${profile.name} sendo atendido por um vendedor do Cartão de Todos.
Personalidade: ${profile.personality}.
Objetivos: ${profile.objectives}.
Objeções típicas: ${profile.objections}.
Comportamentos: ${profile.behaviors}.
Nível de dificuldade: ${DIFFICULTY_LABELS[profile.difficulty]}.
Responda APENAS como o cliente — nunca quebre o personagem.
Respostas curtas e naturais, como numa conversa real de WhatsApp.
Se o atendente der uma boa resposta às suas objeções, vá cedendo gradualmente.
Se o atendente errar muito, fique mais resistente.`;

  const sendAI = useServerFn(simulatorChat);
const sendMut = useMutation({
  mutationFn: async (text: string) => {
    const history = messages.map(m => ({
      role: m.role === "atendente" ? "user" : "assistant",
      content: m.content
    }));
    const payload = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: text }
    ];
    const { content } = await sendAI({ data: { messages: payload, model: "gpt-4o-mini" } });
    return content;
  },
  onSuccess: (result) => {
    setMessages(prev => [...prev, { role: "cliente", content: result }]);
  },
  onError: () => toast.error("Erro ao obter resposta do cliente virtual.")
});

  const avaliarAI = useServerFn(simulatorChat);
const avaliarMut = useMutation({
  mutationFn: async () => {
    const conversa = messages.map(m => `${m.role === "atendente" ? "Atendente" : "Cliente"}: ${m.content}`).join("\n");
    const evalPrompt = `Você é um avaliador de atendimentos de vendas do Cartão de Todos.\nAnalise a conversa abaixo e responda APENAS com um JSON válido, sem texto extra, sem markdown, sem blocos de código.\nO JSON deve ter exatamente estes campos:\n{"nota": 0-100, "pontos_fortes": ["..."], "pontos_melhoria": ["..."], "erros": ["..."], "resumo": "..."}`;
    const payload = [
      { role: "system", content: evalPrompt },
      { role: "user", content: conversa }
    ];
    const { content } = await avaliarAI({ messages: payload, model: "gpt-4o-mini" });
    return content;
  },
  onSuccess: (result) => {
    try {
      const clean = result.replace(/```json|```/g, "").trim();
      setAvaliacao(JSON.parse(clean));
    } catch {
      toast.error("Não foi possível gerar a avaliação. Tente novamente.");
    }
  },
  onError: () => toast.error("Erro ao gerar avaliação.")
});

  const handleSend = () => {
    if (!input.trim() || sendMut.isPending) return;
    const text = input.trim();
    setMessages(prev => [...prev, { role: "atendente", content: text }]);
    setInput("");
    sendMut.mutate(text);
  };

  const handleEncerrar = () => {
    setEncerrado(true);
    avaliarMut.mutate();
  };

  if (avaliacao) {
    const nota = avaliacao.nota ?? 0;
    const cor = nota >= 70 ? "text-emerald-600" : nota >= 40 ? "text-yellow-600" : "text-red-600";
    return (
      <Card className="p-6 space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Avaliação da simulação</p>
          <p className={`text-5xl font-bold ${cor}`}>{nota}<span className="text-2xl">/100</span></p>
          <p className="text-sm text-muted-foreground mt-2">{avaliacao.resumo}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {avaliacao.pontos_fortes?.length > 0 && (
            <Card className="p-4 bg-emerald-50 border-emerald-200">
              <h4 className="font-semibold text-emerald-800 text-sm mb-2">✅ Pontos fortes</h4>
              <ul className="space-y-1">{avaliacao.pontos_fortes.map((p: string, i: number) => <li key={i} className="text-xs text-emerald-700">• {p}</li>)}</ul>
            </Card>
          )}
          {avaliacao.pontos_melhoria?.length > 0 && (
            <Card className="p-4 bg-yellow-50 border-yellow-200">
              <h4 className="font-semibold text-yellow-800 text-sm mb-2">⚠️ Melhorar</h4>
              <ul className="space-y-1">{avaliacao.pontos_melhoria.map((p: string, i: number) => <li key={i} className="text-xs text-yellow-700">• {p}</li>)}</ul>
            </Card>
          )}
          {avaliacao.erros?.length > 0 && (
            <Card className="p-4 bg-red-50 border-red-200">
              <h4 className="font-semibold text-red-800 text-sm mb-2">❌ Erros</h4>
              <ul className="space-y-1">{avaliacao.erros.map((p: string, i: number) => <li key={i} className="text-xs text-red-700">• {p}</li>)}</ul>
            </Card>
          )}
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Nova simulação
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{profile.name}</span>
          <Badge className={DIFFICULTY_COLORS[profile.difficulty]}>{DIFFICULTY_LABELS[profile.difficulty]}</Badge>
        </div>
        <Button size="sm" variant="destructive" onClick={handleEncerrar}
          disabled={messages.length === 0 || avaliarMut.isPending} className="gap-2">
          <StopCircle className="h-4 w-4" />
          {avaliarMut.isPending ? "Avaliando..." : "Encerrar e Avaliar"}
        </Button>
      </div>

      <div className="flex flex-col gap-2 min-h-[300px] max-h-[400px] overflow-y-auto p-2 bg-muted/20 rounded-md">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-10">Inicie o atendimento. Você é o vendedor — o cliente virtual vai responder.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "atendente" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.role === "atendente" ? "bg-primary text-primary-foreground" : "bg-background border text-foreground"}`}> 
              <p className="text-[10px] font-medium mb-1 opacity-70">{m.role === "atendente" ? "Você" : profile.name}</p>
              {m.content}
            </div>
          </div>
        ))}
        {sendMut.isPending && (
          <div className="flex justify-start">
            <div className="bg-background border rounded-xl px-3 py-2 text-sm text-muted-foreground">
              {profile.name} está digitando...
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          placeholder="Digite sua mensagem para o cliente..." rows={2} className="resize-none" />
        <Button onClick={handleSend} disabled={!input.trim() || sendMut.isPending || encerrado}
          className="self-end gap-2">
          <Send className="h-4 w-4" /> Enviar
        </Button>
      </div>
    </Card>
  );
}
