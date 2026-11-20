import { createFileRoute } from "@tanstack/react-router";
import { RaioxPage } from "@/components/copiloto/RaioxPage";

interface Search { retomada?: string }

export const Route = createFileRoute("/_authenticated/raiox")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    retomada: typeof s.retomada === "string" && /^[0-9a-f-]{36}$/i.test(s.retomada) ? s.retomada : undefined,
  }),
  component: function Raiox() {
    const { retomada } = Route.useSearch();
    return <RaioxPage retomadaId={retomada} />;
  },
});
