import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listContatos, upsertContato, deleteContato } from "@/lib/contatos.functions";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2, Sparkles, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_ASSISTANT_MODEL } from "@/lib/ai-models";
import { ClinicaDraft } from "@/components/admin/pricing-shared";


export function ClinicasSubTab() {
  const list = useServerFn(listContatos);
  const upsert = useServerFn(upsertContato);
  const del = useServerFn(deleteContato);
  const genAI = useServerFn(simulatorChat);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["contatos"], queryFn: () => list({}) });
  const rows = ((q.data ?? []) as any[]).filter((r) => r.tipo === "clinica_amor_saude").sort((a, b) => a.position - b.position);
  const regioesExistentes = [...new Set(rows.map((r) => (r.regiao as string | null)?.trim()).filter((x): x is string => !!x))].sort();

  const [edit, setEdit] = useState<null | {
    id?: string; nome_regiao: string; endereco: string; numero: string; ponto_referencia: string;
    contato1: string; contato2: string; contato3: string; destaque: boolean; position: number;
    regiao: string; maps_url: string;
  }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, tipo: "clinica_amor_saude", nome_regiao: edit!.nome_regiao,
      endereco: edit!.endereco || null, numero: edit!.numero || null, ponto_referencia: edit!.ponto_referencia || null,
      contato1: edit!.contato1 || null, contato2: edit!.contato2 || null, contato3: edit!.contato3 || null,
      destaque: edit!.destaque, position: edit!.position,
      regiao: edit!.regiao.trim() || null, maps_url: edit!.maps_url.trim() || null,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["contatos"] }); qc.invalidateQueries({ queryKey: ["amor-saude"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["contatos"] }); qc.invalidateQueries({ queryKey: ["amor-saude"] }); },
  });

  const moveRow = async (idx: number, dir: -1 | 1) => {
    const arr = [...rows];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((r, i) => upsert({ data: { id: r.id, tipo: r.tipo, nome_regiao: r.nome_regiao, endereco: r.endereco, numero: r.numero, ponto_referencia: r.ponto_referencia, contato1: r.contato1, contato2: r.contato2, contato3: r.contato3, destaque: r.destaque, position: i * 10, regiao: r.regiao, maps_url: r.maps_url } })));
    qc.invalidateQueries({ queryKey: ["contatos"] });
  };

  const toggleDestaque = (r: any) => upsert({ data: {
    id: r.id, tipo: r.tipo, nome_regiao: r.nome_regiao, endereco: r.endereco, numero: r.numero,
    ponto_referencia: r.ponto_referencia, contato1: r.contato1, contato2: r.contato2, contato3: r.contato3,
    destaque: !r.destaque, position: r.position, regiao: r.regiao, maps_url: r.maps_url,
  } }).then(() => qc.invalidateQueries({ queryKey: ["contatos"] }));

  const openEdit = (r: any) => setEdit({
    id: r.id, nome_regiao: r.nome_regiao, endereco: r.endereco ?? "", numero: r.numero ?? "", ponto_referencia: r.ponto_referencia ?? "",
    contato1: r.contato1 ?? "", contato2: r.contato2 ?? "", contato3: r.contato3 ?? "", destaque: r.destaque, position: r.position,
    regiao: r.regiao ?? "", maps_url: r.maps_url ?? "",
  });

  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiPreview, setAiPreview] = useState<ClinicaDraft[]>([]);

  const generateFromAI = async () => {
    if (!aiInput.trim()) return;
    setAiGenerating(true);
    try {
      const prompt = `Você organiza uma lista de clínicas Amor Saúde do Cartão de Todos, a partir de texto livre enviado por um administrador.
Extraia cada clínica mencionada e devolva um array JSON, um objeto por item, no formato exato:
[{"nome_regiao": "...", "endereco": "...", "numero": "...", "contato1": "...", "contato2": "...", "contato3": "..."}]

Regras:
- "nome_regiao": nome da clínica (ex: "Clínica Amor Saúde Justinópolis").
- "endereco": nome da rua/avenida, SEM o número. Use "" se não houver.
- "numero": só o número do endereço, separado. Use "" se não houver.
- "contato1", "contato2", "contato3": até 3 telefones/whatsapp mencionados, um em cada campo. Use "" para os que não existirem.
- Responda APENAS com o array JSON, sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: aiInput }], model: ADMIN_ASSISTANT_MODEL } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: ClinicaDraft[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({ nome_regiao: it.nome_regiao || "", endereco: it.endereco || "", numero: it.numero || "", contato1: it.contato1 || "", contato2: it.contato2 || "", contato3: it.contato3 || "", selected: true }))
        .filter((it: ClinicaDraft) => it.nome_regiao);
      if (items.length === 0) { toast.error("A IA não conseguiu identificar nenhuma clínica no texto enviado."); return; }
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
        await upsert({ data: { tipo: "clinica_amor_saude", nome_regiao: item.nome_regiao, endereco: item.endereco || null, numero: item.numero || null, contato1: item.contato1 || null, contato2: item.contato2 || null, contato3: item.contato3 || null, destaque: false, position: 0 } });
      }
      toast.success(`${toImport.length} clínica(s) importada(s)!`);
      qc.invalidateQueries({ queryKey: ["contatos"] });
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
        <h3 className="font-semibold">Clínicas Amor Saúde ({rows.length})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" /> Preencher com IA</Button>
          <Button size="sm" className="gap-2" onClick={() => setEdit({ nome_regiao: "", endereco: "", numero: "", ponto_referencia: "", contato1: "", contato2: "", contato3: "", destaque: false, position: rows.length * 10, regiao: "", maps_url: "" })}><Plus className="h-4 w-4" /> Nova</Button>
        </div>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Clínica</TableHead><TableHead>Região</TableHead><TableHead>Endereço</TableHead><TableHead>Destaque</TableHead><TableHead>Contatos</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.nome_regiao}</TableCell>
              <TableCell className="text-sm">{r.regiao || <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{[r.endereco, r.numero ? `nº ${r.numero}` : null].filter(Boolean).join(", ") || "—"}</TableCell>
              <TableCell>
                <button type="button" onClick={() => toggleDestaque(r)} title="Clique para alternar">
                  {r.destaque ? <Badge>Principal</Badge> : <Badge variant="secondary">Outras</Badge>}
                </button>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{[r.contato1, r.contato2, r.contato3].filter(Boolean).join(" · ") || "—"}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => moveRow(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === rows.length - 1} onClick={() => moveRow(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma clínica cadastrada ainda.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar" : "Nova"} clínica Amor Saúde</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Nome da clínica</Label><Input value={edit.nome_regiao} onChange={(e) => setEdit({ ...edit, nome_regiao: e.target.value })} placeholder="Ex: Clínica Amor Saúde Justinópolis" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label>Endereço</Label><Input value={edit.endereco} onChange={(e) => setEdit({ ...edit, endereco: e.target.value })} placeholder="Rua Exemplo" /></div>
                <div><Label>Número</Label><Input value={edit.numero} onChange={(e) => setEdit({ ...edit, numero: e.target.value })} placeholder="206" /></div>
              </div>
              <div><Label>Ponto de referência (opcional)</Label><Input value={edit.ponto_referencia} onChange={(e) => setEdit({ ...edit, ponto_referencia: e.target.value })} placeholder="Ex: próximo à praça central" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Região</Label>
                  <Input list="amor-regioes-clinicas" value={edit.regiao} onChange={(e) => setEdit({ ...edit, regiao: e.target.value })} placeholder="Ex.: Justinópolis" />
                  <datalist id="amor-regioes-clinicas">{regioesExistentes.map((r) => <option key={r} value={r} />)}</datalist>
                </div>
                <div>
                  <Label>Link do Google Maps (opcional)</Label>
                  <Input value={edit.maps_url} onChange={(e) => setEdit({ ...edit, maps_url: e.target.value })} placeholder="Vazio: o site gera pelo endereço" />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">A região organiza o seletor "Região do cliente" no Amor Saúde. Telefone/WhatsApp é o Contato 1.</p>
              </div>
              <div><Label>Contato 1</Label><Input value={edit.contato1} onChange={(e) => setEdit({ ...edit, contato1: e.target.value })} placeholder="(31) 99999-0000" /></div>
              <div><Label>Contato 2 (opcional)</Label><Input value={edit.contato2} onChange={(e) => setEdit({ ...edit, contato2: e.target.value })} /></div>
              <div><Label>Contato 3 (opcional)</Label><Input value={edit.contato3} onChange={(e) => setEdit({ ...edit, contato3: e.target.value })} /></div>
              <div>
                <Label>Destaque</Label>
                <Select value={edit.destaque ? "principal" : "outras"} onValueChange={(v) => setEdit({ ...edit, destaque: v === "principal" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principal">Principal</SelectItem>
                    <SelectItem value="outras">Outras regiões</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={(v) => { setAiOpen(v); if (!v) { setAiPreview([]); setAiInput(""); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preencher Clínicas com IA</DialogTitle></DialogHeader>
          {aiPreview.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cole a lista de clínicas, endereços e telefones (pode ser texto corrido, bagunçado). A IA organiza.</p>
              <Textarea rows={12} value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={"Ex:\nClínica Amor Saúde Justinópolis - Rua Exemplo, 100 - (31) 99999-0000"} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Confira antes de importar.</p>
              <Table>
                <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Clínica</TableHead><TableHead>Endereço</TableHead><TableHead>Contatos</TableHead></TableRow></TableHeader>
                <TableBody>
                  {aiPreview.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell><input type="checkbox" checked={item.selected} onChange={(e) => setAiPreview((prev) => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))} /></TableCell>
                      <TableCell className="font-medium">{item.nome_regiao}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{[item.endereco, item.numero ? `nº ${item.numero}` : null].filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{[item.contato1, item.contato2, item.contato3].filter(Boolean).join(" · ") || "—"}</TableCell>
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
                <Button onClick={importSelected} disabled={aiImporting || aiPreview.every((p) => !p.selected)}>{aiImporting ? "Importando..." : `Importar ${aiPreview.filter((p) => p.selected).length} clínica(s)`}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
