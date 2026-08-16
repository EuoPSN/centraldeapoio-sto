import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listChangelog } from "@/lib/changelog.functions";
import { listKnowledge, KNOWLEDGE_KINDS, type KnowledgeKind } from "@/lib/knowledge.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Search, Shield, ListChecks, FileText, MessagesSquare, Paperclip, GraduationCap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LAST_SEEN_KEY = "cdt_changelog_last_seen";

interface Entry { id: string; title: string; summary: string; published: boolean; created_at: string; }
interface KnowledgeRow { id: string; kind: KnowledgeKind; title: string; summary: string | null; content: string; }

const KIND_META: Record<KnowledgeKind, { label: string; icon: typeof Shield; color: string }> = {
  regra:           { label: "Regras",           icon: Shield,        color: "text-rose-600" },
  procedimento:    { label: "Procedimentos",    icon: ListChecks,    color: "text-blue-600" },
  artigo:          { label: "Artigos",          icon: FileText,      color: "text-emerald-600" },
  conversa_modelo: { label: "Conversas Modelo", icon: MessagesSquare,color: "text-amber-600" },
  documento:       { label: "Documentos",       icon: Paperclip,     color: "text-purple-600" },
  treinamento:     { label: "Treinamentos",     icon: GraduationCap, color: "text-indigo-600" },
};

export function ChangelogWidget() {
  const listFn = useServerFn(listChangelog);
  const q = useQuery({ queryKey: ["changelog"], queryFn: () => listFn({}) });
  const entries = ((q.data ?? []) as Entry[]).filter((e) => e.published);

  const knowledgeFn = useServerFn(listKnowledge);
  const kQ = useQuery({ queryKey: ["knowledge", "all"], queryFn: () => knowledgeFn({}) });
  const knowledge = (kQ.data ?? []) as KnowledgeRow[];

  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"novidades" | "ajuda">("novidades");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLastSeen(localStorage.getItem(LAST_SEEN_KEY));
  }, []);

  const unreadCount = lastSeen
    ? entries.filter((e) => new Date(e.created_at) > new Date(lastSeen)).length
    : entries.length;

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SEEN_KEY, now);
      setLastSeen(now);
    }
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    knowledge.forEach((k) => m.set(k.kind, (m.get(k.kind) ?? 0) + 1));
    return m;
  }, [knowledge]);

  const searchResults = useMemo(() => {
    const n = query.toLowerCase().trim();
    if (!n) return [];
    return knowledge
      .filter((k) => k.title.toLowerCase().includes(n) || (k.summary ?? "").toLowerCase().includes(n) || k.content.toLowerCase().includes(n))
      .slice(0, 8);
  }, [knowledge, query]);

  if (entries.length === 0 && knowledge.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="icon" className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg">
          <Star className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 max-h-[75vh] overflow-hidden p-0 flex flex-col">
        <div className="flex border-b border-border shrink-0">
          <button
            className={cn("flex-1 text-sm font-medium py-2.5 border-b-2 transition-colors",
              mode === "novidades" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            onClick={() => setMode("novidades")}
          >
            Novidades
          </button>
          <button
            className={cn("flex-1 text-sm font-medium py-2.5 border-b-2 transition-colors",
              mode === "ajuda" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            onClick={() => setMode("ajuda")}
          >
            Central de Ajuda
          </button>
        </div>

        <div className="overflow-y-auto">
          {mode === "novidades" ? (
            <div className="divide-y divide-border">
              {entries.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma novidade por enquanto.</p>}
              {entries.map((e) => (
                <div key={e.id} className="p-3">
                  <p className="font-medium text-sm">{e.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.summary}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(e.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8 h-9" placeholder="Buscar na base de conhecimento..."
                  value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>

              {query.trim() ? (
                <div className="space-y-1">
                  {searchResults.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nada encontrado.</p>}
                  {searchResults.map((k) => {
                    const meta = KIND_META[k.kind];
                    const Icon = meta.icon;
                    return (
                      <Link key={k.id} to="/conhecimento" hash={k.kind}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/60 transition-colors">
                        <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{k.title}</p>
                          <p className="text-[10px] text-muted-foreground">{meta.label}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {KNOWLEDGE_KINDS.map((kind) => {
                    const meta = KIND_META[kind];
                    const Icon = meta.icon;
                    const count = counts.get(kind) ?? 0;
                    return (
                      <Link key={kind} to="/conhecimento" hash={kind}
                        className="flex items-center gap-3 p-2.5 rounded-md border border-border hover:bg-muted/60 transition-colors">
                        <span className={cn("flex items-center justify-center h-8 w-8 rounded-md bg-muted shrink-0", meta.color)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{meta.label}</p>
                          <p className="text-[10px] text-muted-foreground">{count} item(ns)</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
