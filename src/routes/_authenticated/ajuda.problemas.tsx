import { createFileRoute } from "@tanstack/react-router";
import { AjudaArticleList } from "@/components/ajuda/AjudaArticleList";

type Search = { artigo?: string };

export const Route = createFileRoute("/_authenticated/ajuda/problemas")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    artigo: typeof s.artigo === "string" && s.artigo ? s.artigo : undefined,
  }),
  component: Page,
});

function Page() {
  const { artigo } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AjudaArticleList
      section="problemas"
      sectionLabel="Problemas técnicos"
      overline="Problemas técnicos"
      breadcrumbLabel="Problemas técnicos"
      artigo={artigo}
      onSelect={(id) => navigate({ search: { artigo: id }, replace: true })}
    />
  );
}
