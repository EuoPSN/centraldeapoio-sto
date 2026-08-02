import { useState, useRef } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";

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
import { supabase } from "@/integrations/supabase/client";
import { listClientProfileStates } from "@/lib/clientprofilestates.functions";


interface Profile {
  id: string; name: string; personality: string; difficulty: string;
  objectives: string; objections: string; behaviors: string;
  cliente_nome?: string;
  cliente_cpf?: string;
  cliente_regiao?: string;
  cliente_genero?: string;
}
interface ClientProfileState {
  id: string; profile_id: string; position: number; name: string;
  description: string | null; example_lines: string | null; advance_criteria: string | null;
  attachment_url: string | null; attachment_label: string | null;
  overlay_enabled: boolean | null;
  overlay_nome_x: number | null; overlay_nome_y: number | null;
  overlay_cpf_x: number | null; overlay_cpf_y: number | null;
}
interface Message { role: "atendente" | "cliente"; content: string; images?: string[]; }

// Desenha o nome e CPF fictícios do perfil por cima do molde de documento,
// nas posições marcadas pelo admin, e retorna uma imagem final (data URL).
function composeOverlayImage(
  templateUrl: string,
  nome: string | undefined,
  cpf: string | undefined,
  pos: { nomeX: number | null; nomeY: number | null; cpfX: number | null; cpfY: number | null }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(templateUrl); return; }
        ctx.drawImage(img, 0, 0);
        ctx.fillStyle = "#111";
        ctx.font = `${Math.round(img.naturalWidth * 0.032)}px sans-serif`;
        ctx.textBaseline = "middle";
        if (pos.nomeX != null && pos.nomeY != null && nome) {
          ctx.fillText(nome, (pos.nomeX / 100) * img.naturalWidth, (pos.nomeY / 100) * img.naturalHeight);
        }
        if (pos.cpfX != null && pos.cpfY != null && cpf) {
          ctx.fillText(cpf, (pos.cpfX / 100) * img.naturalWidth, (pos.cpfY / 100) * img.naturalHeight);
        }
        resolve(canvas.toDataURL("image/png"));
      } catch {
        // Se a imagem "tainted" o canvas (CORS) ou algo falhar, cai para a imagem original sem overlay.
        resolve(templateUrl);
      }
    };
    img.onerror = () => resolve(templateUrl);
    img.src = templateUrl;
  });
}

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

  const statesFn = useServerFn(listClientProfileStates);
  const statesQ = useQuery({
    queryKey: ["profile_states", profile.id],
    queryFn: () => statesFn({ data: { profile_id: profile.id } }),
  });
  const states = (statesQ.data ?? []) as ClientProfileState[];
  const [stateIndex, setStateIndex] = useState(0);

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
      const { data: signed, error: signErr } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed) throw signErr ?? new Error("Não foi possível gerar URL da imagem");
      setAttachedImages((prev) => [...prev, signed.signedUrl]);
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

