import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listConversations,
  getMessages,
  createConversation,
  sendMessage,
  deleteConversation,
  generateClientMessage,
} from "@/lib/chat.functions";
import { listMarcianaSugestoes } from "@/lib/marciana-sugestoes.functions";
import {
  submitMarcianaFeedback,
  listMyFeedbackForConversation,
} from "@/lib/marciana-feedback.functions";
import { getMe } from "@/lib/content.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Markdown } from "@/components/Markdown";
import { MarcianaEye, type MarcianaEyeState } from "@/components/marciana/MarcianaEye";
import {
  Plus,
  Send,
  Trash2,
  User,
  Paperclip,
  X,
  Search,
  ThumbsUp,
  ThumbsDown,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistente")({
  // ?pergunta=... vem da busca global ("Perguntar à MarcIAna"): abre uma conversa
  // nova já enviando essa pergunta.
  validateSearch: (s: Record<string, unknown>): { pergunta?: string } =>
    typeof s.pergunta === "string" && s.pergunta.trim() ? { pergunta: s.pergunta.trim() } : {},
  component: Page,
});

// ============================================================
// Compatibilidade com mensagens antigas: antes da coluna "sources", as
// fontes vinham concatenadas no fim do texto com esse marcador exato.
// ============================================================
const LEGACY_SOURCES_MARKER = "\n\n---\n**Fontes consultadas:**\n";
function splitLegacySources(content: string): { main: string; legacySources: string | null } {
  const idx = content.indexOf(LEGACY_SOURCES_MARKER);
  if (idx === -1) return { main: content, legacySources: null };
  return {
    main: content.slice(0, idx),
    legacySources: content.slice(idx + LEGACY_SOURCES_MARKER.length),
  };
}

