import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OrcamentoBar } from "@/components/amor-saude/OrcamentoBar";

// Amor Saúde: entrada + Consultas, Exames, Odontologia e Clínicas.
// A barra do orçamento acompanha a pessoa em todas as subpáginas.
export const Route = createFileRoute("/_authenticated/amor-saude")({
  component: AmorSaudeLayout,
});

function AmorSaudeLayout() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--topbar-h))] flex-col md:h-[calc(100dvh-var(--topbar-h))]">
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
      <OrcamentoBar />
    </div>
  );
}
