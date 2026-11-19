import { useState, useRef, useMemo, useEffect } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { listMessages } from "@/lib/messages.functions";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, RotateCcw, MessageSquare, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { saveSimulatorResult } from "@/lib/gamification.functions";
import { supabase } from "@/integrations/supabase/client";
import { listClientProfileStates } from "@/lib/clientprofilestates.functions";
import { getClientKnowledge } from "@/lib/chat.functions";
import { WhatsAppText } from "@/components/WhatsAppText";
import { SIMULATOR_CLIENT_MODEL, SIMULATOR_EVALUATION_MODEL } from "@/lib/ai-models";
import { AvaliacaoScreen, type Avaliacao } from "@/components/simulador/AvaliacaoScreen";

export { DIFFICULTY_LABELS } from "@/components/simulador/difficulty";

interface Profile {
  id: string;
  name: string;
  personality: string;
  objectives: string;
  objections: string;
  behaviors: string;
  difficulty: string;
  category?: { slug?: string | null; name?: string | null } | null;
  cliente_nome?: string | null;
  cliente_cpf?: string | null;
  cliente_telefone?: string | null;
  cliente_regiao?: string | null;
  cliente_genero?: string | null;
  cliente_origem_lead?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_complemento?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  endereco_cep?: string | null;
  dependentes?: { nome?: string; cpf?: string; nascimento?: string; situacao?: string }[] | null;
}

interface ClientProfileState {
  id: string; profile_id: string; position: number; name: string;
  description: string | null; example_lines: string | null; advance_criteria: string | null;
  attachment_url: string | null; attachment_label: string | null;
  overlay_enabled: boolean | null;
  overlay_nome_x: number | null; overlay_nome_y: number | null;
  overlay_cpf_x: number | null; overlay_cpf_y: number | null;
}
interface Message { role: "atendente" | "cliente"; content: string; images?: string[]; time: string }

function horaAtual() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

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

const EVAL_PROMPT = `Você é um avaliador especialista em atendimentos
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

Analise a conversa abaixo e responda APENAS com um JSON válido, sem texto extra, sem markdown, sem blocos de código.
O JSON deve ter exatamente estes campos:
{
  "nota": 0-100,
  "resumo": "...",
  "pontos_fortes": ["..."],
  "pontos_melhoria": ["..."],
  "erros": ["..."],
  "trechos": { "pontos_fortes": ["trecho exato da conversa ou null"], "pontos_melhoria": ["..."], "erros": ["..."] },
  "mensagem_fraca": "a mensagem mais fraca do ATENDENTE, copiada exatamente como foi escrita, ou null se não houver uma claramente fraca",
  "reescrita": "como você reescreveria essa mensagem, ou null"
}
Os arrays dentro de "trechos" devem ter o mesmo tamanho dos arrays correspondentes (pontos_fortes/pontos_melhoria/erros), na mesma ordem — um trecho (ou null) para cada item.`;

