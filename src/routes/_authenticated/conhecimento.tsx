import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listKnowledge, signKnowledgeFile, KNOWLEDGE_KINDS, type KnowledgeKind } from "@/lib/knowledge.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import {
  BookOpen, Search, Shield, ListChecks, FileText, MessagesSquare, Paperclip, GraduationCap,
  Download, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/conhecimento")({ component: Page });

const KIND_META: Record<KnowledgeKind, { label: string; icon: typeof Shield; color: string }> = {
  regra:           { label: "Regras",           icon: Shield,        color: "text-rose-600" },
  procedimento:    { label: "Procedimentos",    icon: ListChecks,    color: "text-blue-600" },
  artigo:          { label: "Artigos",          icon: FileText,      color: "text-emerald-600" },
  conversa_modelo: { label: "Conversas Modelo", icon: MessagesSquare,color: "text-amber-600" },
  documento:       { label: "Documentos",       icon: Paperclip,     color: "text-purple-600" },
  treinamento:     { label: "Treinamentos",     icon: GraduationCap, color: "text-indigo-600" },
};

function Page() {
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" /> Base de Conhecimento IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Tudo que está aqui alimenta as respostas da Assistente. Organizado por tipo para facilitar a consulta.
        </p>
      </header>

      <Tabs defaultValue="regra">
        <TabsList className="flex-wrap h-auto">
          {KNOWLEDGE_KINDS.map((k) => {
            const m = KIND_META[k];
            const Icon = m.icon;
            return (
              <TabsTrigger key={k} value={k} className="gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${m.color}`} /> {m.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {KNOWLEDGE_KINDS.map((k) => (
          <TabsContent key={k} value={k} className="mt-6">
            <KindList kind={k} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface Entry {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  summary: string | null;
  tags: string[];
  file_url: string | null;
  file_mime: string | null;
  file_name: string | null;
  external_url: string | null;
  category: { id: string; name: string; color: string | null } | null;
}

function KindList({ kind }: { kind: KnowledgeKind }) {
  const fn = useServerFn(listKnowledge);
  const q = useQuery({ queryKey: ["knowledge", kind], queryFn: () => fn({ data: { kind } }) });
  const [filter, setFilter] = useState("");
  const [activeCat, setActiveCat] = useState("todos");

  const rows = (q.data ?? []) as unknown as Entry[];

  const categories = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => { if (r.category) m.set(r.category.id, r.category.name); });
    return Array.from(m.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const n = filter.toLowerCase().trim();
    return rows.filter((r) => {
      if (activeCat !== "todos" && r.category?.id !== activeCat) return false;
      if (!n) return true;
      return r.title.toLowerCase().includes(n)
        || r.content.toLowerCase().includes(n)
        || (r.summary ?? "").toLowerCase().includes(n)
        || (r.tags ?? []).some((t) => t.toLowerCase().includes(n));
    });
  }, [rows, filter, activeCat]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant={activeCat === "todos" ? "default" : "outline"} onClick={() => setActiveCat("todos")}>
            Todas
          </Button>
          {categories.map(([id, name]) => (
            <Button key={id} size="sm" variant={activeCat === id ? "default" : "outline"} onClick={() => setActiveCat(id)}>
              {name}
            </Button>
          ))}
        </div>
      )}

      {q.isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {!q.isLoading && filtered.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhum item cadastrado.</p>
          <p className="text-xs text-muted-foreground mt-1">O admin pode adicionar em Painel → Base de Conhecimento.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((e) => <EntryCard key={e.id} entry={e} />)}
      </div>
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  const [expanded, setExpanded] = useState(false);
  const sign = useServerFn(signKnowledgeFile);

  const handleOpenFile = async () => {
    if (!entry.file_url) return;
    try {
      const r = await sign({ data: { path: entry.file_url } });
      window.open(r.url, "_blank");
    } catch {
      // ignore
    }
  };

  const isVideo = entry.file_mime?.startsWith("video/");
  const isImage = entry.file_mime?.startsWith("image/");
  const isPdf = entry.file_mime === "application/pdf";

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {entry.category && (
            <p className="text-xs uppercase tracking-wide text-primary font-medium">{entry.category.name}</p>
          )}
          <h3 className="font-semibold mt-0.5">{entry.title}</h3>
          {entry.summary && <p className="text-xs text-muted-foreground mt-1">{entry.summary}</p>}
        </div>
      </div>

      {entry.content && (
        <div className={`rounded-md bg-muted/40 border border-border p-3 ${expanded ? "" : "max-h-48 overflow-hidden relative"}`}>
          <Markdown>{entry.content}</Markdown>
          {!expanded && entry.content.length > 400 && (
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-muted/80 to-transparent flex items-end justify-center pb-1">
              <Button size="sm" variant="ghost" onClick={() => setExpanded(true)}>Ler mais</Button>
            </div>
          )}
        </div>
      )}

      {entry.file_url && (
        <FilePreview entry={entry} isVideo={!!isVideo} isImage={!!isImage} isPdf={!!isPdf} onOpen={handleOpenFile} />
      )}

      {entry.external_url && (
        <a href={entry.external_url} target="_blank" rel="noreferrer"
          className="text-xs flex items-center gap-1 text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> {entry.external_url}
        </a>
      )}

      {entry.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

function FilePreview({ entry, isVideo, isImage, isPdf, onOpen }:
  { entry: Entry; isVideo: boolean; isImage: boolean; isPdf: boolean; onOpen: () => void }) {
  const sign = useServerFn(signKnowledgeFile);
  const urlQ = useQuery({
    queryKey: ["sign", entry.file_url],
    queryFn: () => sign({ data: { path: entry.file_url! } }),
    enabled: !!entry.file_url && (isVideo || isImage || isPdf),
    staleTime: 50 * 60 * 1000,
  });
  const url = urlQ.data?.url;

  return (
    <div className="space-y-2">
      {isVideo && url && (
        <video src={url} controls className="w-full rounded-md max-h-80" />
      )}
      {isImage && url && (
        <img src={url} alt={entry.title} className="w-full rounded-md max-h-80 object-contain bg-muted/40" />
      )}
      {isPdf && url && (
        <iframe src={url} title={entry.title} className="w-full h-80 rounded-md border border-border" />
      )}
      <Button size="sm" variant="outline" onClick={onOpen} className="gap-1.5">
        <Download className="h-3.5 w-3.5" /> {entry.file_name || "Baixar arquivo"}
      </Button>
    </div>
  );
}
