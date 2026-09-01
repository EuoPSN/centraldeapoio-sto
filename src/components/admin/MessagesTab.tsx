import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listMessages, upsertMessage, deleteMessage } from "@/lib/messages.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import {
  listFlowStages, upsertFlowStage, deleteFlowStage,
  linkMessageToStage, unlinkMessageFromStage, reorderFlowLink,
} from "@/lib/messageflow.functions";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pencil, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, Wand2, X, Upload, Loader2, Image as ImageIcon, Download, Search } from "lucide-react";
import { toast } from "sonner";

interface Cat { id: string; name: string; parent_id: string | null; }
interface Stage { id: string; name: string; position: number; category_id: string | null; }
type ScriptDraft = { title: string; content: string; shortcut: string; internal_note: string; selected: boolean };
type AutoStage = { name: string; messages: any[] };

export function MessagesTab() {
  const list = useServerFn(listMessages);
  const upsert = useServerFn(upsertMessage);
  const del = useServerFn(deleteMessage);
  const catFn = useServerFn(listCategories);
  const stagesFn = useServerFn(listFlowStages);
  const upsertStageFn = useServerFn(upsertFlowStage);
  const delStageFn = useServerFn(deleteFlowStage);
  const linkFn = useServerFn(linkMessageToStage);
  const unlinkFn = useServerFn(unlinkMessageFromStage);
  const reorderLinkFn = useServerFn(reorderFlowLink);
  const genAI = useServerFn(simulatorChat);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["messages"], queryFn: () => list({}) });
  const catsQ = useQuery({ queryKey: ["cats", "message"], queryFn: () => catFn({ data: { scope: "message" } }) });
  const stagesQ = useQuery({ queryKey: ["flow-stages"], queryFn: () => stagesFn({}) });

  const cats = (catsQ.data ?? []) as Cat[];
  const parents = cats.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => cats.filter((c) => c.parent_id === id);
  const stages = (stagesQ.data ?? []) as Stage[];
  const allMessages = (q.data ?? []) as any[];

  // ---- Biblioteca: busca, filtro por categoria e seleção em massa ----
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("todas");
  const [filterSub, setFilterSub] = useState<string>("todas");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const setFilterCatAndResetSub = (v: string) => { setFilterCat(v); setFilterSub("todas"); };

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allMessages.forEach((m) => { if (m.category_id) counts.set(m.category_id, (counts.get(m.category_id) ?? 0) + 1); });
    return counts;
  }, [allMessages]);

  const subcategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allMessages.forEach((m) => { if (m.subcategory_id) counts.set(m.subcategory_id, (counts.get(m.subcategory_id) ?? 0) + 1); });
    return counts;
  }, [allMessages]);

  const filteredMessages = useMemo(() => {
    const n = search.toLowerCase().trim();
    return allMessages.filter((m) => {
      if (filterCat !== "todas" && m.category_id !== filterCat) return false;
      if (filterCat !== "todas" && filterSub !== "todas" && m.subcategory_id !== filterSub) return false;
      if (!n) return true;
      return m.title.toLowerCase().includes(n) || (m.content ?? "").toLowerCase().includes(n);
    });
  }, [allMessages, search, filterCat, filterSub]);

  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allVisibleSelected = filteredMessages.length > 0 && filteredMessages.every((m) => selectedIds.has(m.id));
  const toggleSelectAllVisible = () => setSelectedIds(allVisibleSelected ? new Set() : new Set(filteredMessages.map((m) => m.id)));

  const bulkChangeCategory = async (categoryId: string) => {
    setBulkBusy(true);
    try {
      for (const id of selectedIds) {
        const m = allMessages.find((x) => x.id === id);
        if (!m) continue;
        await upsert({ data: {
          id: m.id, category_id: categoryId || null, subcategory_id: null,
          title: m.title, content: m.content, internal_note: m.internal_note, tags: [], position: 0,
          shortcut: m.shortcut, image_path: m.image_path,
        } });
      }
      toast.success(`${selectedIds.size} mensagem(ns) movida(s).`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["messages"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao mover mensagens.");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Excluir ${selectedIds.size} mensagem(ns)? Isso não pode ser desfeito.`)) return;
    setBulkBusy(true);
    try {
      for (const id of selectedIds) await del({ data: { id } });
      toast.success(`${selectedIds.size} mensagem(ns) excluída(s).`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["messages"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir mensagens.");
    } finally {
      setBulkBusy(false);
    }
  };

  const invalidateFlow = () => {
    qc.invalidateQueries({ queryKey: ["messages"] });
    qc.invalidateQueries({ queryKey: ["flow-stages"] });
  };

  const [edit, setEdit] = useState<null | {
    id?: string; category_id: string; subcategory_id: string; title: string; content: string; internal_note: string; shortcut: string;
    image_path: string | null; image_url: string | null;
  }>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const handleImageUpload = async (file: File) => {
    if (!edit) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie um arquivo de imagem."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem excede 8MB."); return; }
    setUploadingImg(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("message-images").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      setEdit((prev) => prev && { ...prev, image_path: path, image_url: URL.createObjectURL(file) });
      toast.success("Imagem enviada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload da imagem.");
    } finally {
      setUploadingImg(false);
    }
  };

  const mUp = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id,
      category_id: edit!.category_id || null,
      subcategory_id: edit!.subcategory_id || null,
      title: edit!.title,
      content: edit!.content,
      internal_note: edit!.internal_note || null,
      tags: [],
      position: 0,
      shortcut: edit!.shortcut || null,
      image_path: edit!.image_path,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["messages"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removida."); qc.invalidateQueries({ queryKey: ["messages"] }); },
  });

  // ---- Gerar scripts novos com IA a partir de uma descrição (pode já nascer ligado a uma etapa) ----
  const [showGen, setShowGen] = useState(false);
  const [genCategoryId, setGenCategoryId] = useState("");
  const [genStageId, setGenStageId] = useState("");
  const [genDesc, setGenDesc] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genDrafts, setGenDrafts] = useState<ScriptDraft[]>([]);
  const [genSaving, setGenSaving] = useState(false);
  const genStages = stages.filter((s) => (s.category_id ?? null) === (genCategoryId || null));

  const generateScripts = async () => {
    if (!genDesc.trim()) return;
    setGenLoading(true);
    try {
      const prompt = `Você escreve mensagens de script de atendimento ao cliente via WhatsApp, para o Cartão de Todos (cartão de descontos em saúde).

O texto abaixo pode ser uma descrição livre, ou pode incluir conteúdo de referência (ex: mensagens de um script já existente, informações de um produto/pacote). Trate esse conteúdo como MATÉRIA-PRIMA E CONTEXTO FACTUAL, não como um molde pra copiar.

REGRA CRÍTICA: se o pedido é pra adaptar/refazer algo para um novo produto, pacote, situação ou público (ex: "refaça isso para o Pacote Ouro"), o resultado tem que ser conteúdo GENUINAMENTE NOVO e ESPECÍFICO sobre esse novo assunto — mencionando de forma concreta seus detalhes, benefícios, valores, diferenciais reais. NÃO é aceitável pegar as mensagens de referência e só trocar o título/atalho mantendo o mesmo texto ou estrutura genérica. Se o conteúdo de referência não tiver informação suficiente sobre o novo assunto pedido, use bom senso e conhecimento geral do setor pra preencher os detalhes plausíveis, mas ainda assim escreva do zero.

Crie um ou mais scripts de mensagem prontos pra copiar e enviar ao cliente, cobrindo a sequência de atendimento que fizer sentido pro pedido (ex: apresentação, explicação do produto, fechamento).
Cada item deve ter:
- "title": título curto (poucas palavras) pra identificar o script na lista.
- "content": o texto da mensagem em si, pronto pra uso real (pode usar *negrito* estilo WhatsApp).
- "shortcut": uma palavra curta, minúscula, sem espaço ou acento, pra usar como atalho tipo /palavra no simulador (invente algo intuitivo relacionado ao título — se for regeneração de um script existente, o atalho pode mudar pra refletir o novo assunto).
- "internal_note": uma frase curta dizendo quando o atendente deve usar essa mensagem.
Responda APENAS com um array JSON, no formato exato: [{"title":"...","content":"...","shortcut":"...","internal_note":"..."}]. Sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: genDesc }], model: "google/gemini-2.5-flash" } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: ScriptDraft[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({ title: it.title || "", content: it.content || "", shortcut: it.shortcut || "", internal_note: it.internal_note || "", selected: true }))
        .filter((it: ScriptDraft) => it.title && it.content);
      if (items.length === 0) { toast.error("A IA não conseguiu gerar nenhum script a partir da descrição."); return; }
      setGenDrafts(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA.");
    } finally {
      setGenLoading(false);
    }
  };

  const saveGenerated = async () => {
    const toSave = genDrafts.filter((d) => d.selected);
    if (toSave.length === 0) return;
    setGenSaving(true);
    try {
      let position = 0;
      for (const item of toSave) {
        const created = await upsert({ data: {
          category_id: genCategoryId || null, subcategory_id: null,
          title: item.title, content: item.content, internal_note: item.internal_note || null,
          tags: [], position: 0, shortcut: item.shortcut || null,
        } });
        if (genStageId && created?.id) {
          await linkFn({ data: { message_id: created.id, flow_stage_id: genStageId, position } });
          position += 10;
        }
      }
      toast.success(`${toSave.length} script(s) criado(s)${genStageId ? " e adicionado(s) ao fluxo" : ""}!`);
      qc.invalidateQueries({ queryKey: ["messages"] });
      setGenDrafts([]); setGenDesc(""); setShowGen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar scripts.");
    } finally {
      setGenSaving(false);
    }
  };

  // ---- Fluxo de Atendimento: uma aba por categoria (tipo de atendimento) ----
  const [flowCat, setFlowCat] = useState<string>("geral");
  const flowCategoryId = flowCat === "geral" ? null : flowCat;
  const stagesForCat = stages
    .filter((s) => (s.category_id ?? null) === flowCategoryId)
    .slice()
    .sort((a, b) => a.position - b.position);

  const [newStageName, setNewStageName] = useState("");
  const addStage = async () => {
    if (!newStageName.trim()) return;
    await upsertStageFn({ data: { name: newStageName.trim(), position: stagesForCat.length * 10, category_id: flowCategoryId } });
    setNewStageName("");
    qc.invalidateQueries({ queryKey: ["flow-stages"] });
  };
  const renameStage = async (stage: Stage, name: string) => {
    if (!name.trim() || name === stage.name) return;
    await upsertStageFn({ data: { id: stage.id, name: name.trim(), position: stage.position, category_id: stage.category_id } });
    qc.invalidateQueries({ queryKey: ["flow-stages"] });
  };
  const removeStage = async (stage: Stage) => {
    if (!confirm(`Excluir a etapa "${stage.name}"? As mensagens dela ficam soltas (continuam na Biblioteca e em outros fluxos, se estiverem).`)) return;
    await delStageFn({ data: { id: stage.id } });
    invalidateFlow();
  };
  const moveStage = async (idx: number, dir: -1 | 1) => {
    const arr = [...stagesForCat];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((s, i) => upsertStageFn({ data: { id: s.id, name: s.name, position: i * 10, category_id: s.category_id } })));
    qc.invalidateQueries({ queryKey: ["flow-stages"] });
  };

  const moveMessage = async (stageId: string, msgs: any[], idx: number, dir: -1 | 1) => {
    const arr = [...msgs];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((m, i) => {
      const link = (m.flow_links ?? []).find((l: any) => l.flow_stage_id === stageId);
      return link ? reorderLinkFn({ data: { id: link.id, position: i * 10 } }) : Promise.resolve();
    }));
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  const addMessageToStage = async (messageId: string, stageId: string, position: number) => {
    await linkFn({ data: { message_id: messageId, flow_stage_id: stageId, position } });
    qc.invalidateQueries({ queryKey: ["messages"] });
  };
  const removeMessageFromStage = async (linkId: string) => {
    await unlinkFn({ data: { id: linkId } });
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const generateDescription = async (m: any) => {
    setGeneratingId(m.id);
    try {
      const prompt = `Você escreve descrições curtas (uma frase, até 18 palavras) indicando a um atendente QUANDO ele deve usar uma mensagem de script de atendimento ao cliente.
Título da mensagem: "${m.title}"
Conteúdo da mensagem: "${m.content}"
Responda APENAS com a frase da descrição, sem aspas, sem markdown, sem texto adicional.`;
      const { content } = await genAI({ data: { messages: [{ role: "user", content: prompt }], model: "google/gemini-2.5-flash" } });
      const desc = content.replace(/^"+|"+$/g, "").trim();
      await upsert({ data: {
        id: m.id, category_id: m.category_id, subcategory_id: m.subcategory_id,
        title: m.title, content: m.content, internal_note: desc, tags: m.tags ?? [],
        position: m.position ?? 0, shortcut: m.shortcut,
      } });
      toast.success("Descrição gerada!");
      qc.invalidateQueries({ queryKey: ["messages"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar descrição.");
    } finally {
      setGeneratingId(null);
    }
  };

  // ---- Organizador automático do fluxo com IA ----
  const [autoOrganizing, setAutoOrganizing] = useState(false);
  const [autoPreview, setAutoPreview] = useState<AutoStage[] | null>(null);
  const [autoApplying, setAutoApplying] = useState(false);

  const autoOrganize = async () => {
    const linkedIds = new Set(
      allMessages.filter((m) => (m.flow_links ?? []).some((l: any) => stagesForCat.some((s) => s.id === l.flow_stage_id))).map((m) => m.id)
    );
    const pool = allMessages.filter((m) => (m.category_id ?? null) === flowCategoryId || linkedIds.has(m.id));
    if (pool.length === 0) { toast.error("Não há mensagens nessa categoria pra organizar."); return; }
    setAutoOrganizing(true);
    try {
      const catName = flowCat === "geral" ? "Geral" : (parents.find((c) => c.id === flowCat)?.name ?? "Geral");
      const listText = pool.map((m) => `${m.id} :: ${m.title} — ${(m.content || "").replace(/\s+/g, " ").slice(0, 140)}`).join("\n");
      const existingNames = stagesForCat.map((s) => s.name);
      const prompt = `Você organiza um fluxo de atendimento (sequência de mensagens de script de WhatsApp) para o tipo de atendimento "${catName}".

Mensagens disponíveis (id :: título — conteúdo resumido):
${listText}

${existingNames.length ? `Etapas já existentes que você pode reaproveitar pelo nome exato, se fizer sentido: ${existingNames.join(", ")}.` : "Não existem etapas ainda; proponha os nomes."}

Organize essas mensagens em etapas lógicas de atendimento, na ordem em que normalmente seriam usadas numa conversa real (ex: Apresentação, Documentos, Pagamento, Fechamento — adapte ao contexto). Cada mensagem deve entrar em exatamente UMA etapa. Nem toda mensagem precisa ser usada — inclua só as que fazem sentido dentro de uma sequência de atendimento.

Responda APENAS com um JSON no formato exato:
{"stages": [{"name": "Nome da etapa", "message_ids": ["id1", "id2"]}]}
As etapas devem vir na ordem certa de uso. Sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "user", content: prompt }], model: "google/gemini-2.5-flash" } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const stagesOut = Array.isArray(parsed?.stages) ? parsed.stages : [];
      const preview: AutoStage[] = stagesOut
        .map((s: any) => ({
          name: String(s.name || "").trim(),
          messages: (Array.isArray(s.message_ids) ? s.message_ids : [])
            .map((id: string) => pool.find((m) => m.id === id))
            .filter(Boolean),
        }))
        .filter((s: AutoStage) => s.name && s.messages.length > 0);
      if (preview.length === 0) { toast.error("A IA não conseguiu organizar essas mensagens."); return; }
      setAutoPreview(preview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao organizar com IA.");
    } finally {
      setAutoOrganizing(false);
    }
  };

  const applyAutoOrganize = async () => {
    if (!autoPreview) return;
    setAutoApplying(true);
    try {
      for (const stageProposal of autoPreview) {
        let stage = stagesForCat.find((s) => s.name.toLowerCase() === stageProposal.name.toLowerCase());
        if (!stage) {
          const created = await upsertStageFn({ data: { name: stageProposal.name, position: stagesForCat.length * 10, category_id: flowCategoryId } });
          stage = created as unknown as Stage;
        }
        for (let i = 0; i < stageProposal.messages.length; i++) {
          await linkFn({ data: { message_id: stageProposal.messages[i].id, flow_stage_id: stage.id, position: i * 10 } });
        }
      }
      toast.success("Fluxo organizado!");
      invalidateFlow();
      setAutoPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar organização.");
    } finally {
      setAutoApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="biblioteca">
        <TabsList>
          <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Atendimento</TabsTrigger>
        </TabsList>

        <TabsContent value="biblioteca" className="mt-4">
          <Card className="overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h3 className="font-semibold">Mensagens ({filteredMessages.length} de {allMessages.length})</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowGen((v) => !v)}>
                  <Sparkles className="h-4 w-4" /> Gerar scripts com IA
                </Button>
                <Button size="sm" className="gap-2" onClick={() => setEdit({ category_id: "", subcategory_id: "", title: "", content: "", internal_note: "", shortcut: "", image_path: null, image_url: null })}>
                  <Plus className="h-4 w-4" /> Nova mensagem
                </Button>
              </div>
            </div>

            <div className="p-4 border-b border-border space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar por título ou conteúdo..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={filterCat} onValueChange={setFilterCatAndResetSub}>
                  <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas categorias ({allMessages.length})</SelectItem>
                    {parents.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({categoryCounts.get(c.id) ?? 0})</SelectItem>)}
                  </SelectContent>
                </Select>
                {filterCat !== "todas" && childrenOf(filterCat).length > 0 && (
                  <Select value={filterSub} onValueChange={setFilterSub}>
                    <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas subcategorias</SelectItem>
                      {childrenOf(filterCat).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({subcategoryCounts.get(c.id) ?? 0})</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                  <span className="text-sm font-medium">{selectedIds.size} selecionada(s)</span>
                  <Select onValueChange={(v) => bulkChangeCategory(v)} disabled={bulkBusy}>
                    <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Mover para categoria..." /></SelectTrigger>
                    <SelectContent>
                      {parents.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={bulkDelete}>Excluir selecionadas</Button>
                  <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedIds(new Set())}>Limpar seleção</Button>
                </div>
              )}
            </div>

            {showGen && (
              <div className="p-4 border-b border-border space-y-3 bg-muted/30">
                <p className="text-sm text-muted-foreground">Descreva o que você precisa (tom, assunto, situação) — a IA monta os scripts pra você revisar antes de salvar.</p>
                <div className="grid grid-cols-[1fr_220px] gap-2">
                  <Textarea rows={4} value={genDesc} onChange={(e) => setGenDesc(e.target.value)}
                    placeholder="Ex: preciso de 3 mensagens formais explicando a política de cancelamento e reembolso, e uma mensagem curta cobrando retorno de cliente que sumiu na conversa." />
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Categoria (opcional)</Label>
                      <Select value={genCategoryId || "none"} onValueChange={(v) => { setGenCategoryId(v === "none" ? "" : v); setGenStageId(""); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— sem categoria —</SelectItem>
                          {parents.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Adicionar direto na etapa (opcional)</Label>
                      <Select value={genStageId || "none"} onValueChange={(v) => setGenStageId(v === "none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Não adicionar ao fluxo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não adicionar ao fluxo</SelectItem>
                          {genStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Button size="sm" onClick={generateScripts} disabled={genLoading || !genDesc.trim()} className="gap-2">
                  <Sparkles className="h-4 w-4" /> {genLoading ? "Gerando..." : "Gerar com IA"}
                </Button>

                {genDrafts.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-sm font-medium">Prévia — revise antes de salvar:</p>
                    {genDrafts.map((d, idx) => (
                      <div key={idx} className="flex gap-2 items-start p-2 rounded-md border border-border bg-background">
                        <input type="checkbox" checked={d.selected} className="mt-1.5"
                          onChange={(e) => setGenDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))} />
                        <div className="flex-1 space-y-1">
                          <div className="flex gap-2">
                            <Input value={d.title} className="font-medium"
                              onChange={(e) => setGenDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, title: e.target.value } : p))} />
                            <Input value={d.shortcut} className="w-32" placeholder="atalho"
                              onChange={(e) => setGenDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, shortcut: e.target.value } : p))} />
                          </div>
                          <Textarea rows={3} value={d.content}
                            onChange={(e) => setGenDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, content: e.target.value } : p))} />
                          <Input value={d.internal_note} placeholder="Quando usar (observação interna)"
                            onChange={(e) => setGenDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, internal_note: e.target.value } : p))} />
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setGenDrafts([])}>Descartar</Button>
                      <Button size="sm" onClick={saveGenerated} disabled={genSaving || genDrafts.every((d) => !d.selected)}>
                        {genSaving ? "Salvando..." : `Salvar ${genDrafts.filter((d) => d.selected).length} script(s)`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} /></TableHead>
                <TableHead></TableHead><TableHead>Categoria</TableHead><TableHead>Título</TableHead><TableHead>Atalho</TableHead><TableHead className="text-right">Usos</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredMessages.map((m: { id: string; title: string; category: { name: string } | null; subcategory: { name: string } | null; content: string; internal_note: string | null; category_id: string | null; subcategory_id: string | null; shortcut: string | null; image_path: string | null; image_url: string | null; use_count: number | null; }) => (
                  <TableRow key={m.id}>
                    <TableCell><input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelect(m.id)} /></TableCell>
                    <TableCell>
                      {m.image_url ? (
                        <img src={m.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground"><ImageIcon className="h-4 w-4" /></span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{m.category?.name ?? "—"}{m.subcategory ? ` · ${m.subcategory.name}` : ""}</Badge></TableCell>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>{m.shortcut ? <Badge variant="outline">/{m.shortcut}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{m.use_count ?? 0}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setEdit({
                        id: m.id, category_id: m.category_id ?? "", subcategory_id: m.subcategory_id ?? "",
                        title: m.title, content: m.content, internal_note: m.internal_note ?? "", shortcut: m.shortcut ?? "",
                        image_path: m.image_path ?? null, image_url: m.image_url ?? null,
                      })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && mDel.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Cada tipo de atendimento tem seu próprio fluxo de etapas. A mesma mensagem pode estar em vários fluxos ao mesmo tempo — editar ela atualiza em todo lugar que ela aparece.
          </p>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={flowCat === "geral" ? "default" : "outline"} onClick={() => { setFlowCat("geral"); setAutoPreview(null); }}>Geral</Button>
            {parents.map((c) => (
              <Button key={c.id} size="sm" variant={flowCat === c.id ? "default" : "outline"} onClick={() => { setFlowCat(c.id); setAutoPreview(null); }}>{c.name}</Button>
            ))}
          </div>

          <div className="flex gap-2 max-w-xl flex-wrap items-center">
            <Input placeholder="Nome da nova etapa" value={newStageName} onChange={(e) => setNewStageName(e.target.value)}
              className="max-w-xs"
              onKeyDown={(e) => { if (e.key === "Enter") addStage(); }} />
            <Button size="sm" className="gap-1 shrink-0" onClick={addStage}><Plus className="h-4 w-4" /> Adicionar etapa</Button>
            <Button size="sm" variant="outline" className="gap-1 shrink-0" disabled={autoOrganizing} onClick={autoOrganize}>
              <Wand2 className="h-4 w-4" /> {autoOrganizing ? "Organizando..." : "Organizar automaticamente com IA"}
            </Button>
          </div>

          {autoPreview && (
            <Card className="p-3 space-y-3 border-primary/40">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Prévia da organização automática — revise antes de aplicar:</p>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAutoPreview(null)}><X className="h-4 w-4" /></Button>
              </div>
              {autoPreview.map((s, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium">{i + 1}. {s.name}</p>
                  <ul className="list-disc list-inside text-muted-foreground text-xs pl-2">
                    {s.messages.map((m: any) => <li key={m.id}>{m.title}</li>)}
                  </ul>
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAutoPreview(null)}>Cancelar</Button>
                <Button size="sm" onClick={applyAutoOrganize} disabled={autoApplying}>{autoApplying ? "Aplicando..." : "Aplicar organização"}</Button>
              </div>
            </Card>
          )}

          {stagesForCat.length === 0 && !autoPreview && (
            <p className="text-sm text-muted-foreground">Nenhuma etapa criada ainda para "{flowCat === "geral" ? "Geral" : parents.find((c) => c.id === flowCat)?.name}". Adicione manualmente acima, ou use o organizador automático.</p>
          )}

          {stagesForCat.map((stage, stageIdx) => {
            const stageMessages = allMessages
              .filter((m) => (m.flow_links ?? []).some((l: any) => l.flow_stage_id === stage.id))
              .slice()
              .sort((a, b) => {
                const la = (a.flow_links ?? []).find((l: any) => l.flow_stage_id === stage.id)?.position ?? 0;
                const lb = (b.flow_links ?? []).find((l: any) => l.flow_stage_id === stage.id)?.position ?? 0;
                return la - lb;
              });
            return (
              <Card key={stage.id} className="p-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <Input defaultValue={stage.name} className="h-8 font-semibold max-w-[240px]"
                    onBlur={(e) => renameStage(stage, e.target.value)} />
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={stageIdx === 0}
                      onClick={() => moveStage(stageIdx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={stageIdx === stagesForCat.length - 1}
                      onClick={() => moveStage(stageIdx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeStage(stage)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {stageMessages.length === 0 && <p className="text-xs text-muted-foreground mb-1">Nenhuma mensagem nesta etapa ainda.</p>}
                <div className="space-y-1">
                  {stageMessages.map((m, mIdx) => {
                    const link = (m.flow_links ?? []).find((l: any) => l.flow_stage_id === stage.id);
                    return (
                      <div key={m.id} className="flex items-center gap-2 p-2 rounded-md border border-border/60">
                        <div className="flex flex-col shrink-0">
                          <Button size="icon" variant="ghost" className="h-5 w-5" disabled={mIdx === 0}
                            onClick={() => moveMessage(stage.id, stageMessages, mIdx, -1)}><ArrowUp className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-5 w-5" disabled={mIdx === stageMessages.length - 1}
                            onClick={() => moveMessage(stage.id, stageMessages, mIdx, 1)}><ArrowDown className="h-3 w-3" /></Button>
                        </div>
                        {m.shortcut && <Badge variant="outline" className="shrink-0">/{m.shortcut}</Badge>}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{m.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.internal_note || "sem descrição de uso ainda"}
                            {(m.flow_links ?? []).length > 1 && <span className="text-primary"> · também em outro(s) fluxo(s)</span>}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1 shrink-0" disabled={generatingId === m.id}
                          onClick={() => generateDescription(m)}>
                          <Sparkles className="h-3.5 w-3.5" /> {generatingId === m.id ? "Gerando..." : "Gerar descrição"}
                        </Button>
                        <Button size="icon" variant="ghost" className="shrink-0" onClick={() => link && removeMessageFromStage(link.id)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <AddMessagePicker
                  messages={allMessages}
                  excludeIds={stageMessages.map((m) => m.id)}
                  onAdd={(id) => addMessageToStage(id, stage.id, stageMessages.length * 10)}
                />
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar mensagem" : "Nova mensagem"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={edit.category_id || "none"} onValueChange={(v) => setEdit({ ...edit, category_id: v === "none" ? "" : v, subcategory_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— sem categoria —</SelectItem>
                      {parents.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subcategoria</Label>
                  <Select value={edit.subcategory_id || "none"} onValueChange={(v) => setEdit({ ...edit, subcategory_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— nenhuma —</SelectItem>
                      {edit.category_id && childrenOf(edit.category_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Título</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
                <div>
                  <Label>Atalho no simulador (opcional)</Label>
                  <Input value={edit.shortcut} onChange={(e) => setEdit({ ...edit, shortcut: e.target.value })} placeholder="ex: ola (sem a barra)" />
                </div>
              </div>
              <div><Label>Conteúdo</Label><Textarea rows={8} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></div>
              <div><Label>Observação interna</Label><Input value={edit.internal_note} onChange={(e) => setEdit({ ...edit, internal_note: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><Upload className="h-4 w-4" /> Imagem (opcional)</Label>
                <input type="file" accept="image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                  disabled={uploadingImg}
                  className="block text-sm w-full text-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
                {uploadingImg && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</p>}
                {edit.image_url && (
                  <div className="flex items-center gap-3">
                    <img src={edit.image_url} alt="" className="h-16 w-16 rounded-md object-cover border border-border" />
                    <a href={edit.image_url} download={(edit.image_path?.split(".").pop() ? `imagem.${edit.image_path.split(".").pop()}` : "imagem")}>
                      <Button size="sm" variant="outline" className="gap-1.5" type="button"><Download className="h-3.5 w-3.5" /> Baixar</Button>
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, image_path: null, image_url: null })}>Remover</Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => mUp.mutate()} disabled={mUp.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddMessagePicker({ messages, excludeIds, onAdd }: { messages: any[]; excludeIds: string[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = query.trim()
    ? messages.filter((m) => !excludeIds.includes(m.id) && m.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];
  return (
    <div className="pt-1">
      {!open ? (
        <Button size="sm" variant="ghost" className="gap-1 text-xs h-7" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3" /> Adicionar mensagem existente
        </Button>
      ) : (
        <div className="space-y-1 p-2 rounded-md border border-dashed border-border">
          <Input placeholder="Buscar mensagem pelo título..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 text-xs" autoFocus />
          {results.map((m) => (
            <button key={m.id} type="button" className="flex w-full items-center justify-between gap-2 text-left text-xs p-1.5 rounded hover:bg-muted/60"
              onClick={() => { onAdd(m.id); setQuery(""); }}>
              <span className="truncate">{m.title}{m.category ? <span className="text-muted-foreground"> · {m.category.name}</span> : null}</span>
              <Plus className="h-3 w-3 shrink-0" />
            </button>
          ))}
          {query.trim() && results.length === 0 && <p className="text-xs text-muted-foreground p-1">Nada encontrado.</p>}
          <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => { setOpen(false); setQuery(""); }}>Fechar</Button>
        </div>
      )}
    </div>
  );
}
