import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listPricing, upsertPricing, deletePricing } from "@/lib/content.functions";
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
import { IaImportDialog, type ItemInterpretado } from "@/components/admin/IaImportDialog";
import { REGRAS_IA, listaDeTextos, numeroOuNull } from "@/lib/ia-importacao";


// ============================================================
// Consultas (o que já existia como "Preços")
// ============================================================
export function ConsultasSubTab() {
  const list = useServerFn(listPricing);
  const upsert = useServerFn(upsertPricing);
  const del = useServerFn(deletePricing);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pricing"], queryFn: () => list({}) });

  const setClinicasFn = useServerFn(setItemClinicas);
  type ConsultaEdit = {
    id?: string; category: string; specialty: string; cartao_price: number | string | null; particular_price: number | string | null;
    notes: string; description: string; area: string; para_quem: string; como_agendar: string;
    clinicaIds: string[]; refAntiga: string | null; pendente: boolean;
  };
  const [edit, setEdit] = useState<null | ConsultaEdit>(null);
  const [descGenerating, setDescGenerating] = useState(false);

  type ConsultaIA = { category: string; specialty: string; cartao_price: string; particular_price: string; notes: string; area: string; para_quem: string; como_agendar: string; description: string };
  const genAI = useServerFn(simulatorChat);
  const [aiOpen, setAiOpen] = useState(false);

  const promptIA = `Você organiza tabelas de preços de consultas de um cartão de descontos em saúde (Cartão de Todos, rede Amor Saúde) a partir de texto livre enviado por um administrador.
Extraia cada especialidade ou consulta mencionada e devolva um array JSON, um objeto por item, no formato exato:
[{"category": "Consultas", "specialty": "...", "cartao_price": numero ou null, "particular_price": numero ou null, "notes": "texto curto ou null", "area": "...", "para_quem": "...", "como_agendar": "texto ou null", "description": "...", "clinicas": ["..."]}]

Regras:
- ${REGRAS_IA.split("\n").join("\n- ")}
- "category": use "Consultas" quando o texto não indicar outra categoria.
- "specialty": nome específico da especialidade (ex: Cardiologista).
- "cartao_price" e "particular_price": só se estiverem escritos no texto; senão null.
- "notes": só informação extra relevante do texto; senão null.
- "area": uma destas, exatamente: ${AREAS.map((a) => `"${a}"`).join(", ")}. Use "Outras" se nenhuma servir.
- "para_quem": 1 a 2 frases dizendo para quem indicar esta consulta.
- "como_agendar": apenas o que o texto disser sobre agendamento; senão null.
- "description": descrição para busca, 1 a 2 frases, até 240 caracteres, com 3 a 6 palavras-chave/sinônimos. É o único campo em que você pode compor texto próprio, mesmo que o texto enviado não traga nada.
- "clinicas": nomes de clínica/região citados para o item; use ["todas"] se o texto disser que vale em todas; lista vazia se não houver menção.`;

  const interpretarIA = (c: Record<string, unknown>): ItemInterpretado<ConsultaIA> | null => {
    const specialty = String(c.specialty ?? "").trim();
    if (!specialty) return null;
    const area = String(c.area ?? "").trim();
    const num = (v: unknown) => { const n = numeroOuNull(v); return n == null ? "" : String(n); };
    return {
      nome: specialty,
      clinicas: listaDeTextos(c.clinicas),
      dados: {
        category: String(c.category ?? "").trim() || "Consultas", specialty,
        cartao_price: num(c.cartao_price), particular_price: num(c.particular_price),
        notes: String(c.notes ?? "").replace(/^null$/i, "").trim(),
        area: (AREAS as readonly string[]).includes(area) ? area : "Outras",
        para_quem: String(c.para_quem ?? "").trim(), como_agendar: String(c.como_agendar ?? "").replace(/^null$/i, "").trim(),
        description: String(c.description ?? "").trim().slice(0, 240),
      },
    };
  };

  const importarIA = async (d: ConsultaIA, extra: { clinicaIds: string[]; pendente: boolean }) => {
    const saved = await upsert({ data: {
      category: d.category.trim() || "Consultas", specialty: d.specialty.trim(),
      cartao_price: d.cartao_price ? Number(d.cartao_price) : null, particular_price: d.particular_price ? Number(d.particular_price) : null,
      notes: d.notes.trim() || null, description: d.description.trim() || null, position: 0,
      area: d.area.trim() || null, para_quem: d.para_quem.trim() || null, como_agendar: d.como_agendar.trim() || null,
      clinicas_pendente: extra.pendente,
    } });
    if (extra.clinicaIds.length > 0) await setClinicasFn({ data: { tipo: "consulta", item_id: String(saved.id), clinica_ids: extra.clinicaIds } });
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

      <IaImportDialog<ConsultaIA>
        open={aiOpen} onOpenChange={setAiOpen} titulo="Preencher Consultas com IA" rotuloItem="item"
        instrucao="Cole o conteúdo com especialidades, valores, áreas e clínicas (tabelas ou texto do site). A IA organiza todos os campos."
        placeholder={"Ex:\nCardiologia - consulta - R$ 80 pelo cartão, R$ 180 particular - todas as clínicas"}
        prompt={promptIA} interpretar={interpretarIA} existentes={((q.data ?? []) as any[]).map((r) => r.specialty)} comClinicas
        nomeDe={(d) => d.specialty}
        resumo={(d) => `${d.area || "Outras"} · CDT ${d.cartao_price ? `R$ ${Number(d.cartao_price).toFixed(2)}` : "—"} · Particular ${d.particular_price ? `R$ ${Number(d.particular_price).toFixed(2)}` : "—"}`}
        campos={(d, set) => (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Input value={d.category} onChange={(e) => set({ category: e.target.value })} /></div>
              <div><Label>Especialidade</Label><Input value={d.specialty} onChange={(e) => set({ specialty: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor CDT (R$)</Label><Input type="number" step="0.01" value={d.cartao_price} onChange={(e) => set({ cartao_price: e.target.value })} /></div>
              <div><Label>Valor Particular (R$)</Label><Input type="number" step="0.01" value={d.particular_price} onChange={(e) => set({ particular_price: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Input value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
            <div><Label>Área</Label><Input list="amor-areas" value={d.area} onChange={(e) => set({ area: e.target.value })} /></div>
            <div><Label>Para quem indicar</Label><Textarea rows={2} value={d.para_quem} onChange={(e) => set({ para_quem: e.target.value })} /></div>
            <div><Label>Como agendar</Label><Textarea rows={2} value={d.como_agendar} onChange={(e) => set({ como_agendar: e.target.value })} /></div>
            <div><Label>Descrição para busca</Label><Textarea rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} /></div>
          </>
        )}
        importar={importarIA}
        onConcluido={() => { qc.invalidateQueries({ queryKey: ["pricing"] }); qc.invalidateQueries({ queryKey: ["amor-saude"] }); }}
      />
    </Card>
  );
}
