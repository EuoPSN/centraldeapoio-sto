import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listContent } from "@/lib/content.functions";
import { ContentList } from "@/components/ContentList";

export const Route = createFileRoute("/_authenticated/problemas")({
  component: Page,
});

function Page() {
  const fn = useServerFn(listContent);
  const q = useQuery({ queryKey: ["content", "problemas"], queryFn: () => fn({ data: { section: "problemas" } }) });
  return (
    <ContentList
      title="Problemas Técnicos"
      subtitle="Soluções rápidas para os problemas mais comuns do dia a dia: PC, sistema, login, etc."
      items={q.data ?? []}
      loading={q.isLoading}
    />
  );
}
