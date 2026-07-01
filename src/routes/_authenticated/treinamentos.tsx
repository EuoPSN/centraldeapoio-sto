import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listContent } from "@/lib/content.functions";
import { ContentList } from "@/components/ContentList";

export const Route = createFileRoute("/_authenticated/treinamentos")({
  component: Page,
});

function Page() {
  const fn = useServerFn(listContent);
  const q = useQuery({
    queryKey: ["content", "treinamentos"],
    queryFn: () => fn({ data: { section: "treinamentos" } })
  });
  return (
    <ContentList
      title="Treinamentos"
      subtitle="Materiais de treinamento, vídeos, apresentações e recursos de capacitação da equipe."
      items={q.data ?? []}
      loading={q.isLoading}
    />
  );
}
