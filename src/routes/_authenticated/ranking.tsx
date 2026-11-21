import { createFileRoute } from "@tanstack/react-router";
import { RankingPage } from "@/components/ranking/RankingPage";

type Aba = "podios" | "hall" | "historico";

export const Route = createFileRoute("/_authenticated/ranking")({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({
    aba: s.aba === "hall" || s.aba === "historico" || s.aba === "podios" ? s.aba : undefined,
  }),
  component: function Ranking() {
    const { aba } = Route.useSearch();
    return <RankingPage abaInicial={aba} />;
  },
});
