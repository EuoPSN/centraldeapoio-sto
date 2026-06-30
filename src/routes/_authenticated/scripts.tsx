import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMessages } from "@/lib/messages.functions";
import { listFlows } from "@/lib/flows.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { Markdown } from "@/components/Markdown";
import { FlowViewer } from "@/components/FlowEditor";
import { SimulatorRunner } from "@/components/SimulatorRunner";
import { Search, MessageSquareQuote, Network, Play, GraduationCap } from "lucide-react";
import { SimuladorIA } from "@/components/SimuladorIA";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/scripts")({
  component: Page,
});

function Page() {
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquareQuote className="h-7 w-7 text-primary" /> Atendimento
        </h1>
        <p className="text-muted-foreground mt-1">
          Biblioteca de mensagens, fluxos visuais de atendimento e simulador de treinamento.
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

interface MessageRow {
  id: string;
  title: string;
  content: string;
  internal_note: string | null;
  tags: string[];
  category: { id: string; name: string; color: string | null } | null;
  subcategory: { id: string; name: string } | null;
  position: number;
}

function Biblioteca() {
  const fn = useServerFn(listMessages);
  const q = useQuery({ queryKey: ["messages"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");
  const [activeCat, setActiveCat] = useState<string>("todos");
  const [activeSub, setActiveSub] = useState<string>("todos");

  const rows = (q.data ?? []) as unknown as MessageRow[];

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.category) map.set(r.category.id, r.category.name); });
    return Array.from(map.entries());
  }, [rows]);

  const subcategories = useMemo(() => {
    const map = new Map<string, string>();
    rows
      .filter((r) => activeCat === "todos" || r.category?.id === activeCat)
      .forEach((r) => { if (r.subcategory) map.set(r.subcategory.id, r.subcategory.name); });
    return Array.from(map.entries());
  }, [rows, activeCat]);

  const filtered = useMemo(() => {
    const n = filter.toLowerCase().trim();
    return rows.filter((r) => {
      if (activeCat !== "todos" && r.category?.id !== activeCat) return false;
      if (activeSub !== "todos" && r.subcategory?.id !== activeSub) return false;
      if (!n) return true;
      return r.title.toLowerCase().includes(n)
        || r.content.toLowerCase().includes(n)
        || (r.category?.name ?? "").toLowerCase().includes(n)
        || (r.subcategory?.name ?? "").toLowerCase().includes(n)
        || (r.tags ?? []).some((t) => t.toLowerCase().includes(n));
    });
  }, [rows, filter, activeCat, activeSub]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por título, conteúdo, tag, categoria..."
            value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" variant={activeCat === "todos" ? "default" : "outline"} onClick={() => { setActiveCat("todos"); setActiveSub("todos"); }}>
          Todas categorias
        </Button>
        {categories.map(([id, name]) => (
          <Button key={id} size="sm" variant={activeCat === id ? "default" : "outline"}
            onClick={() => { setActiveCat(id); setActiveSub("todos"); }}>
            {name}
          </Button>
        ))}
      </div>

      {subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 pl-2 border-l-2 border-border">
          <Button size="sm" variant={activeSub === "todos" ? "secondary" : "ghost"} onClick={() => setActiveSub("todos")}>
            Todas subcategorias
          </Button>
          {subcategories.map(([id, name]) => (
            <Button key={id} size="sm" variant={activeSub === id ? "secondary" : "ghost"} onClick={() => setActiveSub(id)}>
              {name}
            </Button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} mensagem(ns)</p>

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
            {m.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {m.tags.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">#{t}</span>
                ))}
              </div>
            )}
            {m.internal_note && <p className="text-xs text-muted-foreground italic">📝 {m.internal_note}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

interface FlowRow { id: string; title: string; description: string | null; is_training: boolean; }

function CentralFluxos() {
  const fnList = useServerFn(listFlows);
  const flowsQ = useQuery({ queryKey: ["flows", "operacional"], queryFn: () => fnList({ data: { training: false } }) });
  const [selected, setSelected] = useState<string | null>(null);
  const flows = (flowsQ.data ?? []) as FlowRow[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      <Card className="p-3 h-fit">
        <h3 className="font-semibold mb-2 px-2 text-sm">Fluxos disponíveis</h3>
        {flows.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum fluxo cadastrado. Crie no Admin.</p>}
        <div className="space-y-1">
          {flows.map((f) => (
            <button key={f.id} onClick={() => setSelected(f.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-md transition ${selected === f.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
              {f.title}
            </button>
          ))}
        </div>
      </Card>

      <div>
        {!selected && <Card className="p-10 text-center text-muted-foreground">Selecione um fluxo para visualizá-lo.</Card>}
        {selected && (
          <Card className="p-2">
            <FlowViewer flowId={selected} />
            <p className="text-xs text-muted-foreground p-2">
              👁️ Modo leitura. Para editar este fluxo, vá em Admin → Fluxos.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Simulador() {
  const fnList = useServerFn(listFlows);
  const flowsQ = useQuery({ queryKey: ["flows", "training"], queryFn: () => fnList({ data: { training: true } }) });
  const flows = (flowsQ.data ?? []) as FlowRow[];
  const [modo, setModo] = useState<"fluxo" | "ia">("fluxo");
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  const profilesQ = useQuery({
    queryKey: ["client_profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("client_profiles").select("*").order("created_at", { ascending: false });
      return data ?? [];
    }
  });
  const profiles = (profilesQ.data ?? []) as any[];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => { setModo("fluxo"); setSelectedFlow(null); setSelectedProfile(null); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${modo === "fluxo" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
          Modo Fluxo
        </button>
        <button onClick={() => { setModo("ia"); setSelectedFlow(null); setSelectedProfile(null); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${modo === "ia" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
          Modo IA
        </button>
      </div>

      {modo === "fluxo" && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          <Card className="p-3 h-fit">
            <h3 className="font-semibold mb-2 px-2 text-sm flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" /> Cenários
            </h3>
            {flows.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                Nenhum cenário cadastrado. No Admin → Fluxos, marque um fluxo como <strong>"Treinamento"</strong>.
              </p>
            )}
            <div className="space-y-1">
              {flows.map((f) => (
                <button key={f.id} onClick={() => setSelectedFlow(f.id)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-md transition ${selectedFlow === f.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                  {f.title}
                </button>
              ))}
            </div>
          </Card>
          <div>
            {!selectedFlow && <Card className="p-10 text-center text-muted-foreground">Selecione um cenário para começar o treinamento.</Card>}
            {selectedFlow && <SimulatorRunner flowId={selectedFlow} />}
          </div>
        </div>
      )}

      {modo === "ia" && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          {!selectedProfile ? (
            <>
              <Card className="p-3 h-fit">
                <h3 className="font-semibold mb-2 px-2 text-sm flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" /> Perfis de Cliente
                </h3>
                {profiles.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">
                    Nenhum perfil cadastrado. Vá em Admin → Perfis de Cliente.
                  </p>
                )}
                <div className="space-y-1">
                  {profiles.map((p: any) => (
                    <button key={p.id} onClick={() => setSelectedProfile(p)}
                      className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-muted transition">
                      {p.name}
                    </button>
                  ))}
                </div>
              </Card>
              <Card className="p-10 text-center text-muted-foreground">
                Selecione um perfil de cliente para iniciar a simulação com IA.
              </Card>
            </>
          ) : (
            <div className="lg:col-span-2">
              <SimuladorIA profile={selectedProfile} onReset={() => setSelectedProfile(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
