import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listContent } from "@/lib/content.functions";
import { ContentList } from "@/components/ContentList";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/tutoriais")({
  component: Page,
});

function Page() {
  const fn = useServerFn(listContent);
  const [aba, setAba] = useState<"tutoriais" | "treinamentos">("tutoriais");

  const tutoriaisQ = useQuery({
    queryKey: ["content", "tutoriais"],
    queryFn: () => fn({ data: { section: "tutoriais" } })
  });

  const treinamentosQ = useQuery({
    queryKey: ["content", "treinamentos"],
    queryFn: () => fn({ data: { section: "treinamentos" } })
  });

  return (
    <div>
      <div className="flex gap-2 px-6 lg:px-10 pt-6 lg:pt-10 max-w-6xl mx-auto">
        <button
          onClick={() => setAba("tutoriais")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            aba === "tutoriais"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Tutoriais
        </button>
        <button
          onClick={() => setAba("treinamentos")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            aba === "treinamentos"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Treinamentos
        </button>
      </div>

      {aba === "tutoriais" && (
        <ContentList
          title="Tutoriais"
          subtitle="Passo a passo de procedimentos específicos do atendimento."
          items={tutoriaisQ.data ?? []}
          loading={tutoriaisQ.isLoading}
        />
      )}

      {aba === "treinamentos" && (
        <ContentList
          title="Treinamentos"
          subtitle="Materiais de treinamento, vídeos, apresentações e recursos de capacitação da equipe."
          items={treinamentosQ.data ?? []}
          loading={treinamentosQ.isLoading}
        />
      )}
    </div>
  );
}

