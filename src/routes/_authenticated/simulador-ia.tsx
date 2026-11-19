import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listClientProfilesForTraining } from "@/lib/clientprofiles.functions";
import { listProblemScenariosForTraining } from "@/lib/problemscenarios.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { getMyProfileStats } from "@/lib/gamification.functions";
import { Card } from "@/components/ui/card";
import { SimuladorIA } from "@/components/SimuladorIA";
import { SimuladorProblema } from "@/components/SimuladorProblema";
import { SimuladorListScreen } from "@/components/simulador/ClientListScreen";
import { MinhasSimulacoesTab } from "@/components/simulador/MinhasSimulacoesTab";
import { cn } from "@/lib/utils";

type Aba = "atendimentos" | "problemas" | "minhas";

export const Route = createFileRoute("/_authenticated/simulador-ia")({
  component: Page,
  validateSearch: (search: Record<string, unknown>): { perfil?: string; aba?: Aba } => {
    const aba = search.aba === "problemas" || search.aba === "minhas" || search.aba === "atendimentos"
      ? (search.aba as Aba)
      : search.modo === "problemas" ? "problemas" as const : undefined;
    return {
      perfil: typeof search.perfil === "string" ? search.perfil : undefined,
      aba,
    };
  },
});

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn(
        "pb-2.5 px-0.5 text-sm font-medium border-b-2 -mb-px transition-colors",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}>
      {children}
    </button>
  );
}

function Page() {
  const { perfil, aba: abaInicial } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [aba, setAba] = useState<Aba>(abaInicial ?? "atendimentos");

  useEffect(() => {
    if (abaInicial) setAba(abaInicial);
  }, [abaInicial]);

  const trocarAba = (nova: Aba) => {
    setAba(nova);
    navigate({ search: (prev) => ({ ...prev, aba: nova }) });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:px-8 lg:py-7">
      <header className="mb-4">
        <h1 className="text-2xl font-medium">Simulador IA</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Treine com clientes virtuais antes de falar com os reais.
        </p>
      </header>

      <div className="flex gap-6 border-b mb-6">
        <TabButton active={aba === "atendimentos"} onClick={() => trocarAba("atendimentos")}>Atendimentos</TabButton>
        <TabButton active={aba === "problemas"} onClick={() => trocarAba("problemas")}>Solução de problemas</TabButton>
        <TabButton active={aba === "minhas"} onClick={() => trocarAba("minhas")}>Minhas simulações</TabButton>
      </div>

      {aba === "atendimentos" && <AtendimentosTab perfilInicial={perfil} />}
      {aba === "problemas" && <ProblemasTab />}
      {aba === "minhas" && <MinhasSimulacoesTab />}
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

  const statsFn = useServerFn(getMyProfileStats);
  const statsQ = useQuery({ queryKey: ["my-profile-stats"], queryFn: () => statsFn() });
  const stats = (statsQ.data as any)?.porPerfil ?? {};

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

  if (selectedProfile) {
    return <SimuladorIA profile={selectedProfile} onReset={() => setSelectedProfile(null)} />;
  }

  if (profiles.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Nenhum perfil cadastrado. Vá em Admin → Perfis de Cliente.
      </Card>
    );
  }

  return (
    <SimuladorListScreen
      titulo="Simulador IA"
      subtitulo="Nenhum perfil cadastrado."
      items={profiles}
      categorias={categorias}
      stats={stats}
      onSelect={setSelectedProfile}
    />
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

  const statsFn = useServerFn(getMyProfileStats);
  const statsQ = useQuery({ queryKey: ["my-profile-stats"], queryFn: () => statsFn() });
  const stats = (statsQ.data as any)?.porCenario ?? {};

  const listCatFn = useServerFn(listCategories);
  const catsQ = useQuery({
    queryKey: ["cats", "problema"],
    queryFn: () => listCatFn({ data: { scope: "problema" } }),
  });
  const categorias = (catsQ.data ?? []) as { id: string; name: string }[];

  if (selectedScenario) {
    return <SimuladorProblema scenario={selectedScenario} onReset={() => setSelectedScenario(null)} />;
  }

  if (scenarios.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Nenhum cenário cadastrado. Vá em Admin → Situações-Problema.
      </Card>
    );
  }

  return (
    <SimuladorListScreen
      titulo="Situações-Problema"
      subtitulo="Nenhum cenário cadastrado."
      items={scenarios}
      categorias={categorias}
      stats={stats}
      onSelect={setSelectedScenario}
      mostrarTreineHoje={false}
    />
  );
}
