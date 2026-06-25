import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listContent } from "@/lib/content.functions";
import { ContentList } from "@/components/ContentList";

export const Route = createFileRoute("/_authenticated/_app/tutoriais")({
  component: Page,
});

function Page() {
  const fn = useServerFn(listContent);
  const q = useQuery({ queryKey: ["content", "tutoriais"], queryFn: () => fn({ data: { section: "tutoriais" } }) });
  return (
    <ContentList
      title="Tutoriais"
      subtitle="Passo a passo de procedimentos específicos do atendimento: KYC, migração, pendências."
      items={q.data ?? []}
      loading={q.isLoading}
    />
  );
}