export function SimuladorIA({ profile, onReset }: { profile: Profile; onReset: () => void }) {

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aguardandoResposta, setAguardandoResposta] = useState(false);
  const [pendingAttendantMessages, setPendingAttendantMessages] = useState<string[]>([]);

  // Atalhos "/palavra" (respostas rápidas cadastradas em Admin → Mensagens)
  const shortcutsFn = useServerFn(listMessages);
  const shortcutsQ = useQuery({ queryKey: ["messages", "shortcuts"], queryFn: () => shortcutsFn({}) });
  const shortcutMessages = ((shortcutsQ.data ?? []) as Array<{ id: string; title: string; content: string; shortcut: string | null }>)
    .filter((m) => !!m.shortcut);

  // Conhecimento do Cliente: base pública compartilhada (Admin → Conhecimento do Cliente),
  // pra o cliente virtual não inventar valor de plano e afins.
  const clientKnowledgeFn = useServerFn(getClientKnowledge);
  const clientKnowledgeQ = useQuery({ queryKey: ["client-knowledge"], queryFn: () => clientKnowledgeFn({}) });
  const clientKnowledge = (clientKnowledgeQ.data as { client_knowledge?: string } | undefined)?.client_knowledge ?? "";

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
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [xpGanho, setXpGanho] = useState<number | null>(null);
  const [melhorNotaPerfil, setMelhorNotaPerfil] = useState<number | null>(null);

  const resetarConversa = () => {
    setMessages([]);
    setInput("");
    setAttachedImages([]);
    setAguardandoResposta(false);
    setPendingAttendantMessages([]);
    setAvaliacao(null);
    setXpGanho(null);
    setMelhorNotaPerfil(null);
    setStateIndex(0);
  };

  const buildSystemPrompt = (idx: number) => {
    // Filiação = cliente novo, ainda fornecendo os dados dele.
    // Refiliação/Migração/EDT = cliente já tem cadastro, e vai CONFERIR o que o atendente disser.
    const isCadastroExistente = !!profile.category?.slug && profile.category.slug !== "filiacao";

    const enderecoTexto = [
      profile.endereco_rua, profile.endereco_numero ? `nº ${profile.endereco_numero}` : null, profile.endereco_complemento,
    ].filter(Boolean).join(", ") + [
      profile.endereco_bairro ? ` - ${profile.endereco_bairro}` : "",
      profile.endereco_cidade ? `, ${profile.endereco_cidade}` : "",
      profile.endereco_estado ? `/${profile.endereco_estado}` : "",
      profile.endereco_cep ? `, CEP ${profile.endereco_cep}` : "",
    ].join("");

    const dadosFicticios = [
      profile.cliente_nome ? `Nome completo: ${profile.cliente_nome}` : null,
      profile.cliente_cpf ? `CPF: ${profile.cliente_cpf}` : null,
      profile.cliente_telefone ? `Telefone: ${profile.cliente_telefone}` : null,
      profile.cliente_regiao ? `Região/cidade onde mora: ${profile.cliente_regiao}` : null,
      enderecoTexto.trim() ? `Endereço: ${enderecoTexto.trim()}` : null,
    ].filter(Boolean).join(" | ");

    const dependentesTexto = profile.dependentes && profile.dependentes.length > 0
      ? profile.dependentes.map(d => `${d.nome}${d.cpf ? ` (CPF ${d.cpf})` : ""}${d.nascimento ? `, nasc. ${d.nascimento}` : ""}${d.situacao ? ` — ${d.situacao}` : ""}`).join("; ")
      : null;

    const dadosBlock = isCadastroExistente
      ? `Você JÁ POSSUI CADASTRO na empresa — este NÃO é um atendimento de filiação nova, é uma reativação/atualização cadastral. Seu cadastro atual é: ${dadosFicticios || "nenhum dado de cadastro foi definido para este perfil"}.
${dependentesTexto ? `Dependentes cadastrados atualmente no seu nome: ${dependentesTexto}.` : "Você não possui nenhum dependente cadastrado."}
Comportamento obrigatório: quando o atendente perguntar ou tentar confirmar um dado seu (nome, CPF, telefone, endereço, dependentes), CONFIRA com o cadastro acima antes de responder. Se o dado que ele disser bater exatamente com o cadastro, confirme naturalmente ("Sim, isso mesmo", "Correto"). Se ele disser um dado diferente do cadastro, corrija com o valor certo (ex: "Não, meu CPF é ..."). Nunca confirme automaticamente um dado que não bate com o que está acima, e nunca invente um dado que não foi definido.`
      : `${dadosFicticios ? `Seus dados pessoais fictícios (use-os SOMENTE se o atendente perguntar diretamente, informando com naturalidade): ${dadosFicticios}.` : ""}`;

    const base = `Você é um cliente virtual chamado ${profile.name} sendo atendido por um vendedor do Cartão de Todos.
Personalidade: ${profile.personality}.
Objetivos: ${profile.objectives}.
Objeções típicas: ${profile.objections}.
Comportamentos: ${profile.behaviors}.
Nível de dificuldade: ${profile.difficulty}.
${dadosBlock}
${clientKnowledge ? `\nO que você, como cliente comum, já sabe ou já viu no site/Google sobre o Cartão de Todos (use isso com naturalidade, sem citar como "fonte"):\n${clientKnowledge}\n` : ""}
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

REGRA ANTI-ENROLAÇÃO (obrigatória): se o critério de avanço envolve o atendente pedir dados seus (nome completo, CPF, endereço, e-mail etc.), você NÃO pode dizer "já te mando", "um minuto" ou algo do tipo e já marcar avanço. Você é obrigado a efetivamente informar esses dados${dadosFicticios ? `, usando os valores fictícios fornecidos (${dadosFicticios})` : ""}, na mesma mensagem ou, no máximo, na resposta seguinte — nunca deixando só a promessa. Só marque "avanca": true quando o dado pedido já tiver aparecido de fato em alguma das SUAS mensagens nesta conversa, nunca com base apenas numa promessa de enviar depois. Se ainda não enviou, envie agora (ex: "opa, deixa eu ver aqui" ||BREAK|| "CPF é 123.456.789-00") em vez de adiar.

Avalie se a ÚLTIMA mensagem do atendente atende esse critério, considerando também se os dados pedidos já foram realmente entregues na conversa (não apenas prometidos). Responda SEMPRE em JSON válido, sem markdown e sem nenhum texto fora do JSON, neste formato exato:
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
      const { content } = await sendAI({ data: { messages: payload, model: SIMULATOR_CLIENT_MODEL } });
      return content;
    },
    onSuccess: async (result) => {
      if (states.length === 0) {
        const partes = result.split("||BREAK||").map((p: string) => p.trim()).filter(Boolean);
        setMessages(prev => [...prev, ...partes.map((p: string) => ({ role: "cliente" as const, content: p, time: horaAtual() }))]);
        setAguardandoResposta(false);
        return;
      }
      try {
        const clean = result.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        const falas: string[] = Array.isArray(parsed.mensagens) && parsed.mensagens.length > 0
          ? parsed.mensagens
          : [String(parsed.mensagens ?? result)];
        setMessages(prev => [...prev, ...falas.map((f: string) => ({ role: "cliente" as const, content: f, time: horaAtual() }))]);
        if (parsed.avanca && stateIndex < states.length - 1) {
          const proximo = states[stateIndex + 1];
          setStateIndex(stateIndex + 1);
          if (proximo?.attachment_url) {
            let imagemFinal = proximo.attachment_url;
            if (proximo.overlay_enabled) {
              imagemFinal = await composeOverlayImage(proximo.attachment_url, profile.cliente_nome ?? undefined, profile.cliente_cpf ?? undefined, {
                nomeX: proximo.overlay_nome_x, nomeY: proximo.overlay_nome_y,
                cpfX: proximo.overlay_cpf_x, cpfY: proximo.overlay_cpf_y,
              });
            }
            setMessages(prev => [...prev, {
              role: "cliente" as const,
              content: proximo.attachment_label || "Segue o documento.",
              images: [imagemFinal],
              time: horaAtual(),
            }]);
          }
        }
      } catch {
        const partes = result.split("||BREAK||").map((p: string) => p.trim()).filter(Boolean);
        setMessages(prev => [...prev, ...partes.map((p: string) => ({ role: "cliente" as const, content: p, time: horaAtual() }))]);
      }
      setAguardandoResposta(false);
    },
    onError: () => toast.error("Erro ao obter resposta do cliente virtual.")
  });

  const avaliarAI = useServerFn(simulatorChat);
  const avaliarMut = useMutation({
    mutationFn: async () => {
      const conversa = messages.map(m => `${m.role === "atendente" ? "Atendente" : "Cliente"}: ${m.content}`).join("\n");
      const payload = [
        { role: "system", content: EVAL_PROMPT },
        { role: "user", content: conversa }
      ];
      const { content } = await avaliarAI({ data: { messages: payload, model: SIMULATOR_EVALUATION_MODEL } });
      return content;
    },
    onSuccess: async (result) => {
      try {
        const clean = result.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setAvaliacao(parsed);
        try {
          const saved = await saveResultFn({ data: {
            profile_id: profile.id,
            profile_name: profile.name,
            difficulty: profile.difficulty,
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
    setMessages(prev => [...prev, { role: "atendente", content: text, images: attachedImages.length ? attachedImages : undefined, time: horaAtual() }]);
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
    avaliarMut.mutate();
  };

  if (avaliacao) {
    return (
      <AvaliacaoScreen
        avaliacao={avaliacao}
        xpGanho={xpGanho}
        melhorNota={melhorNotaPerfil}
        nomePerfil={profile.name}
        genero={profile.cliente_genero}
        resumoPersonalidade={profile.personality}
        onTreinarDeNovo={resetarConversa}
        onOutroCliente={onReset}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
      {/* Coluna do cliente: só os dados reais que o atendente teria */}
      <Card className="p-4 space-y-4 sticky top-4">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
            {iniciais(profile.cliente_nome || profile.name)}
          </div>
          <div>
            <p className="font-semibold text-sm">{profile.cliente_nome || profile.name}</p>
            <p className="text-xs text-muted-foreground">Cliente virtual</p>
          </div>
        </div>
        <div className="space-y-2 text-xs border-t pt-3">
          {profile.cliente_regiao && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Região</span>
              <span className="font-medium text-right">{profile.cliente_regiao}</span>
            </div>
          )}
          {profile.cliente_cpf && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">CPF</span>
              <span className="font-mono font-medium">{profile.cliente_cpf}</span>
            </div>
          )}
          {profile.cliente_origem_lead && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Origem</span>
              <span className="font-medium text-right">{profile.cliente_origem_lead}</span>
            </div>
          )}
        </div>
        <div className="border border-dashed border-border rounded-md p-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            A personalidade e o perfil {profile.cliente_genero === "feminino" ? "desta cliente" : "deste cliente"} aparecem na avaliação, quando você encerrar.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onReset} className="w-full gap-2">
          <RotateCcw className="h-3 w-3" /> Trocar cliente
        </Button>
      </Card>

      {/* Chat estilo WhatsApp, cores OMNIA */}
      <Card className="p-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
              {iniciais(profile.cliente_nome || profile.name)}
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{profile.cliente_nome || profile.name}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">online</p>
            </div>
          </div>
          <Button size="sm" onClick={handleEncerrar} disabled={messages.length === 0} className="gap-2">
            {avaliarMut.isPending ? "Avaliando..." : "Encerrar e avaliar"}
          </Button>
        </div>

        {states.length > 0 && (
          <div className="px-4 pt-2 space-y-1">
            <div className="flex items-center gap-1">
              {states.map((s, i) => (
                <div key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= stateIndex ? "bg-primary" : "bg-muted"}`} title={s.name} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 min-h-[360px] max-h-[460px] overflow-y-auto p-4 bg-sidebar">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-10">
              Inicie o atendimento. Você é o vendedor — o cliente virtual vai responder.
            </p>
          )}
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
                  {m.images && m.images.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-1">
                      {m.images.map((url, idx) => (
                        <img key={idx} src={url} alt="anexo" className="h-16 w-16 object-cover rounded-md border border-border/50" />
                      ))}
                    </div>
                  )}
                  <WhatsAppText text={m.content} />
                  <p className="text-[10px] text-muted-foreground text-right mt-0.5">{m.time}</p>
                </div>
              </div>
            );
          })}
          {sendMut.isPending && (
            <p className="text-xs text-muted-foreground italic mt-2">
              {(profile.cliente_nome || profile.name)} está digitando...
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 p-3 border-t">
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
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)} />
            <Button type="button" variant="outline" size="icon" className="shrink-0"
              onClick={() => fileInputRef.current?.click()} disabled={uploadingImg || attachedImages.length >= 2}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (shortcutMatches.length > 0) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setShortcutIndex(i => (i + 1) % shortcutMatches.length); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setShortcutIndex(i => (i - 1 + shortcutMatches.length) % shortcutMatches.length); return; }
                  if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) { e.preventDefault(); applyShortcut(shortcutMatches[shortcutIndex]); return; }
                }
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Digite sua mensagem... (use / para respostas rápidas)" rows={1} className="resize-none" />
            <Button variant="outline" onClick={handleSend} disabled={(!input.trim() && attachedImages.length === 0)} className="gap-1 text-xs shrink-0">
              <Send className="h-4 w-4" /> Enviar
            </Button>
            {pendingAttendantMessages.length > 0 && (
              <Button onClick={handleAwaitResponse} disabled={sendMut.isPending}
                className="gap-1 text-xs shrink-0">
                <MessageSquare className="h-3 w-3" /> Aguardar resposta
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Você pode mandar várias mensagens seguidas; a cliente responde quando você clicar em "Aguardar resposta".
          </p>
        </div>
      </Card>
    </div>
  );
}
