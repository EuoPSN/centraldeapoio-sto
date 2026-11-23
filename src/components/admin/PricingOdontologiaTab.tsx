import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listProcedimentos, upsertProcedimento, deleteProcedimento } from "@/lib/odontologia.functions";
import { setItemClinicas, deleteManyProcedimentos } from "@/lib/amorsaude.functions";
import { BarraLote, BuscaLista, CabecalhoSelecao, ConfirmarLote, useExcluirLote, useLote } from "@/components/admin/LoteAdmin";
import { Checkbox } from "@/components/ui/checkbox";
import { matches } from "@/components/amor-saude/model";
import { ClinicasPicker } from "@/components/admin/ClinicasPicker";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_ASSISTANT_MODEL } from "@/lib/ai-models";
import { ProcedimentoDraft, AvaliacaoOdontoField } from "@/components/admin/pricing-shared";


export function OdontologiaSubTab() {
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

  const [busca, setBusca] = useState("");
  const visiveis = useMemo(
    () => ((q.data ?? []) as any[]).filter((r) => matches(busca, r.nome, r.categoria)),
    [q.data, busca],
  );
  const lote = useLote(visiveis);
  const apagarLote = useServerFn(deleteManyProcedimentos);
  const excluir = useExcluirLote(lote, (r: any) => r.nome, (ids) => apagarLote({ data: { ids } }), () => {
    toast.success("Excluídos.");
    qc.invalidateQueries({ queryKey: ["procedimentos"] });
    qc.invalidateQueries({ queryKey: ["amor-saude"] });
  });

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
      <div className="px-4 pt-3"><BuscaLista valor={busca} onChange={setBusca} placeholder="Buscar…" /></div>
      <BarraLote quantidade={lote.sel.size} total={lote.total} todos={lote.todos} onSelecionarTodos={lote.selecionarTodos} onLimpar={lote.limpar} onExcluir={excluir.abrir} ocupado={excluir.ocupado} />
      <ConfirmarLote aberto={excluir.aberto} onFechar={excluir.fechar} onConfirmar={excluir.confirmar} nomes={excluir.nomes} singular="procedimento" plural="procedimentos" ocupado={excluir.ocupado} erro={excluir.erro} />
      <Table>
        <TableHeader><TableRow><CabecalhoSelecao todos={lote.todos} algum={lote.algum} onToggle={lote.alternarTodos} /><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Clínicas</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {visiveis.map((p: any) => (
            <TableRow key={p.id}>
              <TableCell><Checkbox aria-label={`Selecionar ${p.nome}`} checked={lote.marcado(p.id)} onCheckedChange={() => lote.alternar(p.id)} /></TableCell>
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
