import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listClientProfileStates,
  upsertClientProfileState,
  deleteClientProfileState,
} from "@/lib/clientprofilestates.functions";
import { supabase } from "@/integrations/supabase/client";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { listMessages } from "@/lib/messages.functions";
import { listContent } from "@/lib/content.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2, X, Sparkles, MapPin } from "lucide-react";
import { toast } from "sonner";

interface JourneyState {
  id: string;
  profile_id: string;
  position: number;
  name: string;
  description: string | null;
  example_lines: string | null;
  advance_criteria: string | null;
  attachment_url: string | null;
  attachment_label: string | null;
  overlay_enabled: boolean | null;
  overlay_nome_x: number | null;
  overlay_nome_y: number | null;
  overlay_cpf_x: number | null;
  overlay_cpf_y: number | null;
}

const EMPTY_STATE = {
  id: undefined as string | undefined,
  name: "",
  description: "",
  example_lines: "",
  advance_criteria: "",
  attachment_url: "",
  attachment_label: "",
  overlay_enabled: false,
  overlay_nome_x: null as number | null,
  overlay_nome_y: null as number | null,
  overlay_cpf_x: null as number | null,
  overlay_cpf_y: null as number | null,
};

const DEFAULT_FUNNEL = [
  {
    name: "Desconfiado",
    example_lines: "\"Nunca ouvi falar disso. Como funciona?\"",
    advance_criteria: "O atendente explicou claramente o que é o Cartão de Todos e como funciona o benefício.",
  },
  {
    name: "Interessado",
    example_lines: "\"Isso vale pra minha família toda?\" / \"Tem algum contrato?\"",
    advance_criteria: "O atendente esclareceu a dúvida específica do cliente e as condições contratuais.",
  },
  {
    name: "Convencido",
    example_lines: "\"E o que vocês precisam de mim?\" / \"Tudo bem, vou enviar.\"",
    advance_criteria: "O atendente pediu os documentos necessários (ex: CPF) para prosseguir com o cadastro.",
  },
  {
    name: "Cadastro",
    example_lines: "\"Conseguiu visualizar?\" / \"Precisa de mais alguma coisa?\"",
    advance_criteria: "O atendente confirmou o recebimento dos documentos e seguiu com o cadastro.",
  },
  {
    name: "Fechamento",
    example_lines: "\"Quando começa a valer?\" / \"Como acompanho isso?\"",
    advance_criteria: "O atendente concluiu o cadastro e explicou os próximos passos.",
  },
];