type Source = { title: string; source_type: string };
type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: string[] | null;
  sources?: Source[] | null;
  cliente_mensagem?: string | null;
  sem_base?: boolean | null;
  created_at?: string;
};
type ConvRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  search_text?: string;
};
type FeedbackRow = { message_id: string; tipo: "util" | "nao_util" };

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function groupLabel(dateStr: string): string {
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(new Date(dateStr))) / 86400000);
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays <= 7) return "Últimos 7 dias";
  return "Mais antigas";
}
const GROUP_ORDER = ["Hoje", "Ontem", "Últimos 7 dias", "Mais antigas"];

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listConversations);
  const get = useServerFn(getMessages);
  const create = useServerFn(createConversation);
  const send = useServerFn(sendMessage);
  const del = useServerFn(deleteConversation);
  const generateClient = useServerFn(generateClientMessage);
  const submitFeedback = useServerFn(submitMarcianaFeedback);
  const listFeedback = useServerFn(listMyFeedbackForConversation);
  const listSugestoes = useServerFn(listMarcianaSugestoes);
  const meFn = useServerFn(getMe);

  const { pergunta } = Route.useSearch();
  const navigate = Route.useNavigate();
  const perguntaFeita = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<{ url: string; name: string }[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [heroFocused, setHeroFocused] = useState(false);
  const [doneMessageId, setDoneMessageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn({}) });
  const isAdmin = (me.data as { isAdmin?: boolean } | undefined)?.isAdmin ?? false;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 4 - pendingImages.length;
    if (remaining <= 0) {
      toast.error("Máximo de 4 imagens por mensagem.");
      return;
    }
    const fileList = Array.from(files).slice(0, remaining);
    setUploadingImg(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Usuário não autenticado");
      for (const file of fileList) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} não é uma imagem.`);
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`${file.name} excede 8MB.`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("chat-images").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw error;
        const { data: signed, error: signErr } = await supabase.storage
          .from("chat-images")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signErr || !signed) throw signErr ?? new Error("Não foi possível gerar URL da imagem");
        setPendingImages((prev) => [...prev, { url: signed.signedUrl, name: file.name }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar imagem");
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onPasteImage = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      void handleFilesSelected(dt.files);
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const convs = useQuery({ queryKey: ["chat-list"], queryFn: () => list({}) });
  const active = useQuery({
    queryKey: ["chat", activeId],
    queryFn: () => get({ data: { conversationId: activeId as string } }),
    enabled: !!activeId,
  });
  const myFeedback = useQuery({
    queryKey: ["chat-feedback", activeId],
    queryFn: () => listFeedback({ data: { conversationId: activeId as string } }),
    enabled: !!activeId,
  });
  const sugestoes = useQuery({
    queryKey: ["marciana-sugestoes-public"],
    queryFn: () => listSugestoes({}),
  });

  useEffect(() => {
    if (pergunta || perguntaFeita.current) return;
    if (!activeId && convs.data && convs.data.length > 0) {
      setActiveId(convs.data[0].id);
    }
  }, [convs.data, activeId, pergunta]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [active.data?.length]);

  const createMut = useMutation({
    mutationFn: () => create({}),
    onSuccess: (c) => {
      setActiveId(c.id);
      qc.invalidateQueries({ queryKey: ["chat-list"] });
    },
  });

  const sendMut = useMutation({
    mutationFn: async (payload: { text: string; images: string[]; newConversation?: boolean }) => {
      let id = payload.newConversation ? null : activeId;
      if (!id) {
        const c = await create({});
        id = c.id;
        setActiveId(id);
        qc.invalidateQueries({ queryKey: ["chat-list"] });
      }
      const res = await send({
        data: { conversationId: id, message: payload.text, images: payload.images },
      });
      return {
        conversationId: id as string,
        assistantMessageId: (res.assistantMessage as { id?: string } | null)?.id,
      };
    },
    onSuccess: ({ conversationId, assistantMessageId }) => {
      qc.invalidateQueries({ queryKey: ["chat", conversationId] });
      qc.invalidateQueries({ queryKey: ["chat-list"] });
      if (assistantMessageId) {
        setDoneMessageId(assistantMessageId);
        setTimeout(
          () => setDoneMessageId((cur) => (cur === assistantMessageId ? null : cur)),
          2400,
        );
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar"),
  });

  // Pergunta vinda da busca global: conversa nova, envio imediato, e a URL volta
  // a /assistente para um recarregar não repetir a pergunta.
  useEffect(() => {
    if (!pergunta || perguntaFeita.current === pergunta) return;
    perguntaFeita.current = pergunta;
    navigate({ search: {}, replace: true });
    sendMut.mutate({ text: pergunta, images: [], newConversation: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pergunta]);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { conversationId: id } }),
    onSuccess: (_d, id) => {
      if (activeId === id) setActiveId(null);
      qc.invalidateQueries({ queryKey: ["chat-list"] });
    },
  });

  const clientMsgMut = useMutation({
    mutationFn: (messageId: string) => generateClient({ data: { messageId } }),
    onSuccess: (_r, messageId) => {
      qc.invalidateQueries({ queryKey: ["chat", activeId] });
      void messageId;
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao gerar mensagem para o cliente"),
  });

  const feedbackMut = useMutation({
    mutationFn: (v: {
      messageId: string;
      tipo: "util" | "nao_util";
      motivos: string[];
      comentario?: string;
    }) =>
      submitFeedback({
        data: {
          messageId: v.messageId,
          conversationId: activeId as string,
          tipo: v.tipo,
          motivos: v.motivos,
          comentario: v.comentario,
        },
      }),
    onSuccess: () => {
      toast.success("Obrigado pelo retorno!");
      qc.invalidateQueries({ queryKey: ["chat-feedback", activeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar feedback"),
  });

  const sendText = (text: string, newConversation = false) => {
    if (sendMut.isPending) return;
    sendMut.mutate({ text, images: [], newConversation });
  };

  const onSend = () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || sendMut.isPending) return;
    setInput("");
    const images = pendingImages.map((i) => i.url);
    setPendingImages([]);
    sendMut.mutate({ text, images });
  };

  const convsList = (convs.data ?? []) as ConvRow[];
  const filteredConvs = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return convsList;
    return convsList.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.search_text ?? "").toLowerCase().includes(q),
    );
  }, [convsList, historySearch]);
  const groupedConvs = useMemo(() => {
    const map = new Map<string, ConvRow[]>();
    for (const c of filteredConvs) {
      const label = groupLabel(c.updated_at);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(c);
    }
    return map;
  }, [filteredConvs]);

  const hasConversation = !!activeId && (active.data?.length ?? 0) > 0;
  const feedbackByMessage = new Map(
    ((myFeedback.data ?? []) as FeedbackRow[]).map((f) => [f.message_id, f.tipo]),
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      <aside className="w-[280px] border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
          >
            <Plus className="h-4 w-4" /> Nova conversa
          </Button>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Buscar conversas…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-3">
            {GROUP_ORDER.map((label) => {
              const items = groupedConvs.get(label);
              if (!items || items.length === 0) return null;
              return (
                <div key={label}>
                  <p className="type-overline px-2 pb-1 text-muted-foreground">{label}</p>
                  <div className="space-y-0.5">
                    {items.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          "group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer text-sm hover:bg-accent/40 transition-colors",
                          activeId === c.id && "bg-accent/40 font-semibold",
                        )}
                        onClick={() => setActiveId(c.id)}
                      >
                        <span className="truncate flex-1">{c.title}</span>
                        <button
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            delMut.mutate(c.id);
                          }}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredConvs.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                {historySearch ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda."}
              </p>
            )}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {!hasConversation && !sendMut.isPending ? (
          <HeroEmptyState
            focused={heroFocused}
            onFocusChange={setHeroFocused}
            input={input}
            setInput={setInput}
            pendingImages={pendingImages}
            removePendingImage={removePendingImage}
            uploadingImg={uploadingImg}
            onAttachClick={() => fileInputRef.current?.click()}
            onPasteImage={onPasteImage}
            fileInputRef={fileInputRef}
            onFilesSelected={handleFilesSelected}
            onSend={onSend}
            sending={sendMut.isPending}
            sugestoes={
              (sugestoes.data ?? []) as unknown as { id: string; texto: string; ativo: boolean }[]
            }
            onSugestao={(texto) => sendText(texto, true)}
          />
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="max-w-[780px] mx-auto px-4 py-6 space-y-6">
                {active.data?.map((m) => (
                  <MessageBubble
                    key={m.id}
                    msg={m as ChatMsg}
                    isAdmin={isAdmin}
                    eyeState={
                      doneMessageId === m.id ? "done" : (m as ChatMsg).sem_base ? "miss" : "idle"
                    }
                    feedback={feedbackByMessage.get(m.id)}
                    onCopy={() => {
                      navigator.clipboard
                        .writeText(splitLegacySources((m as ChatMsg).content).main)
                        .catch(() => {});
                      toast.success("Copiado.");
                    }}
                    onGenerateClientMessage={() => clientMsgMut.mutate(m.id)}
                    generatingClientMessage={
                      clientMsgMut.isPending && clientMsgMut.variables === m.id
                    }
                    onFeedback={(tipo, motivos, comentario) =>
                      feedbackMut.mutate({ messageId: m.id, tipo, motivos, comentario })
                    }
                  />
                ))}
                {sendMut.isPending && sendMut.variables?.text && (
                  <UserBubble content={sendMut.variables.text} attachments={[]} />
                )}
                {sendMut.isPending && <ThinkingIndicator />}
              </div>
            </div>

            <div className="border-t border-border bg-card p-4">
              <div className="max-w-[780px] mx-auto">
                <QuestionField
                  input={input}
                  setInput={setInput}
                  pendingImages={pendingImages}
                  removePendingImage={removePendingImage}
                  uploadingImg={uploadingImg}
                  onAttachClick={() => fileInputRef.current?.click()}
                  onPasteImage={onPasteImage}
                  onSend={onSend}
                  sending={sendMut.isPending}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  As respostas são geradas por IA com base na documentação interna. Verifique
                  informações críticas.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tela inicial (sem conversa aberta)
// ============================================================
function HeroEmptyState(props: {
  focused: boolean;
  onFocusChange: (v: boolean) => void;
  input: string;
  setInput: (v: string) => void;
  pendingImages: { url: string; name: string }[];
  removePendingImage: (i: number) => void;
  uploadingImg: boolean;
  onAttachClick: () => void;
  onPasteImage: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (files: FileList | null) => void;
  onSend: () => void;
  sending: boolean;
  sugestoes: { id: string; texto: string; ativo: boolean }[];
  onSugestao: (texto: string) => void;
}) {
  const ativas = props.sugestoes.filter((s) => s.ativo).slice(0, 6);
  return (
    <div className="h-full flex items-center justify-center p-8 overflow-y-auto">
      <div className="text-center max-w-xl w-full">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center text-gold-text">
          <MarcianaEye size={96} state={props.focused ? "listening" : "idle"} />
        </div>
        <h1 className="font-institutional text-2xl">Pergunte à MarcIAna</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Produtos, regras e valores do Cartão de TODOS. Ela responde a partir da base da Central.
        </p>

        <div
          className="mt-6"
          onFocus={() => props.onFocusChange(true)}
          onBlur={() => props.onFocusChange(false)}
        >
          <QuestionField
            input={props.input}
            setInput={props.setInput}
            pendingImages={props.pendingImages}
            removePendingImage={props.removePendingImage}
            uploadingImg={props.uploadingImg}
            onAttachClick={props.onAttachClick}
            onPasteImage={props.onPasteImage}
            onSend={props.onSend}
            sending={props.sending}
          />
        </div>
        <input
          ref={props.fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => props.onFilesSelected(e.target.files)}
        />

        {ativas.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {ativas.map((s) => (
              <button
                key={s.id}
                onClick={() => props.onSugestao(s.texto)}
                className="rounded-full border border-border bg-card hover:bg-accent/40 hover:border-gold/50 px-3.5 py-1.5 text-sm text-left transition-colors"
              >
                {s.texto}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Campo de pergunta — usado na tela inicial (maior) e fixo no rodapé.
// ============================================================
function QuestionField(props: {
  input: string;
  setInput: (v: string) => void;
  pendingImages: { url: string; name: string }[];
  removePendingImage: (i: number) => void;
  uploadingImg: boolean;
  onAttachClick: () => void;
  onPasteImage: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  sending: boolean;
}) {
  return (
    <div>
      {props.pendingImages.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {props.pendingImages.map((img, i) => (
            <div
              key={img.url}
              className="relative h-16 w-16 rounded-md overflow-hidden border border-border"
            >
              <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => props.removePendingImage(i)}
                className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 hover:bg-background"
                aria-label="Remover anexo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-[52px] w-[52px] shrink-0"
          onClick={props.onAttachClick}
          disabled={props.uploadingImg || props.pendingImages.length >= 4}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          value={props.input}
          onChange={(e) => props.setInput(e.target.value)}
          onPaste={props.onPasteImage}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              props.onSend();
            }
          }}
          placeholder="Pergunte para a MarcIAna… (Ctrl+V cola um print)"
          className="min-h-[52px] max-h-40 resize-none"
          disabled={props.sending}
        />
        <Button
          size="icon"
          className="h-[52px] w-[52px] shrink-0"
          onClick={props.onSend}
          disabled={props.sending || (!props.input.trim() && props.pendingImages.length === 0)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Avatar do olho (idle/listening/thinking/writing/done/miss)
// ============================================================
function EyeAvatar({ state = "idle", size = 22 }: { state?: MarcianaEyeState; size?: number }) {
  return (
    <div className="h-[34px] w-[34px] rounded-full border border-border flex items-center justify-center shrink-0 text-gold-text">
      <MarcianaEye size={size} state={state} />
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <EyeAvatar state="thinking" />
      <span className="text-sm text-muted-foreground">MarcIAna está pensando…</span>
    </div>
  );
}

function UserBubble({ content, attachments }: { content: string; attachments: string[] }) {
  return (
    <div className="flex gap-3 flex-row-reverse">
      <div className="h-[34px] w-[34px] rounded-full bg-secondary flex items-center justify-center shrink-0">
        <User className="h-4 w-4 text-secondary-foreground" />
      </div>
      <div className="rounded-xl bg-secondary px-4 py-3 max-w-[85%]">
        {attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {attachments.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt="anexo"
                  className="h-24 w-24 object-cover rounded-md border border-border/50"
                />
              </a>
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

// ============================================================
// Mensagem da MarcIAna: avatar + markdown sem balão, ações e feedback.
// ============================================================
function MessageBubble(props: {
  msg: ChatMsg;
  isAdmin: boolean;
  eyeState: MarcianaEyeState;
  feedback?: "util" | "nao_util";
  onCopy: () => void;
  onGenerateClientMessage: () => void;
  generatingClientMessage: boolean;
  onFeedback: (tipo: "util" | "nao_util", motivos: string[], comentario?: string) => void;
}) {
  const { msg } = props;
  const [showSources, setShowSources] = useState(false);
  if (msg.role === "system") return null;
  if (msg.role === "user")
    return <UserBubble content={msg.content} attachments={msg.attachments ?? []} />;

  const { main, legacySources } = splitLegacySources(msg.content);
  const hasSources = (msg.sources && msg.sources.length > 0) || !!legacySources;

  return (
    <div className="flex gap-3">
      <EyeAvatar state={props.eyeState} />
      <div className="min-w-0 flex-1">
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {msg.attachments.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt="anexo"
                  className="h-24 w-24 object-cover rounded-md border border-border/50"
                />
              </a>
            ))}
          </div>
        )}
        <Markdown>{main}</Markdown>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={props.onCopy}
          >
            <Copy className="h-3 w-3" /> Copiar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-gold text-gold-text hover:bg-gold/10"
            onClick={props.onGenerateClientMessage}
            disabled={props.generatingClientMessage}
          >
            {props.generatingClientMessage ? "Gerando..." : "Mensagem para o cliente"}
          </Button>
          <FeedbackButton
            tipo="util"
            active={props.feedback === "util"}
            onSubmit={(motivos, comentario) => props.onFeedback("util", motivos, comentario)}
          />
          <FeedbackButton
            tipo="nao_util"
            active={props.feedback === "nao_util"}
            onSubmit={(motivos, comentario) => props.onFeedback("nao_util", motivos, comentario)}
          />
          {props.isAdmin && hasSources && (
            <button
              type="button"
              onClick={() => setShowSources((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-auto"
            >
              Ver fontes · só admin
            </button>
          )}
        </div>

        {props.isAdmin && showSources && hasSources && (
          <div className="mt-2 text-xs text-muted-foreground">
            {msg.sources && msg.sources.length > 0 ? (
              <ul className="space-y-0.5">
                {msg.sources.map((s, i) => (
                  <li key={i}>
                    — <em>{s.source_type}</em> · {s.title}
                  </li>
                ))}
              </ul>
            ) : (
              <Markdown>{legacySources ?? ""}</Markdown>
            )}
          </div>
        )}

        {msg.cliente_mensagem && (
          <div className="mt-3 rounded-md bg-secondary border-l-2 border-gold px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="type-overline text-gold-text">Mensagem para o cliente</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(msg.cliente_mensagem ?? "").catch(() => {});
                  toast.success("Copiado.");
                }}
              >
                <Copy className="h-3 w-3" /> Copiar
              </Button>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap">{msg.cliente_mensagem}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Útil / Não útil — popover com pílulas de motivo.
// ============================================================
const MOTIVOS_NAO_UTIL = [
  "Informação errada",
  "Incompleta",
  "Desatualizada",
  "Não entendeu minha pergunta",
  "Não serviu para o cliente",
];
const MOTIVOS_UTIL = ["Usei com o cliente", "Me ensinou algo", "Resposta rápida e certa"];

function FeedbackButton({
  tipo,
  active,
  onSubmit,
}: {
  tipo: "util" | "nao_util";
  active: boolean;
  onSubmit: (motivos: string[], comentario?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comentario, setComentario] = useState("");
  const motivos = tipo === "util" ? MOTIVOS_UTIL : MOTIVOS_NAO_UTIL;
  const title = tipo === "util" ? "O que ajudou?" : "O que faltou nessa resposta?";
  const requireAtLeastOne = tipo === "nao_util";
  const Icon = tipo === "util" ? ThumbsUp : ThumbsDown;

  const toggle = (m: string) =>
    setSelected((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const handleSend = () => {
    if (requireAtLeastOne && selected.length === 0) {
      toast.error("Escolha pelo menos uma opção.");
      return;
    }
    onSubmit(selected, comentario.trim() || undefined);
    setOpen(false);
    setSelected([]);
    setComentario("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className={cn("h-7 w-7", active && "bg-secondary")}
          aria-label={tipo === "util" ? "Útil" : "Não útil"}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        <p className="text-sm font-medium">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {motivos.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                selected.includes(m)
                  ? "border-gold bg-gold/10 text-gold-text"
                  : "border-border hover:bg-accent/40",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <Textarea
          rows={2}
          placeholder="Quer explicar? (opcional)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          className="text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSend}>
            Enviar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
