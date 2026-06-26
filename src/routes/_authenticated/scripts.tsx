import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMessages } from "@/lib/messages.functions";
import { listFlows, getFlow } from "@/lib/flows.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/CopyButton";
import { Markdown } from "@/components/Markdown";
import {
  Search, MessageSquareQuote, Network, Play, ChevronRight, ChevronDown,
  RotateCcw, GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/scripts")({
  component: Page,
});

function Page() {
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquareQuote className="h-7 w-7 text-primary" /> Scripts de Atendimento
        </h1>
        <p className="text-muted-foreground mt-1">
          Biblioteca de mensagens, fluxos de atendimento e simulador de treinamento.
        </p>
      </header>

      <Tabs defaultValue="biblioteca">
        <TabsList>
          <TabsTrigger value="biblioteca" className="gap-2"><MessageSquareQuote className="h-4 w-4" /> Biblioteca de Mensagens</TabsTrigger>
          <TabsTrigger value="fluxos" className="gap-2"><Network className="h-4 w-4" /> Central de Fluxos</TabsTrigger>
          <TabsTrigger value="simulador" className="gap-2"><Play className="h-4 w-4" /> Simulador</TabsTrigger>
        </TabsList>

        <TabsContent value="biblioteca" className="mt-6"><Biblioteca /></TabsContent>
        <TabsContent value="fluxos" className="mt-6"><CentralFluxos /></TabsContent>
        <TabsContent value="simulador" className="mt-6"><Simulador /></TabsContent>
      </Tabs>
    </div>
  );
}

// =====================================================
// 1. BIBLIOTECA DE MENSAGENS
// =====================================================
interface MessageRow {
  id: string;
  title: string;
  content: string;
  internal_note: string | null;
  category: { id: string; name: string; color: string | null } | null;
  subcategory: { id: string; name: string } | null;
  position: number;
}

