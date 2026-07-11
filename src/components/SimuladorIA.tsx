import { useState, useRef } from "react";

import { useMutation } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, StopCircle, RotateCcw, MessageSquare, Paperclip, X } from "lucide-react";
import { ClienteAvatar } from "@/components/ClienteAvatar";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { saveSimulatorResult } from "@/lib/gamification.functions";


interface Profile {
  id: string; name: string; personality: string; difficulty: string;
  objectives: string; objections: string; behaviors: string;
  cliente_nome?: string;
  cliente_cpf?: string;
  cliente_regiao?: string;
  cliente_genero?: string;
}
interface Message { role: "atendente" | "cliente"; content: string; images?: string[]; }

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
const [attachedImages, setAttachedImages] = useState<string[]>([]);
const [uploadingImg, setUploadingImg] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
  const [encerrado, setEncerrado] = useState(false);
  const [xpGanho, setXpGanho] = useState<number | null>(null);
  const [aguardandoResposta, setAguardandoResposta] = useState(false);
  const [pendingAttendantMessages, setPendingAttendantMessages] = useState<string[]>([]);

const handleFilesSelected = async (files: FileList | null) => {
  if (!files || files.length === 0) return;
  const remaining = 2 - attachedImages.length;
  if (remaining <= 0) {
    toast.error("Máximo de 2 imagens por mensagem.");
    return;
  }
  const list = Array.from(files).slice(0, remaining);
  setUploadingImg(true);
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) throw new Error("Usuário não autenticado");
    for (const file of list) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} não é uma imagem.`);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} excede 8MB.`);
        continue;
      }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${uid}/simulador/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
      setAttachedImages((prev) => [...prev, pub.publicUrl]);
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Erro ao enviar imagem");
  } finally {
    setUploadingImg(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
};
  const saveResultFn = useServerFn(saveSimulatorResult);
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
Se o atendente errar muito, fique mais resistente.
Você pode responder com 1, 2 ou até 3 mensagens curtas separadas, exatamente como faria no WhatsApp — quebre em mensagens naturais usando o separador ||BREAK|| entre elas. Exemplo: 'Oi tudo bem?' ||BREAK|| 'Me fala mais sobre esse cartão' ||BREAK|| 'Quanto custa?'. Use múltiplas mensagens apenas quando for natural — não force.`;

  const sendAI = useServerFn(simulatorChat);
const sendMut = useMutation({
  mutationFn: async (text: string) => {
    const history = messages.map(m => {
      if (m.images && m.images.length > 0) {
        return {
          role: m.role === "atendente" ? "user" : "assistant",
          content: [
            ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
            ...m.images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ],
        };
      }
      return { role: m.role === "atendente" ? "user" : "assistant", content: m.content };
    });
    const payload = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: text }
    ];
    const { content } = await sendAI({ data: { messages: payload, model: "google/gemini-2.5-flash" } });
    return content;
  },
  onSuccess: (result) => {
    const partes = result.split("||BREAK||").map((p: string) => p.trim()).filter(Boolean);
    setMessages(prev => [
      ...prev,
      ...partes.map((p: string) => ({ role: "cliente" as const, content: p }))
    ]);
    setAguardandoResposta(false);
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
    const { content } = await avaliarAI({ data: { messages: payload, model: "google/gemini-2.5-flash" } });
    return content;
  },
  onSuccess: async (result) => {
      try {
        const clean = result.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setAvaliacao(parsed);
        // Save result and get XP earned
        try {
          const saved = await saveResultFn({ data: {
            profile_id: profile.id,
            profile_name: profile.name,
            difficulty: profile.difficulty,
            nota: parsed.nota,
            resumo: parsed.resumo,
            pontos_fortes: parsed.pontos_fortes ?? [],
            pontos_melhoria: parsed.pontos_melhoria ?? [],
            erros: parsed.erros ?? []
          } });
          setXpGanho(saved.ganho);
        } catch (e) {
          // Silently ignore errors in saving result
        }
      } catch {
        toast.error("Não foi possível gerar a avaliação. Tente novamente.");
      }
    },
  onError: () => toast.error("Erro ao gerar avaliação.")
});

  const handleSend = () => {
    if (!input.trim() && attachedImages.length === 0) return;
    const text = input.trim();
    setMessages(prev => [...prev, { role: "atendente", content: text, images: attachedImages.length ? attachedImages : undefined }]);
    setPendingAttendantMessages(prev => [...prev, text]);
    setInput("");
    setAttachedImages([]);
  };

  const handleAwaitResponse = () => {
    if (pendingAttendantMessages.length === 0) return;
    const combined = pendingAttendantMessages.join("\n");
    setPendingAttendantMessages([]);
    setAguardandoResposta(true);
    sendMut.mutate(combined);
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
          {xpGanho !== null && (
            <Badge className="mt-2 bg-amber-200 text-amber-800">+{xpGanho} XP conquistados!</Badge>
          )}
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
  <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
    {/* Card do cliente */}
    <Card className="p-4 space-y-4 sticky top-4">
      <div className="flex flex-col items-center text-center gap-2">
        <ClienteAvatar genero={profile.cliente_genero} size={80} />
        <div>
          <p className="font-semibold text-sm">{profile.cliente_nome || profile.name}</p>
          <Badge className={`text-xs mt-1 ${DIFFICULTY_COLORS[profile.difficulty]}`}>{DIFFICULTY_LABELS[profile.difficulty]}</Badge>
        </div>
      </div>
      <div className="space-y-2 text-xs border-t pt-3">
        {profile.cliente_cpf && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">CPF</span>
            <span className="font-mono font-medium">{profile.cliente_cpf}</span>
          </div>
        )}
        {profile.cliente_regiao && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Região</span>
            <span className="font-medium text-right">{profile.cliente_regiao}</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Perfil</span>
          <span className="font-medium text-right">{profile.name}</span>
        </div>
      </div>
      <div className="border-t pt-3 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personalidade</p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{profile.personality}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onReset} className="w-full gap-2 mt-2">
        <RotateCcw className="h-3 w-3" /> Trocar cliente
      </Button>
    </Card>

    {/* Chat principal */}
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{profile.name}</span>
          <Badge className={DIFFICULTY_COLORS[profile.difficulty]}>{DIFFICULTY_LABELS[profile.difficulty]}</Badge>
        </div>
        <Button size="sm" variant="destructive" onClick={handleEncerrar}
          disabled={messages.length === 0} className="gap-2">
          <StopCircle className="h-4 w-4" />
          {avaliarMut.isPending ? "Avaliando..." : "Encerrar e Avaliar"}
        </Button>
      </div>

      <div className="flex flex-col gap-2 min-h-[300px] max-h-[400px] overflow-y-auto p-2 bg-muted/20 rounded-md">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-10">
            Inicie o atendimento. Você é o vendedor — o cliente virtual vai responder.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "atendente" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.role === "atendente" ? "bg-primary text-primary-foreground" : "bg-background border text-foreground"}`}>
              <p className="text-[10px] font-medium mb-1 opacity-70">
                {m.role === "atendente" ? "Você" : profile.name}
              </p>
              {m.images && m.images.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-1">
                  {m.images.map((url, idx) => (
                    <img key={idx} src={url} alt="anexo" className="h-16 w-16 object-cover rounded-md border border-border/50" />
                  ))}
                </div>
              )}
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

      <div className="flex flex-col gap-2">
        {attachedImages.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {attachedImages.map((url, i) => (
              <div key={i} className="relative h-14 w-14 rounded-md overflow-hidden border border-border group">
                <img src={url} alt="anexo" className="h-full w-full object-cover" />
                <button type="button"
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                  onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)} />
          <Button type="button" variant="outline" size="icon" className="shrink-0"
            onClick={() => fileInputRef.current?.click()} disabled={uploadingImg || attachedImages.length >= 2 || encerrado}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Digite sua mensagem..." rows={2} className="resize-none" />
          <div className="flex flex-col gap-2">
            <Button onClick={handleSend} disabled={(!input.trim() && attachedImages.length === 0) || encerrado} className="gap-1 text-xs">
              <Send className="h-4 w-4" />
            </Button>
            {pendingAttendantMessages.length > 0 && (
              <Button onClick={handleAwaitResponse} disabled={sendMut.isPending || encerrado}
                variant="outline" className="gap-1 text-xs">
                <MessageSquare className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  </div>
);
}