export function ClientProfileStatesEditor({
  profileId,
  profileNome,
  profileCpf,
  profileTitulo,
  profilePersonality,
  profileObjectives,
  profileObjections,
  profileBehaviors,
  profileDifficulty,
}: {
  profileId: string;
  profileNome?: string;
  profileCpf?: string;
  profileTitulo?: string;
  profilePersonality?: string;
  profileObjectives?: string;
  profileObjections?: string;
  profileBehaviors?: string;
  profileDifficulty?: string;
}) {
  const listFn = useServerFn(listClientProfileStates);
  const upsertFn = useServerFn(upsertClientProfileState);
  const deleteFn = useServerFn(deleteClientProfileState);
  const qc = useQueryClient();
  const queryKey = ["profile_states_admin", profileId];
  const q = useQuery({ queryKey, queryFn: () => listFn({ data: { profile_id: profileId } }) });
  const items = (q.data ?? []) as JourneyState[];

  const listMsgFn = useServerFn(listMessages);
  const messagesQ = useQuery({ queryKey: ["messages", "for-ai-context"], queryFn: () => listMsgFn({}) });
  const listContentFn = useServerFn(listContent);
  const knowledgeQ = useQuery({ queryKey: ["content", "conhecimento", "for-ai-context"], queryFn: () => listContentFn({ data: { section: "conhecimento" } }) });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_STATE>({ ...EMPTY_STATE });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [armMode, setArmMode] = useState<"nome" | "cpf" | null>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const upsertMut = useMutation({
    mutationFn: (payload: any) => upsertFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setOpen(false);
      setForm({ ...EMPTY_STATE });
      setArmMode(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar estado."),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Estado removido."); qc.invalidateQueries({ queryKey }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover."),
  });

  const openNew = () => { setForm({ ...EMPTY_STATE }); setArmMode(null); setOpen(true); };
  const openEdit = (s: JourneyState) => {
    setForm({
      id: s.id, name: s.name, description: s.description ?? "",
      example_lines: s.example_lines ?? "", advance_criteria: s.advance_criteria ?? "",
      attachment_url: s.attachment_url ?? "", attachment_label: s.attachment_label ?? "",
      overlay_enabled: s.overlay_enabled ?? false,
      overlay_nome_x: s.overlay_nome_x ?? null,
      overlay_nome_y: s.overlay_nome_y ?? null,
      overlay_cpf_x: s.overlay_cpf_x ?? null,
      overlay_cpf_y: s.overlay_cpf_y ?? null,
    });
    setArmMode(null);
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    upsertMut.mutate({
      id: form.id,
      profile_id: profileId,
      position: form.id ? items.find((i) => i.id === form.id)?.position ?? 0 : items.length,
      name: form.name,
      description: form.description || null,
      example_lines: form.example_lines || null,
      advance_criteria: form.advance_criteria || null,
      attachment_url: form.attachment_url || null,
      attachment_label: form.attachment_label || null,
      overlay_enabled: form.overlay_enabled,
      overlay_nome_x: form.overlay_nome_x,
      overlay_nome_y: form.overlay_nome_y,
      overlay_cpf_x: form.overlay_cpf_x,
      overlay_cpf_y: form.overlay_cpf_y,
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    upsertFn({ data: { ...a, position: b.position } })
      .then(() => upsertFn({ data: { ...b, position: a.position } }))
      .then(() => qc.invalidateQueries({ queryKey }))
      .catch(() => toast.error("Erro ao reordenar."));
  };

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem excede 8MB."); return; }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Usuário não autenticado");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${uid}/perfil_estados/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-images").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed) throw signErr ?? new Error("Não foi possível gerar URL da imagem");
      setForm((f) => ({ ...f, attachment_url: signed.signedUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar imagem");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const seedDefaultFunnel = async () => {
    for (let i = 0; i < DEFAULT_FUNNEL.length; i++) {
      const s = DEFAULT_FUNNEL[i];
      await upsertFn({ data: { profile_id: profileId, position: items.length + i, ...s } });
    }
    qc.invalidateQueries({ queryKey });
    toast.success("Funil padrão de 5 etapas adicionado.");
  };

  const genAI = useServerFn(simulatorChat);
  const [generating, setGenerating] = useState(false);
  const [genJornadaOpen, setGenJornadaOpen] = useState(false);
  const [referenciaManual, setReferenciaManual] = useState("");

  // Monta uma amostra do conteúdo real (Biblioteca de Mensagens + Conhecimento Geral)
  // para a IA usar como base, em vez de inventar temas/produtos.
  const montarBaseConhecimento = () => {
    const msgs = (messagesQ.data ?? []) as any[];
    const conhecimento = (knowledgeQ.data ?? []) as any[];
    const partesMsgs = msgs.slice(0, 12).map((m) => `- [${m.category?.name || "Geral"}] ${m.title}: ${String(m.content || "").slice(0, 240)}`);
    const partesConhecimento = conhecimento.slice(0, 8).map((c) => `- ${c.title}: ${String(c.content || "").slice(0, 240)}`);
    let base = "";
    if (partesMsgs.length > 0) base += `Trechos reais da Biblioteca de Mensagens (script aprovado da empresa):\n${partesMsgs.join("\n")}\n\n`;
    if (partesConhecimento.length > 0) base += `Trechos reais do Conhecimento Geral:\n${partesConhecimento.join("\n")}\n\n`;
    return base;
  };

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const baseConhecimento = montarBaseConhecimento();
      const prompt = `Você é um especialista em criar jornadas de atendimento para simulações de treinamento de vendas do "Cartão de Todos" (cartão de descontos em diversos serviços — consultas, exames, dentista, plataforma de cursos Refuturiza, entre outros benefícios, cada um com suas próprias regras).

${baseConhecimento ? `Use o conteúdo real abaixo (script aprovado da empresa) como base para as dúvidas, falas e critérios — não invente temas fora dele:\n${baseConhecimento}` : ""}${referenciaManual ? `Conteúdo de referência adicional informado pelo administrador (priorize isto):\n${referenciaManual}\n\n` : ""}
Baseado no perfil de cliente abaixo, crie uma jornada única de 4 a 6 estados que representam a evolução desse cliente durante o atendimento — do jeito que combina com a personalidade e as objeções DELE especificamente, não um funil genérico. A dúvida principal do cliente pode ser sobre QUALQUER parte do conteúdo acima (consultas, exames, dentista, Refuturiza, valores, etc.) — não fixe sempre no mesmo assunto.

Perfil do cliente:
Nome do perfil: ${profileTitulo || "-"}
Personalidade: ${profilePersonality || "-"}
Objetivos: ${profileObjectives || "-"}
Objeções típicas: ${profileObjections || "-"}
Comportamentos: ${profileBehaviors || "-"}
Dificuldade: ${profileDifficulty || "-"}

Regras obrigatórias:
- O primeiro estado reflete a objeção/desconfiança inicial típica desse perfil, ligada a um tema específico do conteúdo de referência (não genérico).
- Um dos estados do meio deve ser exatamente o momento em que o cliente concorda em enviar um documento (ex: CPF) para prosseguir com o cadastro — esse estado deve se chamar "Documentos" e ter "sendsDocument": true.
- O último estado é o fechamento da simulação.
- "advance_criteria" deve ser uma frase objetiva e checável (uma ação concreta que o atendente precisa fazer), nunca vaga.
- "example_lines" deve ter 1 a 2 falas de exemplo entre aspas, no tom da personalidade descrita, mencionando o tema específico da dúvida.

Responda APENAS com JSON válido, sem markdown e sem texto fora do JSON, neste formato exato:
{"estados": [{"name": "...", "example_lines": "...", "advance_criteria": "...", "sendsDocument": false}]}`;

      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: "Gere a jornada." }], model: "google/gemini-2.5-flash" } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const estados = Array.isArray(parsed.estados) ? parsed.estados : [];
      if (estados.length === 0) throw new Error("A IA não retornou estados válidos.");
      for (let i = 0; i < estados.length; i++) {
        const e = estados[i];
        await upsertFn({
          data: {
            profile_id: profileId,
            position: items.length + i,
            name: e.name || `Estado ${i + 1}`,
            example_lines: e.example_lines || null,
            advance_criteria: e.advance_criteria || null,
            attachment_label: e.sendsDocument ? "Aguardando upload da foto do documento" : null,
          },
        });
      }
      qc.invalidateQueries({ queryKey });
      setGenJornadaOpen(false);
      setReferenciaManual("");
      toast.success(`Jornada com ${estados.length} etapas gerada! Falta só anexar a foto do documento na etapa "Documentos".`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar jornada com IA.");
    } finally {
      setGenerating(false);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!armMode || !imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    if (armMode === "nome") {
      setForm((f) => ({ ...f, overlay_nome_x: xPct, overlay_nome_y: yPct }));
    } else {
      setForm((f) => ({ ...f, overlay_cpf_x: xPct, overlay_cpf_y: yPct }));
    }
    setArmMode(null);
  };

  // Desenha uma prévia real (imagem + textos) no canvas sempre que algo relevante mudar.
  useEffect(() => {
    if (!form.overlay_enabled || !form.attachment_url || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = "#111";
      ctx.font = `${Math.round(img.naturalWidth * 0.032)}px sans-serif`;
      ctx.textBaseline = "middle";
      if (form.overlay_nome_x != null && form.overlay_nome_y != null) {
        ctx.fillText(profileNome || "Nome do cliente", (form.overlay_nome_x / 100) * img.naturalWidth, (form.overlay_nome_y / 100) * img.naturalHeight);
      }
      if (form.overlay_cpf_x != null && form.overlay_cpf_y != null) {
        ctx.fillText(profileCpf || "000.000.000-00", (form.overlay_cpf_x / 100) * img.naturalWidth, (form.overlay_cpf_y / 100) * img.naturalHeight);
      }
    };
    img.src = form.attachment_url;
  }, [form.overlay_enabled, form.attachment_url, form.overlay_nome_x, form.overlay_nome_y, form.overlay_cpf_x, form.overlay_cpf_y, profileNome, profileCpf]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Defina os estados pelos quais esse cliente evolui durante a simulação. A IA avança de estado quando o atendente atende o critério descrito.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" /> Novo estado
        </Button>
        {items.length === 0 && (
          <>
            <Button size="sm" variant="secondary" className="gap-2" onClick={seedDefaultFunnel}>
              <Sparkles className="h-4 w-4" /> Usar funil padrão (5 etapas)
            </Button>
            <Button size="sm" variant="secondary" className="gap-2" onClick={() => setGenJornadaOpen(true)} disabled={generating}>
              <Sparkles className="h-4 w-4" /> {generating ? "Gerando..." : "Gerar jornada com IA"}
            </Button>
          </>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Nenhum estado cadastrado — o simulador vai conversar livremente com esse perfil, sem funil.
        </p>
      )}

      <div className="space-y-2">
        {items.map((s, i) => (
          <Card key={s.id} className="p-3 flex items-start gap-3">
            <div className="flex flex-col gap-0.5 pt-1">
              <button disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-20">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button disabled={i === items.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-20">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{i + 1}</Badge>
                <span className="font-medium text-sm">{s.name}</span>
                {s.attachment_url && <Badge variant="secondary" className="gap-1 text-[10px]"><ImagePlus className="h-3 w-3" /> {s.attachment_label || "anexo"}{s.overlay_enabled ? " · com overlay" : ""}</Badge>}
              </div>
              {s.advance_criteria && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">Critério: {s.advance_criteria}</p>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => confirm("Remover este estado?") && deleteMut.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={genJornadaOpen} onOpenChange={setGenJornadaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar jornada com IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Por padrão, a IA já usa uma amostra real da Biblioteca de Mensagens e do Conhecimento Geral como base, para não inventar temas. Se quiser, você pode reforçar ou direcionar o conteúdo abaixo (opcional).
            </p>
            <div>
              <Label>Conteúdo de referência (opcional)</Label>
              <Textarea rows={5} value={referenciaManual} onChange={(e) => setReferenciaManual(e.target.value)}
                placeholder='Ex: "Esse cliente tem dúvida principalmente sobre a Refuturiza e os cursos" ou cole um trecho de atendimento real.' />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenJornadaOpen(false)}>Cancelar</Button>
            <Button onClick={generateWithAI} disabled={generating}>
              {generating ? "Gerando..." : "Gerar jornada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar estado" : "Novo estado"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do estado</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Desconfiado" />
            </div>
            <div>
              <Label>Falas de exemplo</Label>
              <Textarea rows={2} value={form.example_lines} onChange={(e) => setForm((f) => ({ ...f, example_lines: e.target.value }))}
                placeholder='Ex: "Nunca ouvi falar disso. Como funciona?"' />
            </div>
            <div>
              <Label>Critério para avançar ao próximo estado</Label>
              <Textarea rows={2} value={form.advance_criteria} onChange={(e) => setForm((f) => ({ ...f, advance_criteria: e.target.value }))}
                placeholder="Ex: o atendente explicou claramente como funciona o desconto." />
            </div>
            <div>
              <Label>Observações internas (opcional)</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label>Documento fictício enviado ao chegar nesse estado (opcional)</Label>
              {form.attachment_url ? (
                <div className="relative h-20 w-20">
                  <img src={form.attachment_url} alt="anexo" className="h-20 w-20 object-cover rounded-md border" />
                  <button type="button" className="absolute -top-1.5 -right-1.5 bg-black/70 text-white rounded-full p-0.5"
                    onClick={() => setForm((f) => ({ ...f, attachment_url: "", overlay_enabled: false, overlay_nome_x: null, overlay_nome_y: null, overlay_cpf_x: null, overlay_cpf_y: null }))}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="outline" className="gap-2" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> {uploading ? "Enviando..." : "Enviar imagem (molde do documento)"}
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files)} />
              {form.attachment_url && (
                <Input value={form.attachment_label} onChange={(e) => setForm((f) => ({ ...f, attachment_label: e.target.value }))}
                  placeholder="Legenda (ex: Conta de luz)" />
              )}
            </div>

            {form.attachment_url && (
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sobrepor nome e CPF do perfil nesta imagem</Label>
                    <p className="text-xs text-muted-foreground">Desenha os dados fictícios do perfil (aba "Dados fictícios") por cima do molde ao enviar.</p>
                  </div>
                  <Switch checked={form.overlay_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, overlay_enabled: v }))} />
                </div>

                {form.overlay_enabled && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant={armMode === "nome" ? "default" : "outline"} className="gap-1"
                        onClick={() => setArmMode(armMode === "nome" ? null : "nome")}>
                        <MapPin className="h-3.5 w-3.5" /> Marcar posição do Nome
                      </Button>
                      <Button type="button" size="sm" variant={armMode === "cpf" ? "default" : "outline"} className="gap-1"
                        onClick={() => setArmMode(armMode === "cpf" ? null : "cpf")}>
                        <MapPin className="h-3.5 w-3.5" /> Marcar posição do CPF
                      </Button>
                    </div>
                    {armMode && (
                      <p className="text-xs text-primary">Clique no ponto da imagem abaixo onde o {armMode === "nome" ? "nome" : "CPF"} deve aparecer.</p>
                    )}
                    <div
                      ref={imgWrapRef}
                      onClick={handleImageClick}
                      className={`relative inline-block border rounded-md overflow-hidden ${armMode ? "cursor-crosshair ring-2 ring-primary" : ""}`}
                    >
                      <img src={form.attachment_url} alt="molde" className="max-w-full max-h-64 block" />
                      {form.overlay_nome_x != null && form.overlay_nome_y != null && (
                        <div className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1" style={{ left: `${form.overlay_nome_x}%`, top: `${form.overlay_nome_y}%` }}>
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 border border-white" />
                          <span className="text-[10px] bg-blue-500 text-white px-1 rounded">Nome</span>
                        </div>
                      )}
                      {form.overlay_cpf_x != null && form.overlay_cpf_y != null && (
                        <div className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1" style={{ left: `${form.overlay_cpf_x}%`, top: `${form.overlay_cpf_y}%` }}>
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white" />
                          <span className="text-[10px] bg-emerald-500 text-white px-1 rounded">CPF</span>
                        </div>
                      )}
                    </div>

                    {(form.overlay_nome_x != null || form.overlay_cpf_x != null) && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Prévia (com os dados fictícios reais do perfil):</p>
                        <canvas ref={canvasRef} className="max-w-full max-h-64 border rounded-md" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
