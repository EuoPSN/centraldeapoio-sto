import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listPricing, upsertPricing, deletePricing, setPricingItemUnidades } from "@/lib/content.functions";
import { listUnidades, upsertUnidade } from "@/lib/unidades.functions";
import { setItemClinicas, deleteManyConsultas } from "@/lib/amorsaude.functions";
import { BarraLote, BuscaLista, CabecalhoSelecao, ConfirmarLote, useExcluirLote, useLote } from "@/components/admin/LoteAdmin";
import { Checkbox } from "@/components/ui/checkbox";
import { matches } from "@/components/amor-saude/model";
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
import { Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_ASSISTANT_MODEL } from "@/lib/ai-models";


// ============================================================
// Consultas (o que já existia como "Preços")
// ============================================================
export function ConsultasSubTab() {
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
  const [busca, setBusca] = useState("");
  const visiveis = useMemo(
    () => ((q.data ?? []) as any[]).filter((r) => matches(busca, r.specialty, r.area, r.category)),
    [q.data, busca],
  );
  const lote = useLote(visiveis);
  const apagarLote = useServerFn(deleteManyConsultas);
  const excluir = useExcluirLote(lote, (r: any) => r.specialty, (ids) => apagarLote({ data: { ids } }), () => {
    toast.success("Excluídos.");
    qc.invalidateQueries({ queryKey: ["pricing"] });
    qc.invalidateQueries({ queryKey: ["amor-saude"] });
  });

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
      <div className="px-4 pt-3"><BuscaLista valor={busca} onChange={setBusca} placeholder="Buscar…" /></div>
      <BarraLote quantidade={lote.sel.size} total={lote.total} todos={lote.todos} onSelecionarTodos={lote.selecionarTodos} onLimpar={lote.limpar} onExcluir={excluir.abrir} ocupado={excluir.ocupado} />
      <ConfirmarLote aberto={excluir.aberto} onFechar={excluir.fechar} onConfirmar={excluir.confirmar} nomes={excluir.nomes} singular="consulta" plural="consultas" ocupado={excluir.ocupado} erro={excluir.erro} />
      <Table>
        <TableHeader><TableRow><CabecalhoSelecao todos={lote.todos} algum={lote.algum} onToggle={lote.alternarTodos} /><TableHead>Área</TableHead><TableHead>Especialidade</TableHead><TableHead className="text-right">CDT</TableHead><TableHead className="text-right">Particular</TableHead><TableHead>Clínicas</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {visiveis.map((p: any) => (
            <TableRow key={p.id}>
              <TableCell><Checkbox aria-label={`Selecionar ${p.specialty}`} checked={lote.marcado(p.id)} onCheckedChange={() => lote.alternar(p.id)} /></TableCell>
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
