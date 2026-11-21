import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ETAPAS, type Etapa } from "@/lib/cliente-disse";
import { TextTabs, TopbarBreadcrumb } from "@/components/scripts/shared";
import { ObjecoesTab } from "@/components/cliente-disse/ObjecoesTab";
import { FecharTab } from "@/components/cliente-disse/FecharTab";
import { useClienteDisseBase } from "@/components/cliente-disse/shared";

type Aba = "objecoes" | "fechar";
interface Search { aba?: Aba; fala?: string; etapa?: Etapa; travamento?: string }

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

export const Route = createFileRoute("/_authenticated/scripts/cliente-disse")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    aba: s.aba === "fechar" ? "fechar" : s.aba === "objecoes" ? "objecoes" : undefined,
    fala: str(s.fala)?.slice(0, 2000),
    etapa: (ETAPAS as readonly string[]).includes(String(s.etapa)) ? (s.etapa as Etapa) : undefined,
    travamento: str(s.travamento),
  }),
  component: ClienteDissePage,
});

function ClienteDissePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/scripts/cliente-disse" });
  const base = useClienteDisseBase();
  const aba: Aba = search.aba ?? "objecoes";

  const setAba = (a: Aba) => navigate({ search: (s: Search) => ({ ...s, aba: a }), replace: true });
  const abrirFechar = (etapa: Etapa, travamento?: string) =>
    navigate({ search: (s: Search) => ({ ...s, aba: "fechar", etapa, travamento }), replace: true });

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Atendimento" }, { label: "Scripts", to: "/scripts" }, { label: "O cliente disse…" }]} />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
        <h1 className="text-2xl font-medium leading-8 text-ink">O cliente disse…</h1>
        <p className="text-[14px] text-ink-muted">Cole a fala do cliente como veio. A ferramenta diz o que é e entrega a resposta aprovada.</p>
      </div>

      <div className="mt-5">
        <TextTabs<Aba>
          label="Ferramentas"
          dataTour="cliente-disse-1"
          items={[{ id: "objecoes", name: "Objeções" }, { id: "fechar", name: "Fechar com este cliente" }]}
          value={aba}
          onChange={setAba}
        />
      </div>

      {base.isError && <p className="mt-4 text-[13.5px] text-ink-muted">Não consegui carregar as respostas agora. Tente de novo.</p>}

      {/* As duas abas ficam montadas para não perder o que foi digitado ao trocar. */}
      <div hidden={aba !== "objecoes"}>
        <ObjecoesTab base={base.data} falaInicial={search.fala} onAbrirFechar={abrirFechar} />
      </div>
      <div hidden={aba !== "fechar"}>
        <FecharTab base={base.data} etapaInicial={search.etapa} travamentoInicial={search.travamento} />
      </div>
    </div>
  );
}
