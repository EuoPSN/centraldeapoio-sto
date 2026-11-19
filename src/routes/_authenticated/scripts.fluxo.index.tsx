import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FlowCover } from "@/components/scripts/FlowCover";
import {
  TopbarBreadcrumb, TextTabs, SkeletonLine, buildFlows, etapasLabel, useFlowData, useMessageCategories,
} from "@/components/scripts/shared";

type CatalogoSearch = { categoria?: string };

export const Route = createFileRoute("/_authenticated/scripts/fluxo/")({
  validateSearch: (s: Record<string, unknown>): CatalogoSearch => ({
    categoria: typeof s.categoria === "string" && s.categoria ? s.categoria : undefined,
  }),
  component: FluxoCatalogo,
});

function FluxoCatalogo() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const cats = useMessageCategories();
  const flowData = useFlowData();
  const { groups, flows } = useMemo(() => buildFlows(cats.rows, flowData.stages), [cats.rows, flowData.stages]);
  const loading = cats.isLoading || flowData.isLoading;

  const activeGroup = groups.find((g) => g.id === search.categoria)?.id ?? groups[0]?.id ?? null;
  const visible = flows.filter((f) => f.groupId === activeGroup);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-8 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Scripts", to: "/scripts" }, { label: "Fluxo de atendimento" }]} />

      <h1 className="text-2xl font-semibold leading-8 text-ink">Fluxo de atendimento</h1>
      <p className="mt-1 text-[15px] leading-6 text-ink-muted">Escolha o fluxo pelo perfil do cliente.</p>

      <div className="mt-5">
        {loading ? (
          <div className="flex gap-6 border-b border-line pb-3"><SkeletonLine className="h-4 w-28" /><SkeletonLine className="h-4 w-24" /><SkeletonLine className="h-4 w-32" /></div>
        ) : groups.length > 0 ? (
          <TextTabs
            label="Categorias do fluxo"
            items={groups}
            value={activeGroup}
            onChange={(id) => navigate({ search: { categoria: id }, replace: true })}
          />
        ) : null}
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-[14px] border border-line">
              <SkeletonLine className="h-[120px] rounded-none" />
              <div className="space-y-2 p-4"><SkeletonLine className="h-4 w-32" /><SkeletonLine className="h-3 w-16" /></div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">Nenhum fluxo cadastrado ainda.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((f) => (
            <li key={f.key}>
              <Link
                to="/scripts/fluxo/$fluxo"
                params={{ fluxo: f.key }}
                className="group block h-full overflow-hidden rounded-[14px] border border-line bg-surface transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <FlowCover name={f.name} />
                <div className="px-4 pb-4 pt-3.5">
                  <h2 className="text-base font-semibold leading-6 text-ink">{f.name}</h2>
                  <p className="mt-1.5 text-[13px] font-semibold leading-5 text-gold-text">{etapasLabel(f.trunk.length)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
