import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listExames, upsertExame, deleteExame } from "@/lib/exames.functions";
import { setItemClinicas, deleteManyExames } from "@/lib/amorsaude.functions";
import { BarraLote, BuscaLista, CabecalhoSelecao, ConfirmarLote, useExcluirLote, useLote } from "@/components/admin/LoteAdmin";
import { Checkbox } from "@/components/ui/checkbox";
import { matches } from "@/components/amor-saude/model";
import { ClinicasPicker } from "@/components/admin/ClinicasPicker";
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
import { IaImportDialog, type ItemInterpretado } from "@/components/admin/IaImportDialog";
import { REGRAS_IA, listaDeTextos, numeroOuNull } from "@/lib/ia-importacao";
import { ExameDraft } from "@/components/admin/pricing-shared";


export function ExamesSubTab() {
  const list = useServerFn(listExames);
  const upsert = useServerFn(upsertExame);
  const del = useServerFn(deleteExame);
  const setClinicasFn = useServerFn(setItemClinicas);
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
  type ExameIA = Omit<ExameDraft, "selected" | "media_referencia" | "preparo_itens"> & { media: string; preparoItens: string };

  const promptIA = `Você organiza uma lista de exames laboratoriais e de imagem oferecidos por um cartão de descontos em saúde (Cartão de Todos, rede Amor Saúde), a partir de texto livre enviado por um administrador.
Extraia cada exame mencionado e devolva um array JSON, um objeto por item, no formato exato:
[{"nome": "...", "tipo": "laboratorial" ou "imagem", "categoria": "...", "material": "...", "jejum": true ou false, "preparo": "...", "descricao": "...", "observacoes": "...", "media_referencia": numero ou null, "preparo_itens": ["..."], "clinicas": ["..."]}]

Regras:
- ${REGRAS_IA.split("\n").join("\n- ")}
- "nome": nome do exame (ex: Hemograma, Raio-X de tórax).
- "tipo": "laboratorial" para exames de sangue/urina/fezes, "imagem" para raio-x, ultrassom, tomografia etc.
- "categoria": agrupamento curto e consistente (ex: Hematologia, Cardiologia).
- "material": o que é coletado ou o método (ex: Sangue, Urina, Raio-X). Use "" se não souber.
- "jejum": true só se o texto disser que precisa de jejum.
- "preparo": instruções de preparo em texto corrido, como estão no texto. Use "" se não houver.
- "preparo_itens": os mesmos passos de preparo em lista, um passo curto por item, derivados do preparo escrito no texto. Não invente jejum nem horas. Se o texto tiver só um passo, a lista tem um item; sem preparo, lista vazia.
- "descricao": o que o exame avalia/serve para quê.
- "observacoes": informação extra relevante. Use "" se não houver.
- "media_referencia": valor médio de referência em reais, só se estiver escrito no texto; senão null.
- "clinicas": nomes de clínica/região citados para o exame; use ["todas"] se o texto disser que vale em todas; lista vazia se não houver menção.`;

  const interpretarIA = (c: Record<string, unknown>): ItemInterpretado<ExameIA> | null => {
    const nome = String(c.nome ?? "").trim();
    if (!nome) return null;
    const txt = (v: unknown) => String(v ?? "").replace(/^null$/i, "").trim();
    const media = numeroOuNull(c.media_referencia);
    return {
      nome, clinicas: listaDeTextos(c.clinicas),
      dados: {
        nome, tipo: c.tipo === "imagem" ? "imagem" : "laboratorial", categoria: txt(c.categoria), material: txt(c.material),
        jejum: c.jejum === true, preparo: txt(c.preparo), descricao: txt(c.descricao), observacoes: txt(c.observacoes),
        media: media == null ? "" : String(media), preparoItens: listaDeTextos(c.preparo_itens).join("\n"),
      },
    };
  };

  const importarIA = async (d: ExameIA, extra: { clinicaIds: string[] }) => {
    const saved = await upsert({ data: {
      nome: d.nome.trim(), tipo: d.tipo, categoria: d.categoria.trim() || null, material: d.material.trim() || null, jejum: d.jejum,
      preparo: d.preparo.trim() || null, descricao: d.descricao.trim() || null, observacoes: d.observacoes.trim() || null, position: 0,
      media_referencia: d.media.trim() ? Number(d.media.replace(",", ".")) : null,
      preparo_itens: listaDeTextos(d.preparoItens),
    } });
    if (extra.clinicaIds.length > 0) await setClinicasFn({ data: { tipo: "exame", item_id: String(saved.id), clinica_ids: extra.clinicaIds } });
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

      <IaImportDialog<ExameIA>
        open={aiOpen} onOpenChange={setAiOpen} titulo="Preencher Exames com IA" rotuloItem="exame"
        instrucao="Cole a lista de exames (tabela ou texto do site, em qualquer formato). A IA preenche todos os campos, inclusive preparo e clínicas."
        placeholder={"Ex:\nHemograma - Hematologia - sangue - sem jejum - avalia glóbulos vermelhos, brancos e plaquetas"}
        prompt={promptIA} interpretar={interpretarIA} existentes={((q.data ?? []) as any[]).map((r) => r.nome)} comClinicas
        nomeDe={(d) => d.nome}
        resumo={(d) => `${d.tipo === "imagem" ? "Imagem" : "Laboratorial"} · ${d.categoria || "sem categoria"} · jejum: ${d.jejum ? "sim" : "não"}${d.media ? ` · média R$ ${Number(d.media).toFixed(2)}` : ""}`}
        campos={(d, set) => (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={d.nome} onChange={(e) => set({ nome: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={d.tipo} onValueChange={(v) => set({ tipo: v as "laboratorial" | "imagem" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="laboratorial">Laboratorial</SelectItem><SelectItem value="imagem">Imagem</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Input value={d.categoria} onChange={(e) => set({ categoria: e.target.value })} /></div>
              <div><Label>Material/Método</Label><Input value={d.material} onChange={(e) => set({ material: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={d.jejum} onCheckedChange={(v) => set({ jejum: v })} /><Label className="!mt-0">Precisa de jejum</Label></div>
            <div><Label>Preparo</Label><Input value={d.preparo} onChange={(e) => set({ preparo: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={d.descricao} onChange={(e) => set({ descricao: e.target.value })} /></div>
            <div><Label>Observações</Label><Input value={d.observacoes} onChange={(e) => set({ observacoes: e.target.value })} /></div>
            <div><Label>Média de referência (R$, opcional)</Label><Input inputMode="decimal" value={d.media} onChange={(e) => set({ media: e.target.value })} /></div>
            <div><Label>Preparo para o cliente (um item por linha)</Label><Textarea rows={4} value={d.preparoItens} onChange={(e) => set({ preparoItens: e.target.value })} /></div>
          </>
        )}
        importar={importarIA}
        onConcluido={() => { qc.invalidateQueries({ queryKey: ["exames"] }); qc.invalidateQueries({ queryKey: ["amor-saude"] }); }}
      />
    </Card>
  );
}
