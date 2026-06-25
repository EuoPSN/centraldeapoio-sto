import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listConversations, getConversation, createConversation, sendMessage, deleteConversation } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from "@/components/Markdown";
import { Bot, Plus, Send, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistente")({
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listConversations);
  const get = useServerFn(getConversation);
  const create = useServerFn(createConversation);
  const send = useServerFn(sendMessage);
  const del = useServerFn(deleteConversation);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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
  }, [active.data?.messages.length]);

  const createMut = useMutation({
    mutationFn: () => create({}),
    onSuccess: (c) => {
      setActiveId(c.id);
      qc.invalidateQueries({ queryKey: ["chat-list"] });
    },
  });

  const sendMut = useMutation({
    mutationFn: async (text: string) => {
      let id = activeId;
      if (!id) {
        const c = await create({});
        id = c.id;
        setActiveId(id);
      }
      return send({ data: { conversationId: id, message: text } });
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
    if (!text || sendMut.isPending) return;
    setInput("");
    sendMut.mutate(text);
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
          {!activeId || (active.data?.messages.length ?? 0) === 0 ? (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center mb-4">
                  <Bot className="h-7 w-7 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold">Assistente CDT</h2>
                <p className="text-muted-foreground mt-2">
                  Pergunte sobre scripts, preços, procedimentos ou qualquer dúvida do atendimento. Eu consulto a base de conhecimento interna.
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
              {active.data?.messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} content={m.content} />
              ))}
              {sendMut.isPending && (
                <MessageBubble role="assistant" content="_Pensando..._" />
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card p-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
              }}
              placeholder="Pergunte ao assistente..."
              className="min-h-[52px] max-h-40 resize-none"
              disabled={sendMut.isPending}
            />
            <Button size="icon" className="h-[52px] w-[52px] shrink-0" onClick={onSend} disabled={sendMut.isPending || !input.trim()}>
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

function MessageBubble({ role, content }: { role: "user" | "assistant" | "system"; content: string }) {
  if (role === "system") return null;
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", isUser ? "bg-secondary" : "bg-gradient-to-br from-primary to-primary-glow")}>
        {isUser ? <User className="h-4 w-4 text-secondary-foreground" /> : <Bot className="h-4 w-4 text-primary-foreground" />}
      </div>
      <Card className={cn("p-4 max-w-[85%]", isUser ? "bg-primary text-primary-foreground border-primary" : "bg-card")}>
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        ) : (
          <Markdown>{content}</Markdown>
        )}
      </Card>
    </div>
  );
}
