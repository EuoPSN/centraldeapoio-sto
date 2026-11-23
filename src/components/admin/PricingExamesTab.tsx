import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listExames, upsertExame, deleteExame } from "@/lib/exames.functions";
import { setItemClinicas, deleteManyExames } from "@/lib/amorsaude.functions";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_ASSISTANT_MODEL } from "@/lib/ai-models";
import { ExameDraft } from "@/components/admin/pricing-shared";


export function ExamesSubTab() {
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

  const [busca, setBusca] = useState("");
  const visiveis = useMemo(
    () => ((q.data ?? []) as any[]).filter((r) => matches(busca, r.nome, r.categoria, r.tipo)),
    [q.data, busca],
  );
  const lote = useLote(visiveis);
  const apagarLote = useServerFn(deleteManyExames);
  const excluir = useExcluirLote(lote, (r: any) => r.nome, (ids) => apagarLote({ data: { ids } }), () => {
    toast.success("Excluídos.");
    qc.invalidateQueries({ queryKey: ["exames"] });
    qc.invalidateQueries({ queryKey: ["amor-saude"] });
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Exames ({q.data?.length ?? 0})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" /> Preencher com IA</Button>
          <Button size="sm" className="gap-2" onClick={() => setEdit({ nome: "", tipo: "laboratorial", categoria: "", material: "", jejum: false, preparo: "", descricao: "", observacoes: "", media: "", preparoItens: "", clinicaIds: [] })}><Plus className="h-4 w-4" /> Novo</Button>
        </div>
      </div>
      <div className="px-4 pt-3"><BuscaLista valor={busca} onChange={setBusca} placeholder="Buscar…" /></div>
      <BarraLote quantidade={lote.sel.size} total={lote.total} todos={lote.todos} onSelecionarTodos={lote.selecionarTodos} onLimpar={lote.limpar} onExcluir={excluir.abrir} ocupado={excluir.ocupado} />
      <ConfirmarLote aberto={excluir.aberto} onFechar={excluir.fechar} onConfirmar={excluir.confirmar} nomes={excluir.nomes} singular="exame" plural="exames" ocupado={excluir.ocupado} erro={excluir.erro} />
      <Table>
        <TableHeader><TableRow><CabecalhoSelecao todos={lote.todos} algum={lote.algum} onToggle={lote.alternarTodos} /><TableHead>Tipo</TableHead><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Jejum</TableHead><TableHead>Clínicas</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {visiveis.map((e: any) => (
            <TableRow key={e.id}>
              <TableCell><Checkbox aria-label={`Selecionar ${e.nome}`} checked={lote.marcado(e.id)} onCheckedChange={() => lote.alternar(e.id)} /></TableCell>
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