function Biblioteca() {
  const fn = useServerFn(listMessages);
  const q = useQuery({ queryKey: ["messages"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");
  const [activeCat, setActiveCat] = useState<string>("todos");

  const rows = (q.data ?? []) as unknown as MessageRow[];
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.category) map.set(r.category.id, r.category.name); });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const n = filter.toLowerCase().trim();
    return rows.filter((r) => {
      if (activeCat !== "todos" && r.category?.id !== activeCat) return false;
      if (!n) return true;
      return r.title.toLowerCase().includes(n)
        || r.content.toLowerCase().includes(n)
        || (r.category?.name ?? "").toLowerCase().includes(n)
        || (r.subcategory?.name ?? "").toLowerCase().includes(n);
    });
  }, [rows, filter, activeCat]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por título, conteúdo, categoria..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button size="sm" variant={activeCat === "todos" ? "default" : "outline"} onClick={() => setActiveCat("todos")}>
          Todos ({filtered.length})
        </Button>
        {categories.map(([id, name]) => (
          <Button key={id} size="sm" variant={activeCat === id ? "default" : "outline"} onClick={() => setActiveCat(id)}>
            {name}
          </Button>
        ))}
      </div>

      {q.isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {!q.isLoading && filtered.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhuma mensagem encontrada.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre no Painel Admin → Mensagens.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((m) => (
          <Card key={m.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {m.category && (
                  <p className="text-xs uppercase tracking-wide text-primary font-medium">
                    {m.category.name}{m.subcategory ? ` · ${m.subcategory.name}` : ""}
                  </p>
                )}
                <h3 className="font-semibold mt-0.5">{m.title}</h3>
              </div>
              <CopyButton text={m.content} />
            </div>
            <div className="rounded-md bg-muted/40 border border-border p-3 max-h-64 overflow-y-auto">
              <Markdown>{m.content}</Markdown>
            </div>
            {m.internal_note && <p className="text-xs text-muted-foreground italic">📝 {m.internal_note}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// 2. CENTRAL DE FLUXOS
// =====================================================
interface FlowRow { id: string; title: string; description: string | null; is_training: boolean; }
interface NodeRow {
  id: string; flow_id: string; parent_id: string | null;
  node_type: string; title: string; message: string | null; note: string | null; position: number;
}

function CentralFluxos() {
  const fnList = useServerFn(listFlows);
  const flowsQ = useQuery({ queryKey: ["flows", "operacional"], queryFn: () => fnList({ data: { training: false } }) });
  const [selected, setSelected] = useState<string | null>(null);
  const flows = (flowsQ.data ?? []) as FlowRow[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <Card className="p-3">
        <h3 className="font-semibold mb-2 px-2 text-sm">Fluxos disponíveis</h3>
        {flows.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum fluxo cadastrado. Crie no Admin.</p>}
        <div className="space-y-1">
          {flows.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-md transition ${selected === f.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
            >
              {f.title}
            </button>
          ))}
        </div>
      </Card>

      <div>
        {!selected && (
          <Card className="p-10 text-center text-muted-foreground">Selecione um fluxo para visualizá-lo.</Card>
        )}
        {selected && <FlowTree flowId={selected} />}
      </div>
    </div>
  );
}

function FlowTree({ flowId }: { flowId: string }) {
  const fn = useServerFn(getFlow);
  const q = useQuery({ queryKey: ["flow", flowId], queryFn: () => fn({ data: { id: flowId } }) });

  if (q.isLoading) return <p className="text-muted-foreground">Carregando fluxo...</p>;
  if (!q.data) return null;
  const nodes = q.data.nodes as NodeRow[];
  const roots = nodes.filter((n) => !n.parent_id);

  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold mb-1">{q.data.flow.title}</h2>
      {q.data.flow.description && <p className="text-sm text-muted-foreground mb-4">{q.data.flow.description}</p>}
      <div className="space-y-2">
        {roots.length === 0 && <p className="text-sm text-muted-foreground">Fluxo vazio. Adicione nós no Admin.</p>}
        {roots.map((root) => <TreeNode key={root.id} node={root} all={nodes} depth={0} />)}
      </div>
    </Card>
  );
}

function nodeBadge(type: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    start: { label: "Início", color: "bg-primary/15 text-primary" },
    step: { label: "Etapa", color: "bg-muted text-foreground" },
    question: { label: "Pergunta", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
    answer: { label: "Resposta", color: "bg-green-500/15 text-green-700 dark:text-green-300" },
    objection: { label: "Objeção", color: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
    action: { label: "Ação", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
    end: { label: "Fim", color: "bg-destructive/15 text-destructive" },
  };
  return map[type] ?? map.step;
}

function TreeNode({ node, all, depth }: { node: NodeRow; all: NodeRow[]; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const children = all.filter((n) => n.parent_id === node.id).sort((a, b) => a.position - b.position);
  const has = children.length > 0;
  const b = nodeBadge(node.node_type);

  return (
    <div className="relative" style={{ marginLeft: depth * 24 }}>
      <Card className="p-3">
        <div className="flex items-start gap-2">
          <button onClick={() => setOpen(!open)} className="mt-0.5 text-muted-foreground hover:text-foreground" disabled={!has}>
            {has ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${b.color}`}>{b.label}</span>
              <h4 className="font-semibold text-sm">{node.title}</h4>
            </div>
            {node.message && (
              <div className="mt-2 flex gap-2 items-start">
                <div className="flex-1 rounded-md bg-muted/40 border border-border p-2 text-sm whitespace-pre-wrap">{node.message}</div>
                <CopyButton text={node.message} />
              </div>
            )}
            {node.note && <p className="text-xs text-muted-foreground italic mt-1">📝 {node.note}</p>}
          </div>
        </div>
      </Card>
      {open && has && (
        <div className="mt-2 space-y-2 border-l-2 border-dashed border-border pl-2">
          {children.map((c) => <TreeNode key={c.id} node={c} all={all} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

// =====================================================
// 3. SIMULADOR DE ATENDIMENTO
// =====================================================
function Simulador() {
  const fnList = useServerFn(listFlows);
  const flowsQ = useQuery({ queryKey: ["flows", "training"], queryFn: () => fnList({ data: { training: true } }) });
  const flows = (flowsQ.data ?? []) as FlowRow[];
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <Card className="p-3">
        <h3 className="font-semibold mb-2 px-2 text-sm flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Cenários</h3>
        {flows.length === 0 && (
          <p className="text-xs text-muted-foreground p-2">Nenhum cenário cadastrado. Crie no Admin com <strong>"Treinamento"</strong> marcado.</p>
        )}
        <div className="space-y-1">
          {flows.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-md transition ${selected === f.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
            >
              {f.title}
            </button>
          ))}
        </div>
      </Card>

      <div>
        {!selected && <Card className="p-10 text-center text-muted-foreground">Selecione um cenário para começar o treinamento.</Card>}
        {selected && <SimulatorRunner flowId={selected} />}
      </div>
    </div>
  );
}

function SimulatorRunner({ flowId }: { flowId: string }) {
  const fn = useServerFn(getFlow);
  const q = useQuery({ queryKey: ["flow", flowId], queryFn: () => fn({ data: { id: flowId } }) });
  const [path, setPath] = useState<NodeRow[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  if (q.isLoading || !q.data) return <p className="text-muted-foreground">Carregando...</p>;
  const nodes = q.data.nodes as NodeRow[];
  const roots = nodes.filter((n) => !n.parent_id).sort((a, b) => a.position - b.position);
  const current = currentId ? nodes.find((n) => n.id === currentId) : roots[0];
  const children = current ? nodes.filter((n) => n.parent_id === current.id).sort((a, b) => a.position - b.position) : [];

  const reset = () => { setPath([]); setCurrentId(null); };
  const choose = (n: NodeRow) => { if (current) setPath((p) => [...p, current]); setCurrentId(n.id); };

  if (!current) {
    return <Card className="p-10 text-center text-muted-foreground">Este cenário está vazio. Adicione nós no Admin.</Card>;
  }

  const b = nodeBadge(current.node_type);

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold">{q.data.flow.title}</h2>
        <Button size="sm" variant="outline" onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" /> Reiniciar</Button>
      </div>

      {path.length > 0 && (
        <div className="mb-4 text-xs text-muted-foreground">
          Caminho: {path.map((p) => p.title).join(" → ")} → <strong>{current.title}</strong>
        </div>
      )}

      <Card className="p-4 bg-muted/30 mb-4">
        <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${b.color}`}>{b.label}</span>
        <h3 className="font-semibold mt-2">{current.title}</h3>
        {current.message && (
          <div className="mt-3 flex gap-2 items-start">
            <div className="flex-1 rounded-md bg-card border border-border p-3 text-sm whitespace-pre-wrap">{current.message}</div>
            <CopyButton text={current.message} />
          </div>
        )}
        {current.note && <p className="text-xs text-muted-foreground italic mt-2">💡 {current.note}</p>}
      </Card>

      {children.length > 0 ? (
        <div>
          <p className="text-sm font-medium mb-2">O que o cliente responde?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {children.map((c) => {
              const cb = nodeBadge(c.node_type);
              return (
                <Button key={c.id} variant="outline" className="justify-start h-auto py-3 text-left" onClick={() => choose(c)}>
                  <div className="flex flex-col items-start gap-1 w-full">
                    <Badge variant="secondary" className={`text-[10px] ${cb.color}`}>{cb.label}</Badge>
                    <span className="text-sm font-medium whitespace-normal">{c.title}</span>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="p-6 text-center bg-success/5 border-success/30">
          <p className="text-success font-semibold">✓ Atendimento finalizado</p>
          <p className="text-sm text-muted-foreground mt-1">Você completou esse cenário. Clique em Reiniciar para treinar de novo.</p>
        </Card>
      )}
    </Card>
  );
}

// keep import lint happy
void listCategories;
