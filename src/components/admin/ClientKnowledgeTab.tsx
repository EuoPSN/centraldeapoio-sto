import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getAiSettings, updateAiSettings } from "@/lib/chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

export function ClientKnowledgeTab() {
  const getSettings = useServerFn(getAiSettings);
  const updateSettings = useServerFn(updateAiSettings);
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["ai-settings"], queryFn: () => getSettings({}) });

  const [content, setContent] = useState("");

  useEffect(() => {
    if (settingsQ.data) {
      setContent((settingsQ.data as any).client_knowledge ?? "");
    }
  }, [settingsQ.data]);

  const saveMut = useMutation({
    mutationFn: () => {
      const s = settingsQ.data as any;
      // Reenvia system_prompt/model/essential_facts sem alterar — essa tela só edita client_knowledge,
      // mas updateAiSettings salva a linha inteira de configurações.
      return updateSettings({ data: {
        system_prompt: s?.system_prompt ?? "",
        model: s?.model ?? "google/gemini-3-flash-preview",
        essential_facts: s?.essential_facts ?? "",
        client_knowledge: content,
      } });
    },
    onSuccess: () => { toast.success("Salvo."); qc.invalidateQueries({ queryKey: ["ai-settings"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  return (
    <Card className="p-5 space-y-3">
      <div>
        <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Conhecimento do Cliente</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O básico que um cliente comum saberia sobre o Cartão de Todos — valor de cada plano, o que é a clínica/parceria,
          coisas que dariam pra achar pesquisando no Google ou no site. Não é processo interno.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Os dois Simuladores (Atendimentos e Solução de Problemas) usam esse texto como base pro cliente virtual,
          além do que já está específico em cada perfil ou cenário — assim eles param de inventar valor.
        </p>
      </div>
      {settingsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <Textarea
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'Ex: "Plano Prata: R$ 66,80 no 1º mês, R$ 33,40 a partir do 2º. Plano Ouro: R$ 38,39 no 1º mês, R$ 48,39 a partir do 2º. O Cartão de Todos é um cartão de desconto em consultas, exames e procedimentos odontológicos em clínicas parceiras, não é plano de saúde nem convênio."'}
          />
          <div className="flex justify-end">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
