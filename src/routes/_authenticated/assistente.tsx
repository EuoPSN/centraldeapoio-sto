import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listConversations, getMessages, createConversation, sendMessage, deleteConversation } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from "@/components/Markdown";
import { Bot, Plus, Send, Trash2, User, Paperclip, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import marcianaAvatar from "@/assets/marciana-avatar.png";

function MarcIAnaAvatar({ className }: { className?: string }) {
  return (
    <img
      src={marcianaAvatar}
      alt="MarcIAna"
      className={cn("object-contain", className)}
    />
  );
}


export const Route = createFileRoute("/_authenticated/assistente")({
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listConversations);
  const get = useServerFn(getMessages);
  const create = useServerFn(createConversation);
  const send = useServerFn(sendMessage);
  const del = useServerFn(deleteConversation);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
const [pendingImages, setPendingImages] = useState<{ url: string; name: string }[]>([]);
const [uploadingImg, setUploadingImg] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

const handleFilesSelected = async (files: FileList | null) => {
  if (!files || files.length === 0) return;
  const remaining = 4 - pendingImages.length;
  if (remaining <= 0) {
    toast.error("Máximo de 4 imagens por mensagem.");
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
      const ext = file.name.split('.').pop() ?? "jpg";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60 * 24 * 365);
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

const removePendingImage = (index: number) => {
  setPendingImages((prev) => prev.filter((_, i) => i !== index));
};

  const convs = useQuery({ queryKey: ["chat-list"], queryFn: () => list({}) });
  const active = useQuery({
    queryKey: ["chat", activeId],
    queryFn: () => get({ data: { conversationId: activeId as string } }),
    enabled: !!activeId,
  });

  useEffect(() => {
    if (!activeId && convs.data && convs.data.length > 0) {
      setActiveId(convs.data[0].id);
    }
  }, [convs.data, activeId]);

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
  mutationFn: async (payload: { text: string; images: string[] }) => {
    let id = activeId;
    if (!id) {
      const c = await create({});
      id = c.id;
      setActiveId(id);
    }
    return send({ data: { conversationId: id, message: payload.text, images: payload.images } });
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["chat", activeId] });
    qc.invalidateQueries({ queryKey: ["chat-list"] });
  },
  onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar"),
});

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { conversationId: id } }),
    onSuccess: (_d, id) => {
      if (activeId === id) setActiveId(null);
      qc.invalidateQueries({ queryKey: ["chat-list"] });
    },
  });

  const onSend = () => {
  const text = input.trim();
  if (( !text && pendingImages.length === 0) || sendMut.isPending) return;
  setInput("");
  const images = pendingImages.map((i) => i.url);
  setPendingImages([]);
  sendMut.mutate({ text, images });
};

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <Button size="sm" className="w-full gap-2" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            <Plus className="h-4 w-4" /> Nova conversa
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {(convs.data ?? []).map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer text-sm hover:bg-accent/40 transition-colors",
                  activeId === c.id && "bg-primary/10 text-primary"
                )}
                onClick={() => setActiveId(c.id)}
              >
                <span className="truncate flex-1">{c.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); delMut.mutate(c.id); }}
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {convs.data?.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                Nenhuma conversa ainda.
              </p>
            )}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!activeId || (active.data?.length ?? 0) === 0 ? (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
                  <MarcIAnaAvatar className="h-20 w-20" />
                </div>
                <h2 className="text-2xl font-bold">MarcIAna</h2>
                <p className="text-muted-foreground mt-2">
                  Sua assistente especializada em atendimento Cartão de Todos. Pergunte à vontade.
                </p>
                <p className="text-muted-foreground mt-4 text-sm font-medium">
                  Olá! Sou a MarcIAna, sua assistente de atendimento. Como posso te ajudar hoje?
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {[
                    "Quanto custa uma consulta com cardiologista?",
                    "Qual o script de abertura para vendas?",
                    "Como funciona a migração de planos?",
                    "O que fazer se o sistema travar?",
                  ].map((s) => (
                    <button
                      key={s}
                      className="text-sm rounded-lg border border-border bg-card hover:bg-accent/40 p-3 text-left transition-colors"
                      onClick={() => { setInput(s); }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {active.data?.map((m) => (
                <MessageBubble key={m.id} role={m.role as "user" | "assistant" | "system"} content={m.content} attachments={(m as any).attachments ?? []} />
              ))}
              {sendMut.isPending && (
                <MessageBubble role="assistant" content="_Pensando..._" />
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card p-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    multiple
    className="hidden"
    onChange={(e) => handleFilesSelected(e.target.files)}
  />
  <Button
    type="button"
    size="icon"
    variant="outline"
    className="h-[52px] w-[52px] shrink-0"
    onClick={() => fileInputRef.current?.click()}
    disabled={uploadingImg || pendingImages.length >= 4}
  >
    <Paperclip className="h-4 w-4" />
  </Button>
  <Textarea
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
    }}
    placeholder="Pergunte para a MarcIAna..."
    className="min-h-[52px] max-h-40 resize-none"
    disabled={sendMut.isPending}
  />
  <Button size="icon" className="h-[52px] w-[52px] shrink-0" onClick={onSend} disabled={sendMut.isPending || (!input.trim() && pendingImages.length === 0)}>
    <Send className="h-4 w-4" />
  </Button>
</div>
          <p className="max-w-3xl mx-auto text-[10px] text-muted-foreground text-center mt-2">
            As respostas são geradas por IA com base na documentação interna. Verifique informações críticas.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ role, content, attachments }: { role: "user" | "assistant" | "system"; content: string; attachments?: string[] }) {
  if (role === "system") return null;
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && <span className="text-[11px] text-muted-foreground self-center">MarcIAna</span>}
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden", isUser && "bg-secondary")}>
        {isUser ? (
          <User className="h-4 w-4 text-secondary-foreground" />
        ) : (
          <MarcIAnaAvatar className="h-8 w-8" />
        )}
      </div>
      <Card className={cn("p-4 max-w-[85%]", isUser ? "bg-primary text-primary-foreground border-primary" : "bg-card")}>
        {attachments && attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {attachments.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="anexo" className="h-24 w-24 object-cover rounded-md border border-border/50" />
              </a>
            ))}
          </div>
        )}
        {content && (isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        ) : (
          <Markdown>{content}</Markdown>
        ))}
      </Card>
    </div>
  );
}
