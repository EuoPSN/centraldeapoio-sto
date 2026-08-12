import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listClientProfilesForTraining } from "@/lib/clientprofiles.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimuladorIA, DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/components/SimuladorIA";
import { Badge } from "@/components/ui/badge";
import { Bot, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/simulador-ia")({
  component: Page,
});

function Page() {
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  const listProfilesFn = useServerFn(listClientProfilesForTraining);
  const profilesQ = useQuery({
    queryKey: ["client_profiles", "training"],
    queryFn: () => listProfilesFn(),
  });
  const profiles = (profilesQ.data ?? []) as any[];

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
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-7 w-7 text-primary" /> Simulador IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Treine o atendimento conversando com clientes virtuais gerados por IA.
        </p>
      </header>

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
    </div>
  );
}
