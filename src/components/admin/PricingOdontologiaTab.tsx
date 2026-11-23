import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listProcedimentos, upsertProcedimento, deleteProcedimento } from "@/lib/odontologia.functions";
import { setItemClinicas, deleteManyProcedimentos } from "@/lib/amorsaude.functions";
import { BarraLote, BuscaLista, CabecalhoSelecao, ConfirmarLote, useExcluirLote, useLote } from "@/components/admin/LoteAdmin";
import { Checkbox } from "@/components/ui/checkbox";
import { matches } from "@/components/amor-saude/model";
import { ClinicasPicker } from "@/components/admin/ClinicasPicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { IaImportDialog, type ItemInterpretado } from "@/components/admin/IaImportDialog";
import { REGRAS_IA, listaDeTextos } from "@/lib/ia-importacao";
import { ProcedimentoDraft, AvaliacaoOdontoField } from "@/components/admin/pricing-shared";


export function OdontologiaSubTab() {
  const list = useServerFn(listProcedimentos);
  const upsert = useServerFn(upsertProcedimento);
  const del = useServerFn(deleteProcedimento);
  const setClinicasFn = useServerFn(setItemClinicas);
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
  type ProcIA = Omit<ProcedimentoDraft, "selected">;

  const promptIA = `Você organiza uma lista de procedimentos odontológicos oferecidos por um cartão de descontos em saúde (Cartão de Todos, rede Amor Saúde), a partir de texto livre enviado por um administrador.
Extraia cada procedimento mencionado e devolva um array JSON, um objeto por item, no formato exato:
[{"nome": "...", "categoria": "...", "descricao": "...", "cuidados_pos": "...", "observacoes": "...", "clinicas": ["..."]}]

Regras:
- ${REGRAS_IA.split("\n").join("\n- ")}
- Não devolva preço: não há campo de preço nesta lista.
- "nome": nome do procedimento (ex: Limpeza, Extração, Clareamento).
- "categoria": agrupamento curto (ex: Preventivo, Cirúrgico, Estético).
- "descricao": como o procedimento funciona.
- "cuidados_pos": cuidados após o procedimento, em texto livre. Use "" se não houver.
- "observacoes": informação extra relevante. Use "" se não houver.
- "clinicas": nomes de clínica/região citados para o procedimento; use ["todas"] se o texto disser que vale em todas; lista vazia se não houver menção.`;

  const interpretarIA = (c: Record<string, unknown>): ItemInterpretado<ProcIA> | null => {
    const nome = String(c.nome ?? "").trim();
    if (!nome) return null;
    const txt = (v: unknown) => String(v ?? "").replace(/^null$/i, "").trim();
    return { nome, clinicas: listaDeTextos(c.clinicas), dados: { nome, categoria: txt(c.categoria), descricao: txt(c.descricao), cuidados_pos: txt(c.cuidados_pos), observacoes: txt(c.observacoes) } };
  };

  const importarIA = async (d: ProcIA, extra: { clinicaIds: string[] }) => {
    const saved = await upsert({ data: { nome: d.nome.trim(), categoria: d.categoria.trim() || null, descricao: d.descricao.trim() || null, cuidados_pos: d.cuidados_pos.trim() || null, observacoes: d.observacoes.trim() || null, position: 0 } });
    if (extra.clinicaIds.length > 0) await setClinicasFn({ data: { tipo: "odontologia", item_id: String(saved.id), clinica_ids: extra.clinicaIds } });
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

      <IaImportDialog<ProcIA>
        open={aiOpen} onOpenChange={setAiOpen} titulo="Preencher Procedimentos Odontológicos com IA" rotuloItem="procedimento"
        instrucao="Cole a lista de procedimentos (tabela ou texto do site). A IA preenche todos os campos, inclusive as clínicas."
        placeholder={"Ex:\nLimpeza - Preventivo - remove tártaro e placa - evitar alimentos duros por 24h"}
        prompt={promptIA} interpretar={interpretarIA} existentes={((q.data ?? []) as any[]).map((r) => r.nome)} comClinicas
        nomeDe={(d) => d.nome}
        resumo={(d) => d.categoria || "sem categoria"}
        campos={(d, set) => (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={d.nome} onChange={(e) => set({ nome: e.target.value })} /></div>
              <div><Label>Categoria</Label><Input value={d.categoria} onChange={(e) => set({ categoria: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea rows={3} value={d.descricao} onChange={(e) => set({ descricao: e.target.value })} /></div>
            <div><Label>Cuidados pós-procedimento</Label><Textarea rows={2} value={d.cuidados_pos} onChange={(e) => set({ cuidados_pos: e.target.value })} /></div>
            <div><Label>Observações</Label><Input value={d.observacoes} onChange={(e) => set({ observacoes: e.target.value })} /></div>
          </>
        )}
        importar={importarIA}
        onConcluido={() => { qc.invalidateQueries({ queryKey: ["procedimentos"] }); qc.invalidateQueries({ queryKey: ["amor-saude"] }); }}
      />
    </Card>
  );
}
