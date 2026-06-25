import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listContent } from "@/lib/content.functions";
import { ContentList } from "@/components/ContentList";

export const Route = createFileRoute("/_authenticated/conhecimento")({
  component: Page,
});

function Page() {
  const fn = useServerFn(listContent);
  const q = useQuery({ queryKey: ["content", "conhecimento"], queryFn: () => fn({ data: { section: "conhecimento" } }) });
  return (
    <ContentList
      title="Conhecimento Geral"
      subtitle="Informações institucionais do Cartão de Todos: pacotes, benefícios, parceiros, regras."
      items={q.data ?? []}
      loading={q.isLoading}
    />
  );
}
