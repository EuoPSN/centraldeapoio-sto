import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMessages } from "@/lib/messages.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, RotateCcw, BookOpen, MessageSquare } from "lucide-react";
import { WhatsAppText } from "@/components/WhatsAppText";
import { toast } from "sonner";
import { problemScenarioChat, evaluateProblemScenario } from "@/lib/problemscenarios.functions";
import { saveProblemSimulatorResult } from "@/lib/gamification.functions";
import { DIFFICULTY_DOT_CLASSES, DIFFICULTY_LABELS, DIFFICULTY_TEXT_CLASSES } from "@/components/simulador/difficulty";
import { AvaliacaoScreen, type Avaliacao } from "@/components/simulador/AvaliacaoScreen";

export const FAIXA_ETARIA_LABELS: Record<string, string> = {
  "20-30": "20 a 30 anos", "30-40": "30 a 40 anos", "40-60": "40 a 60 anos", "60-80": "60 a 80 anos",
};

interface Scenario {
  id: string; name: string; enredo: string; personalidade: string; difficulty: string;
  category?: { name?: string | null } | null;
  cliente_nome?: string | null; cliente_cpf?: string | null; cliente_regiao?: string | null;
  cliente_genero?: string | null; faixa_etaria?: string | null;
}
interface Message { role: "atendente" | "cliente"; content: string; time: string }

function horaAtual() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

