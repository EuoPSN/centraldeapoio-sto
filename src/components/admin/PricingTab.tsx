import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listPricing, upsertPricing, deletePricing, setPricingItemUnidades } from "@/lib/content.functions";
import { listExames, upsertExame, deleteExame } from "@/lib/exames.functions";
import { listProcedimentos, upsertProcedimento, deleteProcedimento } from "@/lib/odontologia.functions";
import { listUnidades, upsertUnidade } from "@/lib/unidades.functions";
import { getAmorSaude, setAvaliacaoOdonto, setItemClinicas } from "@/lib/amorsaude.functions";
import { ClinicasPicker } from "@/components/admin/ClinicasPicker";
import { AREAS } from "@/components/amor-saude/model";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_ASSISTANT_MODEL } from "@/lib/ai-models";

export function PricingTab() {
  return (
    <Tabs defaultValue="consultas">
      <TabsList>
        <TabsTrigger value="consultas">Consultas</TabsTrigger>
        <TabsTrigger value="exames">Exames</TabsTrigger>
        <TabsTrigger value="odontologia">Procedimentos Odontológicos</TabsTrigger>
      </TabsList>
      <TabsContent value="consultas" className="mt-4"><ConsultasSubTab /></TabsContent>
      <TabsContent value="exames" className="mt-4"><ExamesSubTab /></TabsContent>
      <TabsContent value="odontologia" className="mt-4"><OdontologiaSubTab /></TabsContent>
    </Tabs>
  );
}

