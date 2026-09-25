import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listClientProfilesForTraining } from "@/lib/clientprofiles.functions";
import { listProblemScenariosForTraining } from "@/lib/problemscenarios.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimuladorIA, DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/components/SimuladorIA";
import { SimuladorProblema } from "@/components/SimuladorProblema";
import { Badge } from "@/components/ui/badge";
import { Bot, GraduationCap, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/simulador-ia")({
  component: Page,
  validateSearch: (search: Record<string, unknown>): { perfil?: string; modo?: "problemas" } => ({
    perfil: typeof search.perfil === "string" ? search.perfil : undefined,
    modo: search.modo === "problemas" ? "problemas" as const : undefined,
  }),
});

function Page() {
  const { perfil, modo: modoInicial } = Route.useSearch();
  const [modo, setModo] = useState<"atendimentos" | "problemas">(modoInicial === "problemas" ? "problemas" : "atendimentos");

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-7 w-7 text-primary" /> Simulador IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Treine o atendimento conversando com clientes virtuais gerados por IA.
        </p>
      </header>

      <div className="flex gap-2 mb-6">
        <Button variant={modo === "atendimentos" ? "default" : "outline"} onClick={() => setModo("atendimentos")} className="gap-2">
          <GraduationCap className="h-4 w-4" /> Atendimentos
        </Button>
        <Button variant={modo === "problemas" ? "default" : "outline"} onClick={() => setModo("problemas")} className="gap-2">
          <Wrench className="h-4 w-4" /> Solução de Problemas
        </Button>
      </div>

      {modo === "atendimentos" ? <AtendimentosTab perfilInicial={perfil} /> : <ProblemasTab />}
    </div>
  );
}

function AtendimentosTab({ perfilInicial }: { perfilInicial?: string }) {
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [autoSelecionado, setAutoSelecionado] = useState(false);

  const listProfilesFn = useServerFn(listClientProfilesForTraining);
  const profilesQ = useQuery({
    queryKey: ["client_profiles", "training"],
    queryFn: () => listProfilesFn(),
  });
  const profiles = (profilesQ.data ?? []) as any[];

  // Se a página abriu com ?perfil=<id> (ex: vindo do card "Vamos testar?" da tela inicial),
  // seleciona esse perfil automaticamente assim que a lista carregar.
  useEffect(() => {
    if (perfilInicial && !autoSelecionado && profiles.length > 0) {
      const found = profiles.find((p: any) => p.id === perfilInicial);
      if (found) setSelectedProfile(found);
      setAutoSelecionado(true);
    }
  }, [perfilInicial, profiles, autoSelecionado]);

  const listCatFn = useServerFn(listCategories);
  const catsQ = useQuery({
    queryKey: ["cats", "client_profile"],
    queryFn: () => listCatFn({ data: { scope: "client_profile" } }),
  });
  const categorias = (catsQ.data ?? []) as { id: string; name: string }[];
  const [activeCategoria, setActiveCategoria] = useState<string>("todos");

  const profilesFiltrados = activeCategoria === "todos"
    ? profiles
    : profiles.filter((p: any) => p.category_id === activeCategoria);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      {!selectedProfile ? (
        <>
          <Card className="p-3 h-fit">
            <h3 className="font-semibold mb-2 px-2 text-sm flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" /> Perfis de Cliente
            </h3>
            {categorias.length > 0 && (
              <div className="flex flex-wrap gap-1 px-2 mb-2">
                <Button size="sm" variant={activeCategoria === "todos" ? "default" : "outline"}
                  onClick={() => setActiveCategoria("todos")} className="h-7 text-xs">
                  Todas
                </Button>
                {categorias.map((c) => (
                  <Button key={c.id} size="sm" variant={activeCategoria === c.id ? "default" : "outline"}
                    onClick={() => setActiveCategoria(c.id)} className="h-7 text-xs">
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
            {profiles.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                Nenhum perfil cadastrado. Vá em Admin → Perfis de Cliente.
              </p>
            )}
            {profiles.length > 0 && profilesFiltrados.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                Nenhum perfil nessa subcategoria ainda.
              </p>
            )}
            <div className="space-y-1">
              {profilesFiltrados.map((p: any) => (
                <button key={p.id} onClick={() => setSelectedProfile(p)}
                  className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-muted transition">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span>{p.name}</span>
                    {p.difficulty && DIFFICULTY_LABELS[p.difficulty] && (
                      <Badge className={`text-[10px] ${DIFFICULTY_COLORS[p.difficulty]}`}>
                        {DIFFICULTY_LABELS[p.difficulty]}
                      </Badge>
                    )}
                  </span>
                  {p.category?.name && (
                    <span className="block text-[10px] text-muted-foreground">{p.category.name}</span>
                  )}
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
  );
}

function ProblemasTab() {
  const [selectedScenario, setSelectedScenario] = useState<any>(null);

  const listScenariosFn = useServerFn(listProblemScenariosForTraining);
  const scenariosQ = useQuery({
    queryKey: ["problem_scenarios", "training"],
    queryFn: () => listScenariosFn(),
  });
  const scenarios = (scenariosQ.data ?? []) as any[];

  const listCatFn = useServerFn(listCategories);
  const catsQ = useQuery({
    queryKey: ["cats", "problema"],
    queryFn: () => listCatFn({ data: { scope: "problema" } }),
  });
  const categorias = (catsQ.data ?? []) as { id: string; name: string }[];
  const [activeCategoria, setActiveCategoria] = useState<string>("todos");

  const scenariosFiltrados = activeCategoria === "todos"
    ? scenarios
    : scenarios.filter((s: any) => s.category_id === activeCategoria);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      {!selectedScenario ? (
        <>
          <Card className="p-3 h-fit">
            <h3 className="font-semibold mb-2 px-2 text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" /> Situações-Problema
            </h3>
            {categorias.length > 0 && (
              <div className="flex flex-wrap gap-1 px-2 mb-2">
                <Button size="sm" variant={activeCategoria === "todos" ? "default" : "outline"}
                  onClick={() => setActiveCategoria("todos")} className="h-7 text-xs">
                  Todas
                </Button>
                {categorias.map((c) => (
                  <Button key={c.id} size="sm" variant={activeCategoria === c.id ? "default" : "outline"}
                    onClick={() => setActiveCategoria(c.id)} className="h-7 text-xs">
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
            {scenarios.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                Nenhum cenário cadastrado. Vá em Admin → Situações-Problema.
              </p>
            )}
            {scenarios.length > 0 && scenariosFiltrados.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                Nenhum cenário nessa categoria ainda.
              </p>
            )}
            <div className="space-y-1">
              {scenariosFiltrados.map((s: any) => (
                <button key={s.id} onClick={() => setSelectedScenario(s)}
                  className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-muted transition">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span>{s.name}</span>
                    {s.difficulty && DIFFICULTY_LABELS[s.difficulty] && (
                      <Badge className={`text-[10px] ${DIFFICULTY_COLORS[s.difficulty]}`}>
                        {DIFFICULTY_LABELS[s.difficulty]}
                      </Badge>
                    )}
                  </span>
                  {s.category?.name && (
                    <span className="block text-[10px] text-muted-foreground">{s.category.name}</span>
                  )}
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-10 text-center text-muted-foreground">
            Selecione uma situação-problema para começar.
          </Card>
        </>
      ) : (
        <div className="lg:col-span-2">
          <SimuladorProblema scenario={selectedScenario} onReset={() => setSelectedScenario(null)} />
        </div>
      )}
    </div>
  );
}