export function SimuladorProblema({ scenario, onReset }: { scenario: Scenario; onReset: () => void }) {
  const [briefingLido, setBriefingLido] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingAttendantMessages, setPendingAttendantMessages] = useState<string[]>([]);
  const [xpGanho, setXpGanho] = useState<number | null>(null);
  const [melhorNotaPerfil, setMelhorNotaPerfil] = useState<number | null>(null);
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatFn = useServerFn(problemScenarioChat);
  const evalFn = useServerFn(evaluateProblemScenario);
  const saveResultFn = useServerFn(saveProblemSimulatorResult);

  // Atalhos "/palavra" (respostas rápidas cadastradas em Admin → Mensagens)
  const shortcutsFn = useServerFn(listMessages);
  const shortcutsQ = useQuery({ queryKey: ["messages", "shortcuts"], queryFn: () => shortcutsFn({}) });
  const shortcutMessages = ((shortcutsQ.data ?? []) as Array<{ id: string; title: string; content: string; shortcut: string | null }>)
    .filter((m) => !!m.shortcut);

  // Só ativa a sugestão quando a caixa contém SÓ "/algo", sem espaço (igual WhatsApp Business)
  const slashMatch = /^\/(\S*)$/.exec(input);
  const slashQuery = slashMatch ? slashMatch[1].toLowerCase() : null;
  const shortcutMatches = useMemo(() => {
    if (slashQuery === null) return [];
    return shortcutMessages.filter((m) => m.shortcut!.toLowerCase().startsWith(slashQuery)).slice(0, 6);
  }, [slashQuery, shortcutMessages]);

  const [shortcutIndex, setShortcutIndex] = useState(0);
  useEffect(() => { setShortcutIndex(0); }, [slashQuery]);

  const applyShortcut = (m: { content: string }) => {
    setInput(m.content);
    setShortcutIndex(0);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const resetarConversa = () => {
    setMessages([]);
    setInput("");
    setPendingAttendantMessages([]);
    setAvaliacao(null);
    setXpGanho(null);
    setMelhorNotaPerfil(null);
    setBriefingLido(false);
  };

  const sendMut = useMutation({
    mutationFn: async (history: { role: "atendente" | "cliente"; content: string }[]) => {
      const { content } = await chatFn({ data: { scenario_id: scenario.id, history } });
      return content;
    },
    onSuccess: (result) => {
      const partes = result.split("||BREAK||").map((p) => p.trim()).filter(Boolean);
      setMessages((prev) => [...prev, ...partes.map((p) => ({ role: "cliente" as const, content: p, time: horaAtual() }))]);
    },
    onError: () => toast.error("Erro ao obter resposta do cliente virtual."),
  });

  const iniciar = () => {
    setBriefingLido(true);
    sendMut.mutate([]);
  };

  // Enviar só adiciona a mensagem na conversa e na fila — o cliente virtual só
  // responde quando o atendente clicar em "Aguardar resposta" (pode mandar 2-3 seguidas antes).
  const handleSend = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setMessages((prev) => [...prev, { role: "atendente", content: text, time: horaAtual() }]);
    setPendingAttendantMessages((prev) => [...prev, text]);
    setInput("");
  };

  const handleAwaitResponse = () => {
    if (pendingAttendantMessages.length === 0) return;
    setPendingAttendantMessages([]);
    sendMut.mutate(messages.map(({ role, content }) => ({ role, content })));
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
            trechos: parsed.trechos ?? null,
            mensagem_fraca: parsed.mensagem_fraca ?? null,
            reescrita: parsed.reescrita ?? null,
          } });
          setXpGanho(saved.ganho);
          setMelhorNotaPerfil(saved.melhorNotaPerfil);
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
    avaliarMut.mutate();
  };

  // Tela de resultado
  if (avaliacao) {
    return (
      <AvaliacaoScreen
        avaliacao={avaliacao}
        xpGanho={xpGanho}
        melhorNota={melhorNotaPerfil}
        nomePerfil={scenario.name}
        genero={scenario.cliente_genero}
        resumoPersonalidade={scenario.personalidade}
        onTreinarDeNovo={resetarConversa}
        onOutroCliente={onReset}
      />
    );
  }

  // Tela de briefing — o atendente lê o enredo antes de começar
  if (!briefingLido) {
    return (
      <Card className="p-6 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gold-text" />
          <h3 className="font-semibold">O que aconteceu</h3>
          <span className={`ml-auto flex items-center gap-1.5 text-sm ${DIFFICULTY_TEXT_CLASSES[scenario.difficulty] ?? ""}`}>
            <span className={`h-2 w-2 rounded-full ${DIFFICULTY_DOT_CLASSES[scenario.difficulty] ?? "bg-muted-foreground"}`} />
            {DIFFICULTY_LABELS[scenario.difficulty] ?? scenario.difficulty}
          </span>
        </div>
        {scenario.category?.name && <p className="text-xs text-muted-foreground">{scenario.category.name}</p>}
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
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
            {iniciais(scenario.cliente_nome || scenario.name)}
          </div>
          <div>
            <p className="font-semibold text-sm">{scenario.cliente_nome || scenario.name}</p>
            <span className={`inline-flex items-center gap-1.5 text-xs mt-1 ${DIFFICULTY_TEXT_CLASSES[scenario.difficulty] ?? ""}`}>
              <span className={`h-2 w-2 rounded-full ${DIFFICULTY_DOT_CLASSES[scenario.difficulty] ?? "bg-muted-foreground"}`} />
              {DIFFICULTY_LABELS[scenario.difficulty] ?? scenario.difficulty}
            </span>
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

      <Card className="p-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
              {iniciais(scenario.cliente_nome || scenario.name)}
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{scenario.cliente_nome || scenario.name}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">online</p>
            </div>
          </div>
          <Button size="sm" onClick={handleEncerrar} disabled={messages.length === 0} className="gap-2">
            {avaliarMut.isPending ? "Avaliando..." : "Encerrar e avaliar"}
          </Button>
        </div>

        <div ref={scrollRef} className="flex flex-col gap-1 min-h-[360px] max-h-[460px] overflow-y-auto p-4 bg-sidebar">
          {messages.map((m, i) => {
            const anterior = messages[i - 1];
            const agrupado = anterior && anterior.role === m.role;
            const ehAtendente = m.role === "atendente";
            return (
              <div key={i} className={`flex ${ehAtendente ? "justify-end" : "justify-start"} ${agrupado ? "mt-0.5" : "mt-2"}`}>
                <div className={`max-w-[75%] px-3 py-2 text-sm border ${
                  ehAtendente
                    ? `bg-surface-2 border-transparent rounded-xl ${agrupado ? "rounded-tr-sm" : ""}`
                    : `bg-surface border-border rounded-xl ${agrupado ? "rounded-tl-sm" : ""}`
                }`}>
                  <WhatsAppText text={m.content} />
                  <p className="text-[10px] text-muted-foreground text-right mt-0.5">{m.time}</p>
                </div>
              </div>
            );
          })}
          {sendMut.isPending && (
            <p className="text-xs text-muted-foreground italic mt-2">
              {(scenario.cliente_nome || scenario.name)} está digitando...
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 p-3 border-t">
          {shortcutMatches.length > 0 && (
            <div className="border border-border rounded-md bg-popover shadow-md overflow-hidden max-h-56 overflow-y-auto">
              {shortcutMatches.map((m, i) => (
                <button key={m.id} type="button"
                  className={`w-full text-left px-3 py-2 text-sm flex flex-col gap-0.5 border-b border-border/50 last:border-0 ${i === shortcutIndex ? "bg-primary/10" : "hover:bg-muted/50"}`}
                  onMouseEnter={() => setShortcutIndex(i)}
                  onClick={() => applyShortcut(m)}>
                  <span className="font-medium text-gold-text">/{m.shortcut}</span>
                  <span className="text-xs text-muted-foreground truncate">{m.title} — {m.content}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (shortcutMatches.length > 0) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setShortcutIndex((i) => (i + 1) % shortcutMatches.length); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setShortcutIndex((i) => (i - 1 + shortcutMatches.length) % shortcutMatches.length); return; }
                  if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) { e.preventDefault(); applyShortcut(shortcutMatches[shortcutIndex]); return; }
                }
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Digite sua mensagem... (use / para respostas rápidas)" rows={1} className="resize-none" />
            <Button variant="outline" onClick={handleSend} disabled={!input.trim()} className="gap-1 text-xs shrink-0">
              <Send className="h-4 w-4" /> Enviar
            </Button>
            {pendingAttendantMessages.length > 0 && (
              <Button onClick={handleAwaitResponse} disabled={sendMut.isPending} className="gap-1 text-xs shrink-0">
                <MessageSquare className="h-3 w-3" /> Aguardar resposta
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Você pode mandar várias mensagens seguidas; o cliente responde quando você clicar em "Aguardar resposta".
          </p>
        </div>
      </Card>
    </div>
  );
}