// ============================================================
// Consultas (o que já existia como "Preços")
// ============================================================
function ConsultasSubTab() {
  const list = useServerFn(listPricing);
  const upsert = useServerFn(upsertPricing);
  const del = useServerFn(deletePricing);
  const setUnidadesFn = useServerFn(setPricingItemUnidades);
  const unidadesListFn = useServerFn(listUnidades);
  const upsertUnidadeFn = useServerFn(upsertUnidade);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pricing"], queryFn: () => list({}) });
  const unidadesQ = useQuery({ queryKey: ["unidades"], queryFn: () => unidadesListFn({}) });
  const unidadesList = (unidadesQ.data ?? []) as { id: string; nome: string }[];

  const setClinicasFn = useServerFn(setItemClinicas);
  type ConsultaEdit = {
    id?: string; category: string; specialty: string; cartao_price: number | string | null; particular_price: number | string | null;
    notes: string; description: string; area: string; para_quem: string; como_agendar: string;
    clinicaIds: string[]; refAntiga: string | null; pendente: boolean;
  };
  const [edit, setEdit] = useState<null | ConsultaEdit>(null);
  const [descGenerating, setDescGenerating] = useState(false);

  type AiPricingItem = { category: string; specialty: string; cartao_price: number | null; particular_price: number | null; notes: string | null; regioes_principais: string[]; regioes_outras: string[]; selected: boolean };
  const genAI = useServerFn(simulatorChat);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiPreview, setAiPreview] = useState<AiPricingItem[]>([]);

  const generateFromAI = async () => {
    if (!aiInput.trim()) return;
    setAiGenerating(true);
    try {
      const prompt = `Você organiza tabelas de preços de um cartão de descontos em saúde (Cartão de Todos) a partir de texto livre enviado por um administrador.
Extraia cada especialidade ou procedimento mencionado no texto e devolva um array JSON, um objeto por item, no formato exato:
[{"category": "...", "specialty": "...", "cartao_price": numero ou null, "particular_price": numero ou null, "notes": "texto curto ou null", "regioes_principais": ["..."], "regioes_outras": ["..."]}]

Regras:
- "category" agrupa itens parecidos (ex: "Consultas", "Exames", "Procedimentos", "Odontologia"). Use categorias curtas e consistentes entre os itens.
- "specialty" é o nome específico da especialidade ou procedimento (ex: "Cardiologista").
- "cartao_price" e "particular_price" são números em reais, com ponto como separador decimal. Se um valor não aparecer no texto, use null.
- "notes" é opcional: use apenas se houver informação extra relevante.
- "regioes_principais" e "regioes_outras" são listas de nomes de bairro/região/cidade, SE o texto mencionar onde aquele item está disponível. Se não houver nada, devolva as duas listas vazias.
- Responda APENAS com o array JSON, sem markdown, sem nenhum texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: aiInput }], model: ADMIN_ASSISTANT_MODEL } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: AiPricingItem[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({
          category: it.category || "Outros",
          specialty: it.specialty || "",
          cartao_price: typeof it.cartao_price === "number" ? it.cartao_price : null,
          particular_price: typeof it.particular_price === "number" ? it.particular_price : null,
          notes: it.notes || null,
          regioes_principais: Array.isArray(it.regioes_principais) ? it.regioes_principais : [],
          regioes_outras: Array.isArray(it.regioes_outras) ? it.regioes_outras : [],
          selected: true,
        }))
        .filter((it: AiPricingItem) => it.specialty);
      if (items.length === 0) { toast.error("A IA não conseguiu identificar nenhum item no texto enviado."); return; }
      setAiPreview(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA.");
    } finally {
      setAiGenerating(false);
    }
  };

  const resolveUnidadeId = async (nome: string, cache: Map<string, string>): Promise<string> => {
    const key = nome.trim().toLowerCase();
    if (cache.has(key)) return cache.get(key)!;
    const existing = unidadesList.find((u) => u.nome.trim().toLowerCase() === key);
    if (existing) { cache.set(key, String(existing.id)); return String(existing.id); }
    const created = await upsertUnidadeFn({ data: { nome: nome.trim(), position: 0 } });
    cache.set(key, String(created.id));
    return String(created.id);
  };

  const importSelected = async () => {
    const toImport = aiPreview.filter((i) => i.selected);
    if (toImport.length === 0) return;
    setAiImporting(true);
    const cache = new Map<string, string>();
    try {
      for (const item of toImport) {
        const created = await upsert({ data: { category: item.category, specialty: item.specialty, cartao_price: item.cartao_price, particular_price: item.particular_price, notes: item.notes, position: 0 } });
        const links: { unidade_id: string; destaque: boolean }[] = [];
        for (const nome of item.regioes_principais) links.push({ unidade_id: await resolveUnidadeId(nome, cache), destaque: true });
        for (const nome of item.regioes_outras) links.push({ unidade_id: await resolveUnidadeId(nome, cache), destaque: false });
        if (links.length > 0 && created?.id) await setUnidadesFn({ data: { pricing_item_id: String(created.id), unidades: links } });
      }
      toast.success(`${toImport.length} item(ns) importado(s)!`);
      qc.invalidateQueries({ queryKey: ["pricing"] });
      qc.invalidateQueries({ queryKey: ["unidades"] });
      setAiOpen(false); setAiInput(""); setAiPreview([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar itens.");
    } finally {
      setAiImporting(false);
    }
  };

  const generateDescription = async () => {
    if (!edit || !edit.specialty.trim()) { toast.error("Preencha o nome da especialidade primeiro."); return; }
    setDescGenerating(true);
    try {
      const prompt = `Você escreve descrições curtas para itens de uma tabela de preços de um cartão de descontos em saúde (Cartão de Todos), com o objetivo de ajudar uma busca por palavra-chave a encontrar o item certo mesmo quando o funcionário digita um sintoma, sinônimo ou termo relacionado.

Item: ${edit.specialty}
Categoria: ${edit.category}
Observações cadastradas: ${edit.notes || "-"}

Escreva uma descrição curta (1 a 2 frases, até 240 caracteres), mencionando o que resolve e 3-6 palavras-chave/sinônimos relacionados.

Responda APENAS com o texto da descrição, sem aspas, sem markdown.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: "Gere a descrição." }], model: ADMIN_ASSISTANT_MODEL } });
      setEdit((f) => f ? { ...f, description: content.trim() } : f);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar descrição.");
    } finally {
      setDescGenerating(false);
    }
  };

  const upsertMut = useMutation({
    mutationFn: async () => {
      const saved = await upsert({
        data: {
          id: edit!.id, category: edit!.category, specialty: edit!.specialty,
          cartao_price: edit!.cartao_price ? Number(edit!.cartao_price) : null,
          particular_price: edit!.particular_price ? Number(edit!.particular_price) : null,
          notes: edit!.notes || null, description: edit!.description || null, position: 0,
          area: edit!.area.trim() || null, para_quem: edit!.para_quem.trim() || null, como_agendar: edit!.como_agendar.trim() || null,
          clinicas_pendente: edit!.pendente,
        },
      });
      // Os vínculos antigos com "unidades" ficam como estão (referência); o site usa as clínicas.
      const pricingItemId = edit!.id ?? String(saved.id);
      await setClinicasFn({ data: { tipo: "consulta", item_id: String(pricingItemId), clinica_ids: edit!.clinicaIds } });
    },
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["pricing"] }); qc.invalidateQueries({ queryKey: ["amor-saude"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["pricing"] }); },
  });

  const openEdit = (p: any) => {
    setEdit({
      id: p.id, category: p.category, specialty: p.specialty, cartao_price: p.cartao_price?.toString() ?? "", particular_price: p.particular_price?.toString() ?? "",
      notes: p.notes ?? "", description: p.description ?? "", area: p.area ?? "", para_quem: p.para_quem ?? "", como_agendar: p.como_agendar ?? "",
      clinicaIds: ((p.clinicas ?? []) as { clinica_id: string }[]).map((c) => c.clinica_id),
      refAntiga: p.clinicas_ref_antiga ?? null, pendente: !!p.clinicas_pendente,
    });
  };
  const pendentes = ((q.data ?? []) as any[]).filter((p) => p.clinicas_pendente).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <div>
          <h3 className="font-semibold">Consultas ({q.data?.length ?? 0})</h3>
          {pendentes > 0 && <p className="text-xs text-muted-foreground">{pendentes} com clínicas para conferir (marcadas com “Revisar”).</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" /> Preencher com IA</Button>
          <Button size="sm" className="gap-2" onClick={() => setEdit({ category: "Consultas", specialty: "", cartao_price: "", particular_price: "", notes: "", description: "", area: "", para_quem: "", como_agendar: "", clinicaIds: [], refAntiga: null, pendente: false })}><Plus className="h-4 w-4" /> Novo</Button>
        </div>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Área</TableHead><TableHead>Especialidade</TableHead><TableHead className="text-right">CDT</TableHead><TableHead className="text-right">Particular</TableHead><TableHead>Clínicas</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {(q.data ?? []).map((p: any) => (
            <TableRow key={p.id}>
              <TableCell>{p.area ? <Badge variant="secondary">{p.area}</Badge> : <span className="text-xs text-muted-foreground">Outras</span>}</TableCell>
              <TableCell className="font-medium">{p.specialty}</TableCell>
              <TableCell className="text-right">{p.cartao_price != null ? `R$ ${Number(p.cartao_price).toFixed(2)}` : "—"}</TableCell>
              <TableCell className="text-right">{p.particular_price != null ? `R$ ${Number(p.particular_price).toFixed(2)}` : "—"}</TableCell>
              <TableCell>
                <span className="text-sm">{(p.clinicas ?? []).length}</span>
                {p.clinicas_pendente && <Badge variant="outline" className="ml-2 border-warning text-warning">Revisar</Badge>}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar preço" : "Novo preço"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Categoria</Label><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
              <div><Label>Especialidade</Label><Input value={edit.specialty} onChange={(e) => setEdit({ ...edit, specialty: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor CDT (R$)</Label><Input type="number" step="0.01" value={edit.cartao_price ?? ""} onChange={(e) => setEdit({ ...edit, cartao_price: e.target.value })} /></div>
                <div><Label>Valor Particular (R$)</Label><Input type="number" step="0.01" value={edit.particular_price ?? ""} onChange={(e) => setEdit({ ...edit, particular_price: e.target.value })} /></div>
              </div>
              <div><Label>Observações</Label><Input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
              <div>
                <Label>Área</Label>
                <Input list="amor-areas" value={edit.area} onChange={(e) => setEdit({ ...edit, area: e.target.value })} placeholder="Ex.: Coração e circulação (vazio = Outras)" />
                <datalist id="amor-areas">{AREAS.map((a) => <option key={a} value={a} />)}</datalist>
              </div>
              <div><Label>Para quem indicar</Label><Textarea rows={2} value={edit.para_quem} onChange={(e) => setEdit({ ...edit, para_quem: e.target.value })} placeholder="Ex.: pressão alta, histórico de infarto na família, check-up acima dos 40." /></div>
              <div><Label>Como agendar</Label><Textarea rows={2} value={edit.como_agendar} onChange={(e) => setEdit({ ...edit, como_agendar: e.target.value })} placeholder="Ex.: WhatsApp da clínica · segunda a sábado, das 8h às 18h." /></div>
              {edit.refAntiga && edit.pendente && (
                <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                  <p className="font-medium">Texto antigo das regiões (referência)</p>
                  <p className="mt-0.5 text-muted-foreground">{edit.refAntiga}</p>
                  <p className="mt-1 text-xs text-muted-foreground">A migração marcou as clínicas que casaram. Confira, ajuste abaixo e marque “Conferido”.</p>
                </div>
              )}
              <ClinicasPicker value={edit.clinicaIds} onChange={(ids) => setEdit({ ...edit, clinicaIds: ids })} />
              {(edit.pendente || edit.refAntiga) && (
                <div className="flex items-center gap-2">
                  <Switch checked={!edit.pendente} onCheckedChange={(v) => setEdit({ ...edit, pendente: !v })} />
                  <Label className="!mt-0">Clínicas conferidas</Label>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <Label>Descrição para busca (opcional)</Label>
                  <Button type="button" size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={generateDescription} disabled={descGenerating}><Sparkles className="h-3.5 w-3.5" /> {descGenerating ? "Gerando..." : "Gerar com IA"}</Button>
                </div>
                <Textarea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Gerada por IA: ajuda a busca a encontrar por sintomas/sinônimos." />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={(v) => { setAiOpen(v); if (!v) { setAiPreview([]); setAiInput(""); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preencher Consultas com IA</DialogTitle></DialogHeader>
          {aiPreview.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cole o conteúdo com especialidades, valores e observações. A IA organiza.</p>
              <Textarea rows={12} value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={"Ex:\nCardiologia - consulta - R$ 80 pelo cartão, R$ 180 particular"} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Confira antes de importar.</p>
              <Table>
                <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Categoria</TableHead><TableHead>Especialidade</TableHead><TableHead className="text-right">CDT</TableHead><TableHead className="text-right">Particular</TableHead></TableRow></TableHeader>
                <TableBody>
                  {aiPreview.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell><input type="checkbox" checked={item.selected} onChange={(e) => setAiPreview((prev) => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))} /></TableCell>
                      <TableCell><Badge variant="secondary">{item.category}</Badge></TableCell>
                      <TableCell className="font-medium">{item.specialty}</TableCell>
                      <TableCell className="text-right">{item.cartao_price != null ? `R$ ${item.cartao_price.toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-right">{item.particular_price != null ? `R$ ${item.particular_price.toFixed(2)}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            {aiPreview.length === 0 ? (
              <Button onClick={generateFromAI} disabled={aiGenerating || !aiInput.trim()} className="gap-2"><Sparkles className="h-4 w-4" /> {aiGenerating ? "Gerando..." : "Gerar com IA"}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAiPreview([])}>Voltar</Button>
                <Button onClick={importSelected} disabled={aiImporting || aiPreview.every((p) => !p.selected)}>{aiImporting ? "Importando..." : `Importar ${aiPreview.filter((p) => p.selected).length} item(ns)`}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// Exames (Laboratoriais e de Imagem)
// ============================================================
type ExameDraft = { nome: string; tipo: "laboratorial" | "imagem"; categoria: string; material: string; jejum: boolean; preparo: string; descricao: string; observacoes: string; selected: boolean };

function ExamesSubTab() {
  const list = useServerFn(listExames);
  const upsert = useServerFn(upsertExame);
  const del = useServerFn(deleteExame);
  const setClinicasFn = useServerFn(setItemClinicas);
  const genAI = useServerFn(simulatorChat);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["exames"], queryFn: () => list({}) });

  const [edit, setEdit] = useState<null | { id?: string; nome: string; tipo: "laboratorial" | "imagem"; categoria: string; material: string; jejum: boolean; preparo: string; descricao: string; observacoes: string; media: string; preparoItens: string; clinicaIds: string[] }>(null);

  const upsertMut = useMutation({
    mutationFn: async () => {
      const saved = await upsert({ data: {
        id: edit!.id, nome: edit!.nome, tipo: edit!.tipo, categoria: edit!.categoria || null,
        material: edit!.material || null, jejum: edit!.jejum, preparo: edit!.preparo || null,
        descricao: edit!.descricao || null, observacoes: edit!.observacoes || null, position: 0,
        media_referencia: edit!.media.trim() ? Number(edit!.media.replace(",", ".")) : null,
        preparo_itens: edit!.preparoItens.split("\n").map((l) => l.replace(/^\s*[•\-*]\s*/, "").trim()).filter(Boolean),
      } });
      const exameId = edit!.id ?? String(saved.id);
      await setClinicasFn({ data: { tipo: "exame", item_id: String(exameId), clinica_ids: edit!.clinicaIds } });
    },
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["exames"] }); qc.invalidateQueries({ queryKey: ["amor-saude"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["exames"] }); },
  });

  const openEdit = (e: any) => {
    setEdit({
      id: e.id, nome: e.nome, tipo: e.tipo, categoria: e.categoria ?? "", material: e.material ?? "", jejum: e.jejum, preparo: e.preparo ?? "",
      descricao: e.descricao ?? "", observacoes: e.observacoes ?? "",
      media: e.media_referencia != null ? String(e.media_referencia) : "",
      preparoItens: ((e.preparo_itens ?? []) as string[]).join("\n"),
      clinicaIds: ((e.clinicas ?? []) as { clinica_id: string }[]).map((c) => c.clinica_id),
    });
  };

  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiPreview, setAiPreview] = useState<ExameDraft[]>([]);

  const generateFromAI = async () => {
    if (!aiInput.trim()) return;
    setAiGenerating(true);
    try {
      const prompt = `Você organiza uma lista de exames laboratoriais e de imagem oferecidos por um cartão de descontos em saúde (Cartão de Todos), a partir de texto livre enviado por um administrador.
Extraia cada exame mencionado e devolva um array JSON, um objeto por item, no formato exato:
[{"nome": "...", "tipo": "laboratorial" ou "imagem", "categoria": "...", "material": "...", "jejum": true ou false, "preparo": "...", "descricao": "...", "observacoes": "..."}]

Regras:
- "nome": nome do exame (ex: Hemograma, Raio-X de tórax).
- "tipo": "laboratorial" para exames de sangue/urina/fezes, "imagem" para raio-x, ultrassom, tomografia etc.
- "categoria": agrupamento curto e consistente (ex: Hematologia, Cardiologia).
- "material": o que é coletado ou o método (ex: Sangue, Urina, Raio-X). Use "" se não souber.
- "jejum": true se precisar de jejum, false caso contrário.
- "preparo": instruções de preparo em texto livre. Use "" se não houver.
- "descricao": o que o exame avalia/serve para quê.
- "observacoes": informação extra relevante. Use "" se não houver.
- Responda APENAS com o array JSON, sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: aiInput }], model: ADMIN_ASSISTANT_MODEL } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: ExameDraft[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any): ExameDraft => ({
          nome: it.nome || "", tipo: it.tipo === "imagem" ? "imagem" : "laboratorial",
          categoria: it.categoria || "", material: it.material || "", jejum: !!it.jejum,
          preparo: it.preparo || "", descricao: it.descricao || "", observacoes: it.observacoes || "", selected: true,
        }))
        .filter((it: any) => !!it.nome) as ExameDraft[];
      if (items.length === 0) { toast.error("A IA não conseguiu identificar nenhum exame no texto enviado."); return; }
      setAiPreview(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA.");
    } finally {
      setAiGenerating(false);
    }
  };

  const importSelected = async () => {
    const toImport = aiPreview.filter((i) => i.selected);
    if (toImport.length === 0) return;
    setAiImporting(true);
    try {
      for (const item of toImport) {
        await upsert({ data: { nome: item.nome, tipo: item.tipo, categoria: item.categoria || null, material: item.material || null, jejum: item.jejum, preparo: item.preparo || null, descricao: item.descricao || null, observacoes: item.observacoes || null, position: 0 } });
      }
      toast.success(`${toImport.length} exame(s) importado(s)!`);
      qc.invalidateQueries({ queryKey: ["exames"] });
      setAiOpen(false); setAiInput(""); setAiPreview([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setAiImporting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Exames ({q.data?.length ?? 0})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" /> Preencher com IA</Button>
          <Button size="sm" className="gap-2" onClick={() => setEdit({ nome: "", tipo: "laboratorial", categoria: "", material: "", jejum: false, preparo: "", descricao: "", observacoes: "", media: "", preparoItens: "", clinicaIds: [] })}><Plus className="h-4 w-4" /> Novo</Button>
        </div>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Jejum</TableHead><TableHead>Clínicas</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {(q.data ?? []).map((e: any) => (
            <TableRow key={e.id}>
              <TableCell><Badge variant="secondary">{e.tipo === "imagem" ? "Imagem" : "Laboratorial"}</Badge></TableCell>
              <TableCell className="font-medium">{e.nome}</TableCell>
              <TableCell>{e.categoria || "—"}</TableCell>
              <TableCell>{e.jejum ? "Sim" : "Não"}</TableCell>
              <TableCell>{(e.clinicas ?? []).length || <span className="text-xs text-muted-foreground">nenhuma</span>}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar exame" : "Novo exame"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={edit.tipo} onValueChange={(v) => setEdit({ ...edit, tipo: v as "laboratorial" | "imagem" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="laboratorial">Laboratorial</SelectItem><SelectItem value="imagem">Imagem</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Categoria</Label><Input value={edit.categoria} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })} placeholder="Ex: Hematologia" /></div>
                <div><Label>Material/Método</Label><Input value={edit.material} onChange={(e) => setEdit({ ...edit, material: e.target.value })} placeholder="Ex: Sangue" /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={edit.jejum} onCheckedChange={(v) => setEdit({ ...edit, jejum: v })} />
                <Label className="!mt-0">Precisa de jejum</Label>
              </div>
              <div><Label>Preparo</Label><Input value={edit.preparo} onChange={(e) => setEdit({ ...edit, preparo: e.target.value })} placeholder="Ex: 8-12h de jejum" /></div>
              <div><Label>Descrição</Label><Textarea rows={3} value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></div>
              <div><Label>Observações</Label><Input value={edit.observacoes} onChange={(e) => setEdit({ ...edit, observacoes: e.target.value })} /></div>
              <div>
                <Label>Média de referência (R$, opcional)</Label>
                <Input inputMode="decimal" value={edit.media} onChange={(e) => setEdit({ ...edit, media: e.target.value })} placeholder="Ex.: 450,00" />
                <p className="mt-1 text-xs text-muted-foreground">No site aparece com a observação “varia conforme o pedido médico”.</p>
              </div>
              <div>
                <Label>Preparo para o cliente (um item por linha)</Label>
                <Textarea rows={4} value={edit.preparoItens} onChange={(e) => setEdit({ ...edit, preparoItens: e.target.value })} placeholder={"Jejum de 8 horas\nLevar acompanhante maior de idade"} />
                <p className="mt-1 text-xs text-muted-foreground">Vazio: o site monta o preparo com jejum, preparo, material/método e observações acima.</p>
              </div>
              <ClinicasPicker value={edit.clinicaIds} onChange={(ids) => setEdit({ ...edit, clinicaIds: ids })} label="Clínicas onde faz" />
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={(v) => { setAiOpen(v); if (!v) { setAiPreview([]); setAiInput(""); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preencher Exames com IA</DialogTitle></DialogHeader>
          {aiPreview.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cole a lista de exames (pode ser em qualquer formato, tipo tabela ou texto corrido).</p>
              <Textarea rows={12} value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={"Ex:\nHemograma - Hematologia - sangue - sem jejum - avalia glóbulos vermelhos, brancos e plaquetas"} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Confira antes de importar. Você pode ajustar cada um depois na lista.</p>
              <Table>
                <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Tipo</TableHead><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Jejum</TableHead></TableRow></TableHeader>
                <TableBody>
                  {aiPreview.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell><input type="checkbox" checked={item.selected} onChange={(e) => setAiPreview((prev) => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))} /></TableCell>
                      <TableCell><Badge variant="secondary">{item.tipo === "imagem" ? "Imagem" : "Laboratorial"}</Badge></TableCell>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>{item.categoria || "—"}</TableCell>
                      <TableCell>{item.jejum ? "Sim" : "Não"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            {aiPreview.length === 0 ? (
              <Button onClick={generateFromAI} disabled={aiGenerating || !aiInput.trim()} className="gap-2"><Sparkles className="h-4 w-4" /> {aiGenerating ? "Gerando..." : "Gerar com IA"}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAiPreview([])}>Voltar</Button>
                <Button onClick={importSelected} disabled={aiImporting || aiPreview.every((p) => !p.selected)}>{aiImporting ? "Importando..." : `Importar ${aiPreview.filter((p) => p.selected).length} exame(s)`}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// Procedimentos Odontológicos
// ============================================================
type ProcedimentoDraft = { nome: string; categoria: string; descricao: string; cuidados_pos: string; observacoes: string; selected: boolean };

function OdontologiaSubTab() {
  const list = useServerFn(listProcedimentos);
  const upsert = useServerFn(upsertProcedimento);
  const del = useServerFn(deleteProcedimento);
  const setClinicasFn = useServerFn(setItemClinicas);
  const genAI = useServerFn(simulatorChat);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["procedimentos"], queryFn: () => list({}) });

  const [edit, setEdit] = useState<null | { id?: string; nome: string; categoria: string; descricao: string; cuidados_pos: string; observacoes: string; clinicaIds: string[] }>(null);

  const upsertMut = useMutation({
    mutationFn: async () => {
      const saved = await upsert({ data: {
        id: edit!.id, nome: edit!.nome, categoria: edit!.categoria || null,
        descricao: edit!.descricao || null, cuidados_pos: edit!.cuidados_pos || null, observacoes: edit!.observacoes || null, position: 0,
      } });
      const procId = edit!.id ?? String(saved.id);
      await setClinicasFn({ data: { tipo: "odontologia", item_id: String(procId), clinica_ids: edit!.clinicaIds } });
    },
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["procedimentos"] }); qc.invalidateQueries({ queryKey: ["amor-saude"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["procedimentos"] }); },
  });

  const openEdit = (p: any) => {
    const ids = ((p.clinicas ?? []) as { clinica_id: string }[]).map((c) => c.clinica_id);
    setEdit({ id: p.id, nome: p.nome, categoria: p.categoria ?? "", descricao: p.descricao ?? "", cuidados_pos: p.cuidados_pos ?? "", observacoes: p.observacoes ?? "", clinicaIds: ids });
  };

  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiPreview, setAiPreview] = useState<ProcedimentoDraft[]>([]);

  const generateFromAI = async () => {
    if (!aiInput.trim()) return;
    setAiGenerating(true);
    try {
      const prompt = `Você organiza uma lista de procedimentos odontológicos oferecidos por um cartão de descontos em saúde (Cartão de Todos), a partir de texto livre enviado por um administrador.
Extraia cada procedimento mencionado e devolva um array JSON, um objeto por item, no formato exato:
[{"nome": "...", "categoria": "...", "descricao": "...", "cuidados_pos": "...", "observacoes": "..."}]

Regras:
- "nome": nome do procedimento (ex: Limpeza, Extração, Clareamento).
- "categoria": agrupamento curto (ex: Preventivo, Cirúrgico, Estético).
- "descricao": como o procedimento funciona.
- "cuidados_pos": cuidados após o procedimento, em texto livre. Use "" se não houver.
- "observacoes": informação extra relevante. Use "" se não houver.
- Responda APENAS com o array JSON, sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: aiInput }], model: ADMIN_ASSISTANT_MODEL } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: ProcedimentoDraft[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({ nome: it.nome || "", categoria: it.categoria || "", descricao: it.descricao || "", cuidados_pos: it.cuidados_pos || "", observacoes: it.observacoes || "", selected: true }))
        .filter((it: any) => !!it.nome) as ProcedimentoDraft[];
      if (items.length === 0) { toast.error("A IA não conseguiu identificar nenhum procedimento no texto enviado."); return; }
      setAiPreview(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA.");
    } finally {
      setAiGenerating(false);
    }
  };

  const importSelected = async () => {
    const toImport = aiPreview.filter((i) => i.selected);
    if (toImport.length === 0) return;
    setAiImporting(true);
    try {
      for (const item of toImport) {
        await upsert({ data: { nome: item.nome, categoria: item.categoria || null, descricao: item.descricao || null, cuidados_pos: item.cuidados_pos || null, observacoes: item.observacoes || null, position: 0 } });
      }
      toast.success(`${toImport.length} procedimento(s) importado(s)!`);
      qc.invalidateQueries({ queryKey: ["procedimentos"] });
      setAiOpen(false); setAiInput(""); setAiPreview([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setAiImporting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Procedimentos Odontológicos ({q.data?.length ?? 0})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" /> Preencher com IA</Button>
          <Button size="sm" className="gap-2" onClick={() => setEdit({ nome: "", categoria: "", descricao: "", cuidados_pos: "", observacoes: "", clinicaIds: [] })}><Plus className="h-4 w-4" /> Novo</Button>
        </div>
      </div>
      <AvaliacaoOdontoField />
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Clínicas</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {(q.data ?? []).map((p: any) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.nome}</TableCell>
              <TableCell>{p.categoria || "—"}</TableCell>
              <TableCell>{(p.clinicas ?? []).length || <span className="text-xs text-muted-foreground">nenhuma</span>}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar procedimento" : "Novo procedimento"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
                <div><Label>Categoria</Label><Input value={edit.categoria} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })} placeholder="Ex: Preventivo" /></div>
              </div>
              <div><Label>Descrição</Label><Textarea rows={3} value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></div>
              <div><Label>Cuidados pós-procedimento</Label><Textarea rows={2} value={edit.cuidados_pos} onChange={(e) => setEdit({ ...edit, cuidados_pos: e.target.value })} /></div>
              <div><Label>Observações</Label><Input value={edit.observacoes} onChange={(e) => setEdit({ ...edit, observacoes: e.target.value })} /></div>
              <ClinicasPicker value={edit.clinicaIds} onChange={(ids) => setEdit({ ...edit, clinicaIds: ids })} label="Clínicas onde faz" />
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={(v) => { setAiOpen(v); if (!v) { setAiPreview([]); setAiInput(""); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preencher Procedimentos Odontológicos com IA</DialogTitle></DialogHeader>
          {aiPreview.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cole a lista de procedimentos.</p>
              <Textarea rows={12} value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={"Ex:\nLimpeza - Preventivo - remove tártaro e placa - evitar alimentos duros por 24h"} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Confira antes de importar.</p>
              <Table>
                <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Nome</TableHead><TableHead>Categoria</TableHead></TableRow></TableHeader>
                <TableBody>
                  {aiPreview.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell><input type="checkbox" checked={item.selected} onChange={(e) => setAiPreview((prev) => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))} /></TableCell>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>{item.categoria || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            {aiPreview.length === 0 ? (
              <Button onClick={generateFromAI} disabled={aiGenerating || !aiInput.trim()} className="gap-2"><Sparkles className="h-4 w-4" /> {aiGenerating ? "Gerando..." : "Gerar com IA"}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAiPreview([])}>Voltar</Button>
                <Button onClick={importSelected} disabled={aiImporting || aiPreview.every((p) => !p.selected)}>{aiImporting ? "Importando..." : `Importar ${aiPreview.filter((p) => p.selected).length} item(ns)`}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Valor geral da "Avaliação odontológica (Cartão de TODOS)", mostrado em Amor Saúde → Odontologia.
function AvaliacaoOdontoField() {
  const getFn = useServerFn(getAmorSaude);
  const setFn = useServerFn(setAvaliacaoOdonto);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["amor-saude"], queryFn: () => getFn({}) });
  const atual = q.data?.avaliacaoOdonto ?? null;
  const [valor, setValor] = useState<string | null>(null);
  const shown = valor ?? (atual != null ? String(atual).replace(".", ",") : "");
  const save = useMutation({
    mutationFn: () => setFn({ data: { valor: shown.trim() ? Number(shown.replace(",", ".")) : null } }),
    onSuccess: () => { toast.success("Valor da avaliação salvo."); setValor(null); qc.invalidateQueries({ queryKey: ["amor-saude"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
      <div>
        <Label htmlFor="avaliacao-odonto">Avaliação odontológica (Cartão de TODOS), R$</Label>
        <Input id="avaliacao-odonto" inputMode="decimal" className="mt-1 w-40" value={shown} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 25,00" />
      </div>
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || valor == null}>Salvar valor</Button>
      <p className="basis-full text-xs text-muted-foreground">Vazio: o bloco da avaliação não aparece no site.</p>
    </div>
  );
}
