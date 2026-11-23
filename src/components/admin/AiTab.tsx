import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { reindexAll, getIndexStats } from "@/lib/embeddings.functions";
import { getAiSettings, updateAiSettings, generateEssentialFactsDraft } from "@/lib/chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Database, RefreshCw, Settings, Sparkles, ShieldCheck } from "lucide-react";
import { MARCIANA_CHAT_MODEL } from "@/lib/ai-models";


// ============ AI / Indexing ============
const parseSystemPrompt = (fullPrompt: string | undefined) => {
  if (!fullPrompt) return { article: "a", name: "", body: "" };
  const match = fullPrompt.match(/^Você é ([ao])\s+([^,]+),\s*(.*)$/s);
  if (match) {
    return {
      article: match[1],
      name: match[2].trim(),
      body: match[3].trim(),
    };
  }
  return { article: "a", name: "", body: fullPrompt };
};


export function AiTab() {
  const reindex = useServerFn(reindexAll);
  const stats = useServerFn(getIndexStats);
  const getSettings = useServerFn(getAiSettings);
  const updateSettings = useServerFn(updateAiSettings);

  const qc = useQueryClient();
  const sQ = useQuery({ queryKey: ["index-stats"], queryFn: () => stats({}) });

  const sSettings = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => getSettings({}),
  });

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MARCIANA_CHAT_MODEL);
  const [genderArticle, setGenderArticle] = useState("a");
  const [resumeReindex, setResumeReindex] = useState(false);
  const [essentialFacts, setEssentialFacts] = useState("");
  const [factsGenerating, setFactsGenerating] = useState(false);
  const genFactsDraft = useServerFn(generateEssentialFactsDraft);

  useEffect(() => {
    if (sSettings.data) {
      const parsed = parseSystemPrompt(sSettings.data.system_prompt);
      setGenderArticle(parsed.article);
      setName(parsed.name);
      setPrompt(parsed.body);
      if (sSettings.data.model) {
        setModel(sSettings.data.model);
      }
      setEssentialFacts((sSettings.data as any).essential_facts ?? "");
    }
  }, [sSettings.data]);

  const generateFactsDraft = async () => {
    setFactsGenerating(true);
    try {
      const { draft } = await genFactsDraft({});
      setEssentialFacts(draft);
      toast.success("Rascunho gerado — revise e clique em \"Salvar configurações\" para aplicar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar rascunho.");
    } finally {
      setFactsGenerating(false);
    }
  };

  const mut = useMutation({
    mutationFn: () => reindex({ data: { reset: !resumeReindex } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success(`Reindexação concluída: ${r.indexed} novos chunks. ${r.skipped} já estavam atualizados.`);
        setResumeReindex(false);
      } else {
        toast.warning(`${r.indexed} chunks indexados. Limite temporário da IA atingido; tente novamente em alguns minutos para continuar.`);
        setResumeReindex(true);
      }
      qc.invalidateQueries({ queryKey: ["index-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const reindexIncrementalMut = useMutation({
    mutationFn: () => reindex({ data: { reset: false } }),
    onSuccess: (r) => {
      if (r.indexed === 0) {
        toast.success("Nenhum conteúdo novo para indexar.");
      } else {
        toast.success(`${r.indexed} novos chunks indexados!`);
      }
      qc.invalidateQueries({ queryKey: ["index-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao indexar."),
  });

  const saveSettingsMut = useMutation({
    mutationFn: () => {
      const article = name === "Assistente IA do Cartão de Todos" ? "o" : "a";
      const finalPrompt = name ? `Você é ${article} ${name}, ${prompt}` : prompt;
      return updateSettings({
        data: {
          system_prompt: finalPrompt,
          model,
          essential_facts: essentialFacts,
          client_knowledge: (sSettings.data as any)?.client_knowledge ?? "",
          simulador_nota_referencia: (sSettings.data as any)?.simulador_nota_referencia ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Configurações salvas.");
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar configurações"),
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Database className="h-4 w-4 text-gold-text" /> Base vetorial (RAG)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Reindexa scripts, conhecimento, problemas, tutoriais e preços gerando embeddings semânticos. Execute após adicionar ou alterar conteúdo.
            </p>
            {resumeReindex ? (
              <p className="text-sm text-amber-600 mt-2">
                Reindexação pausada por limite temporário da IA. Aguarde alguns minutos e clique novamente para continuar sem apagar o progresso.
              </p>
            ) : null}
            <p className="text-sm mt-2">Total atual: <strong className="text-gold-text">{sQ.data?.totalChunks ?? 0}</strong> chunks indexados.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${mut.isPending ? "animate-spin" : ""}`} />
              {mut.isPending ? "Reindexando..." : resumeReindex ? "Continuar reindexação" : "Reindexar tudo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reindexIncrementalMut.mutate()}
              disabled={reindexIncrementalMut.isPending}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {reindexIncrementalMut.isPending ? "Indexando..." : "Indexar novos conteúdos"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold-text" /> Modelo da IA</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O assistente usa <code className="text-xs bg-muted px-1 py-0.5 rounded">{MARCIANA_CHAT_MODEL}</code> via Lovable AI Gateway, com busca híbrida na base interna. Embeddings em 1536 dimensões compatíveis com <code className="text-xs bg-muted px-1 py-0.5 rounded">text-embedding-3-small</code>.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold-text" /> Fatos Essenciais</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Fatos de alto risco (mensalidade, taxa de adesão, fidelidade, formas de pagamento...) que a MarcIAna SEMPRE usa como fonte confiável, mesmo sem busca — evita que conteúdo antigo ou duplicado na base a confunda. Sempre revise antes de salvar.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={generateFactsDraft} disabled={factsGenerating}>
            <Sparkles className="h-4 w-4" /> {factsGenerating ? "Gerando..." : "Gerar rascunho com IA"}
          </Button>
        </div>
        <Textarea
          rows={8}
          value={essentialFacts}
          onChange={(e) => setEssentialFacts(e.target.value)}
          placeholder='Ex: "Mensalidade: R$ 33,40. Taxa de adesão: R$ 66,80 (ou isenta com 5 indicações). Fidelidade: 12 meses, multa de 50% das mensalidades restantes. Pagamento: apenas cartão de crédito ou débito."'
        />
        <p className="text-xs text-muted-foreground">
          Lembre-se de clicar em "Salvar configurações" no final da página para aplicar as mudanças.
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-gold-text" /> Configurações de Prompt & IA
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Personalize o nome da assistente, o modelo de linguagem e as diretrizes principais do system prompt.
          </p>
        </div>

        {sSettings.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando configurações...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assistant-name">Nome da assistente</Label>
                <Input
                  id="assistant-name"
                  placeholder="Ex: Sofia"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-model">Modelo</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="ai-model">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MARCIANA_CHAT_MODEL}>{MARCIANA_CHAT_MODEL}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Prompt</Label>
              <Textarea
                id="system-prompt"
                rows={10}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Escreva as instruções de comportamento do sistema da IA..."
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => saveSettingsMut.mutate()}
                disabled={saveSettingsMut.isPending}
              >
                {saveSettingsMut.isPending ? "Salvando..." : "Salvar configurações"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