const buildSystemPrompt = (idx: number) => {
    const dadosFicticios = [
      profile.cliente_nome ? `Nome completo: ${profile.cliente_nome}` : null,
      profile.cliente_cpf ? `CPF: ${profile.cliente_cpf}` : null,
      profile.cliente_regiao ? `Região/cidade onde mora: ${profile.cliente_regiao}` : null,
    ].filter(Boolean).join(" | ");

    const base = `Você é um cliente virtual chamado ${profile.name} sendo atendido por um vendedor do Cartão de Todos.
Personalidade: ${profile.personality}.
Objetivos: ${profile.objectives}.
Objeções típicas: ${profile.objections}.
Comportamentos: ${profile.behaviors}.
Nível de dificuldade: ${DIFFICULTY_LABELS[profile.difficulty]}.
${dadosFicticios ? `Seus dados pessoais fictícios (use-os SOMENTE se o atendente perguntar diretamente, informando com naturalidade): ${dadosFicticios}.` : ""}
Responda APENAS como o cliente — nunca quebre o personagem.
Respostas curtas e naturais, como numa conversa real de WhatsApp.
Se o atendente der uma boa resposta às suas objeções, vá cedendo gradualmente.
Se o atendente errar muito, fique mais resistente.`;

    if (states.length === 0) {
      return `${base}
Você pode responder com 1, 2 ou até 3 mensagens curtas separadas, exatamente como faria no WhatsApp — quebre em mensagens naturais usando o separador ||BREAK|| entre elas. Exemplo: 'Oi tudo bem?' ||BREAK|| 'Me fala mais sobre esse cartão' ||BREAK|| 'Quanto custa?'. Use múltiplas mensagens apenas quando for natural — não force.`;
    }

    const atual = states[idx];
    const proximo = states[idx + 1];
    return `${base}

FUNIL DE ATENDIMENTO — você está atualmente no estado "${atual.name}" (etapa ${idx + 1} de ${states.length}).
${atual.description ? `Descrição deste estado: ${atual.description}` : ""}
${atual.example_lines ? `Exemplos de falas típicas deste estado: ${atual.example_lines}` : ""}
Critério para você avançar para o próximo estado${proximo ? ` ("${proximo.name}")` : ""}: ${atual.advance_criteria || "a seu critério, quando fizer sentido na conversa"}.

Avalie se a ÚLTIMA mensagem do atendente atende esse critério. Responda SEMPRE em JSON válido, sem markdown e sem nenhum texto fora do JSON, neste formato exato:
{"avanca": true ou false, "mensagens": ["fala curta 1", "fala curta 2"]}
"mensagens" deve ter de 1 a 3 falas curtas e naturais (estilo WhatsApp). Se "avanca" for true, a fala já deve refletir a transição de personagem para o novo estado.`;
  };

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
      { role: "system", content: buildSystemPrompt(stateIndex) },
      ...history,
      { role: "user", content: text }
    ];
    const { content } = await sendAI({ data: { messages: payload, model: "google/gemini-2.5-flash" } });
    return content;
  },
  onSuccess: async (result) => {
    if (states.length === 0) {
      const partes = result.split("||BREAK||").map((p: string) => p.trim()).filter(Boolean);
      setMessages(prev => [...prev, ...partes.map((p: string) => ({ role: "cliente" as const, content: p }))]);
      setAguardandoResposta(false);
      return;
    }
    try {
      const clean = result.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const falas: string[] = Array.isArray(parsed.mensagens) && parsed.mensagens.length > 0
        ? parsed.mensagens
        : [String(parsed.mensagens ?? result)];
      setMessages(prev => [...prev, ...falas.map((f: string) => ({ role: "cliente" as const, content: f }))]);
      if (parsed.avanca && stateIndex < states.length - 1) {
        const proximo = states[stateIndex + 1];
        setStateIndex(stateIndex + 1);
        if (proximo?.attachment_url) {
          let imagemFinal = proximo.attachment_url;
          if (proximo.overlay_enabled) {
            imagemFinal = await composeOverlayImage(proximo.attachment_url, profile.cliente_nome, profile.cliente_cpf, {
              nomeX: proximo.overlay_nome_x, nomeY: proximo.overlay_nome_y,
              cpfX: proximo.overlay_cpf_x, cpfY: proximo.overlay_cpf_y,
            });
          }
          setMessages(prev => [...prev, {
            role: "cliente" as const,
            content: proximo.attachment_label || "Segue o documento.",
            images: [imagemFinal],
          }]);
        }
      }
    } catch {
      const partes = result.split("||BREAK||").map((p: string) => p.trim()).filter(Boolean);
      setMessages(prev => [...prev, ...partes.map((p: string) => ({ role: "cliente" as const, content: p }))]);
    }
    setAguardandoResposta(false);
  },
  onError: () => toast.error("Erro ao obter resposta do cliente virtual.")
});

  const avaliarAI = useServerFn(simulatorChat);
const avaliarMut = useMutation({
  mutationFn: async () => {
    const conversa = messages.map(m => `${m.role === "atendente" ? "Atendente" : "Cliente"}: ${m.content}`).join("\n");
    const evalPrompt = `Você é um avaliador especialista em atendimentos 
de vendas do Cartão de Todos.

CONTEXTO DA EMPRESA — PROCESSOS CORRETOS QUE NUNCA DEVEM SER AVALIADOS COMO ERRO:
- Solicitar dados do cartão de crédito ou débito (número, validade, CVV) é CORRETO e obrigatório para processar o pagamento
- Solicitar CPF, nome completo, data de nascimento, endereço e e-mail é CORRETO e necessário para o cadastro
- Informar que os dados são protegidos pela LGPD é CORRETO
- Solicitar foto do documento (frente e verso) e selfie é CORRETO — faz parte do processo de KYC
- Enviar link de confirmação por outro número é CORRETO e é o processo padrão da empresa
- Informar o prazo de fidelidade de 12 meses e a multa de 50% é CORRETO e obrigatório
- Oferecer o Pacote Ouro (R$38,39 primeiro mês / R$48,39 seguintes) como alternativa é CORRETO
- Verificar com a gerência sobre isenção de taxa de adesão é CORRETO
- Pedir o estado civil do cliente é CORRETO — é dado obrigatório do cadastro
- Informar a matrícula ao final do cadastro é CORRETO

AVALIE NEGATIVAMENTE APENAS:
- Falta de empatia ou linguagem inadequada com o cliente
- Informações incorretas sobre valores, benefícios ou regras do produto
- Não contornar objeções quando o cliente resistir
- Pular etapas obrigatórias do fluxo de atendimento
- Prometer algo que a empresa não oferece
- Não confirmar os dados antes de processar

Analise a conversa abaixo e responda APENAS com um JSON válido, 
sem texto extra, sem markdown, sem blocos de código.
O JSON deve ter exatamente estes campos:
{"nota": 0-100, "pontos_fortes": ["..."], "pontos_melhoria": ["..."], "erros": ["..."], "resumo": "..."}`;
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

      {states.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            {states.map((s, i) => (
              <div key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= stateIndex ? "bg-primary" : "bg-muted"}`} title={s.name} />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Etapa {stateIndex + 1}/{states.length}: <span className="font-medium text-foreground">{states[stateIndex]?.name}</span>
          </p>
        </div>
      )}

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
