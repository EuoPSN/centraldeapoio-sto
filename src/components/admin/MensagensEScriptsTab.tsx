import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listDraftsForReview } from "@/lib/messagedrafts.functions";
import { MessagesTab } from "@/components/admin/MessagesTab";
import { ScriptReviewTab } from "@/components/admin/ScriptReviewTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Seção "Mensagens e scripts": a biblioteca de mensagens e a fila de scripts
// enviados pelos atendentes (Criar Scripts) para revisão, lado a lado.
export function MensagensEScriptsTab({ defaultTab = "mensagens" }: { defaultTab?: "mensagens" | "revisar" } = {}) {
  const listFn = useServerFn(listDraftsForReview);
  const pendentesQ = useQuery({ queryKey: ["drafts-review", "pendente"], queryFn: () => listFn({ data: { status: "pendente" } }) });
  const pendentes = pendentesQ.data?.length ?? 0;

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
        <TabsTrigger value="revisar" className="gap-1.5">
          Scripts para revisar
          {pendentes > 0 && <Badge className="h-5 min-w-5 justify-center px-1">{pendentes}</Badge>}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="mensagens" className="mt-4"><MessagesTab defaultTab="biblioteca" /></TabsContent>
      <TabsContent value="revisar" className="mt-4"><ScriptReviewTab /></TabsContent>
    </Tabs>
  );
}
