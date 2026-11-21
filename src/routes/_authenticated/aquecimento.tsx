import { createFileRoute } from "@tanstack/react-router";
import { AquecimentoPage } from "@/components/aquecimento/AquecimentoPage";

interface Search { tema?: string }

export const Route = createFileRoute("/_authenticated/aquecimento")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tema: typeof s.tema === "string" && /^[0-9a-f-]{36}$/i.test(s.tema) ? s.tema : undefined,
  }),
  component: function Aquecimento() {
    const { tema } = Route.useSearch();
    // A chave força um estado novo quando o tema muda (daily ↔ tema).
    return <AquecimentoPage key={tema ?? "diaria"} temaId={tema} />;
  },
});
