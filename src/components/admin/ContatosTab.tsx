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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_ASSISTANT_MODEL } from "@/lib/ai-models";

// Linha crua como vem do banco (contatos_enderecos): todos os campos opcionais
// coexistem na mesma tabela; cada sub-aba só usa os que precisa.
interface Row {
  id: string;
  tipo: string;
  nome_regiao: string;
  position: number;
  destaque: boolean;
  endereco: string | null;
  numero: string | null;
  ponto_referencia: string | null;
  contato1: string | null;
  contato2: string | null;
  contato3: string | null;
  bairro: string | null;
  cidade: string | null;
  horario: string | null;
  atende_tambem: string[];
  maps_url: string | null;
  subtitulo: string | null;
  quando_indicar: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
}

// Admin → Contatos e Endereços: Unidades CDT (tipo "cartao_de_todos") e Suporte e
// setores (tipo "outros"). As clínicas Amor Saúde saíram daqui — ficam em
// Painel Admin → Tabela de Preços → Clínicas, perto do resto do catálogo do Amor Saúde.
export function ContatosTab() {
  return (
    <Tabs defaultValue="unidades">
      <TabsList>
        <TabsTrigger value="unidades">Unidades CDT</TabsTrigger>
        <TabsTrigger value="suporte">Suporte e setores</TabsTrigger>
      </TabsList>
      <TabsContent value="unidades" className="mt-4"><UnidadesCdtSubTab /></TabsContent>
      <TabsContent value="suporte" className="mt-4"><SuporteSubTab /></TabsContent>
    </Tabs>
  );
}

function useContatosRows(tipo: "cartao_de_todos" | "outros") {
  const list = useServerFn(listContatos);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["contatos"], queryFn: () => list({}) });
  const rows = ((q.data ?? []) as Row[]).filter((r) => r.tipo === tipo).sort((a, b) => a.position - b.position);
  return { rows, qc, isLoading: q.isLoading };
}

/** Campo de etiquetas: digita e Enter adiciona; cada etiqueta tem um "x" para remover. */
function TagsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="rounded-md border border-input p-1.5">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remover ${t}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1)); }}
          onBlur={add}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
    </div>
  );
}

// ============================================================
// Unidades CDT (tipo = cartao_de_todos)
// ============================================================
type UnidadeDraft = { nome_regiao: string; bairro: string; cidade: string; endereco: string; numero: string; horario: string; contato1: string; contato2: string; contato3: string; selected: boolean };

function UnidadesCdtSubTab() {
  const upsert = useServerFn(upsertContato);
  const del = useServerFn(deleteContato);
  const genAI = useServerFn(simulatorChat);
  const { rows, qc, isLoading } = useContatosRows("cartao_de_todos");

  const [edit, setEdit] = useState<null | {
    id?: string; nome_regiao: string; bairro: string; cidade: string; endereco: string; numero: string; ponto_referencia: string;
    horario: string; contato1: string; contato2: string; contato3: string; maps_url: string; atende_tambem: string[];
    destaque: boolean; position: number;
  }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, tipo: "cartao_de_todos", nome_regiao: edit!.nome_regiao,
      bairro: edit!.bairro || null, cidade: edit!.cidade || null,
      endereco: edit!.endereco || null, numero: edit!.numero || null, ponto_referencia: edit!.ponto_referencia || null,
      horario: edit!.horario || null, contato1: edit!.contato1 || null, contato2: edit!.contato2 || null, contato3: edit!.contato3 || null,
      maps_url: edit!.maps_url || null, atende_tambem: edit!.atende_tambem,
      destaque: edit!.destaque, position: edit!.position,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["contatos"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["contatos"] }); },
  });

  const moveRow = async (idx: number, dir: -1 | 1) => {
    const arr = [...rows];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((r, i) => upsert({ data: { ...r, position: i * 10 } })));
    qc.invalidateQueries({ queryKey: ["contatos"] });
  };
  const toggleDestaque = (r: Row) => upsert({ data: { ...r, destaque: !r.destaque } }).then(() => qc.invalidateQueries({ queryKey: ["contatos"] }));

  const openEdit = (r: Row) => setEdit({
    id: r.id, nome_regiao: r.nome_regiao, bairro: r.bairro ?? "", cidade: r.cidade ?? "",
    endereco: r.endereco ?? "", numero: r.numero ?? "", ponto_referencia: r.ponto_referencia ?? "",
    horario: r.horario ?? "", contato1: r.contato1 ?? "", contato2: r.contato2 ?? "", contato3: r.contato3 ?? "",
    maps_url: r.maps_url ?? "", atende_tambem: Array.isArray(r.atende_tambem) ? r.atende_tambem : [],
    destaque: r.destaque, position: r.position,
  });
  const novo = () => setEdit({
    nome_regiao: "", bairro: "", cidade: "", endereco: "", numero: "", ponto_referencia: "", horario: "",
    contato1: "", contato2: "", contato3: "", maps_url: "", atende_tambem: [], destaque: false, position: rows.length * 10,
  });

  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiPreview, setAiPreview] = useState<UnidadeDraft[]>([]);

  const generateFromAI = async () => {
    if (!aiInput.trim()) return;
    setAiGenerating(true);
    try {
      const prompt = `Você organiza uma lista de unidades do Cartão de Todos (loja/escritório para onde o cliente pode ir), a partir de texto livre enviado por um administrador.
Extraia cada unidade mencionada e devolva um array JSON, um objeto por item, no formato exato:
[{"nome_regiao": "...", "endereco": "...", "numero": "...", "bairro": "...", "cidade": "...", "horario": "...", "contato1": "...", "contato2": "...", "contato3": "..."}]

Regras:
- "nome_regiao": nome da unidade (ex: "Cartão de Todos Justinópolis").
- "endereco": nome da rua/avenida, SEM o número. Use "" se não houver.
- "numero": só o número do endereço. Use "" se não houver.
- "bairro" e "cidade": só se o texto disser explicitamente o bairro/cidade. Use "" se não tiver certeza — NUNCA invente.
- "horario": horário de atendimento, só se mencionado. Use "" se não houver.
- "contato1", "contato2", "contato3": até 3 telefones/whatsapp mencionados, um em cada campo. Use "" para os que não existirem.
- Responda APENAS com o array JSON, sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: aiInput }], model: ADMIN_ASSISTANT_MODEL } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: UnidadeDraft[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({ nome_regiao: it.nome_regiao || "", endereco: it.endereco || "", numero: it.numero || "", bairro: it.bairro || "", cidade: it.cidade || "", horario: it.horario || "", contato1: it.contato1 || "", contato2: it.contato2 || "", contato3: it.contato3 || "", selected: true }))
        .filter((it: UnidadeDraft) => it.nome_regiao);
      if (items.length === 0) { toast.error("A IA não conseguiu identificar nenhuma unidade no texto enviado."); return; }
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
        await upsert({ data: {
          tipo: "cartao_de_todos", nome_regiao: item.nome_regiao, endereco: item.endereco || null, numero: item.numero || null,
          bairro: item.bairro || null, cidade: item.cidade || null, horario: item.horario || null,
          contato1: item.contato1 || null, contato2: item.contato2 || null, contato3: item.contato3 || null, destaque: false, position: 0,
        } });
      }
      toast.success(`${toImport.length} unidade(s) importada(s)!`);
      qc.invalidateQueries({ queryKey: ["contatos"] });
      setAiOpen(false); setAiInput(""); setAiPreview([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setAiImporting(false);
    }
  };

  // Organizar com IA: só padroniza o que já existe (nome/endereço/telefones). Não mexe em
  // bairro/cidade/horário/Maps/atende também — esses campos não são tocados por ela.
  type OrganizeProposal = { id: string; nome_regiao: string; endereco: string; numero: string; contato1: string; contato2: string; contato3: string; selected: boolean; original: Row };
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [organizeApplying, setOrganizeApplying] = useState(false);
  const [organizeProposals, setOrganizeProposals] = useState<OrganizeProposal[]>([]);

  const organizarComIA = async () => {
    if (rows.length === 0) { toast.error("Nenhuma unidade cadastrada ainda."); return; }
    setOrganizeOpen(true);
    setOrganizing(true);
    try {
      const linhasTexto = rows.map((r) => `${r.id} :: ${r.nome_regiao} :: ${r.endereco ?? ""} :: ${r.numero ?? ""} :: ${r.contato1 ?? ""} :: ${r.contato2 ?? ""} :: ${r.contato3 ?? ""}`).join("\n");
      const prompt = `Você organiza e padroniza uma lista de unidades do Cartão de Todos JÁ CADASTRADAS, pra ficarem com nomenclatura e formato consistentes. NÃO invente nenhuma informação nova — só reorganize/padronize o que já existe.

Itens atuais (um por linha, formato "id :: nome_regiao :: endereco :: numero :: contato1 :: contato2 :: contato3"):
${linhasTexto}

Regras:
- "nome_regiao": mantenha o nome do lugar, só padronize a capitalização (Title Case), sempre no formato "Cartão de Todos <Bairro/Cidade>".
- Telefones: reformate cada um pro padrão "(DDD) XXXXX-XXXX" (celular) ou "(DDD) XXXX-XXXX" (fixo), mantendo o mesmo número. Campo vazio continua vazio.
- Se o endereço tiver um número embutido no meio do texto, separe em "endereco" (só a rua) e "numero". Se já estava separado, mantenha como está.
- Responda APENAS com um array JSON no formato exato: [{"id": "...", "nome_regiao": "...", "endereco": "...", "numero": "...", "contato1": "...", "contato2": "...", "contato3": "..."}]. Sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "user", content: prompt }], model: ADMIN_ASSISTANT_MODEL } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const proposals: OrganizeProposal[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => {
          const original = rows.find((r) => r.id === it.id);
          if (!original) return null;
          return {
            id: it.id, nome_regiao: it.nome_regiao || original.nome_regiao, endereco: it.endereco ?? (original.endereco ?? ""),
            numero: it.numero ?? (original.numero ?? ""), contato1: it.contato1 ?? (original.contato1 ?? ""),
            contato2: it.contato2 ?? (original.contato2 ?? ""), contato3: it.contato3 ?? (original.contato3 ?? ""),
            selected: true, original,
          };
        })
        .filter((p: OrganizeProposal | null): p is OrganizeProposal => !!p);
      if (proposals.length === 0) { toast.error("A IA não conseguiu organizar essas unidades."); setOrganizeOpen(false); return; }
      setOrganizeProposals(proposals);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao organizar com IA.");
      setOrganizeOpen(false);
    } finally {
      setOrganizing(false);
    }
  };

  const aplicarOrganizacao = async () => {
    const toApply = organizeProposals.filter((p) => p.selected);
    if (toApply.length === 0) return;
    setOrganizeApplying(true);
    try {
      for (const p of toApply) {
        await upsert({ data: { ...p.original, nome_regiao: p.nome_regiao, endereco: p.endereco || null, numero: p.numero || null, contato1: p.contato1 || null, contato2: p.contato2 || null, contato3: p.contato3 || null } });
      }
      toast.success(`${toApply.length} unidade(s) organizada(s)!`);
      qc.invalidateQueries({ queryKey: ["contatos"] });
      setOrganizeOpen(false); setOrganizeProposals([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar.");
    } finally {
      setOrganizeApplying(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Unidades CDT ({rows.length})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={organizarComIA}><Wand2 className="h-4 w-4" /> Organizar com IA</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" /> Preencher com IA</Button>
          <Button size="sm" className="gap-2" onClick={novo}><Plus className="h-4 w-4" /> Nova</Button>
        </div>
      </div>
      {isLoading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Bairro · Cidade</TableHead><TableHead>Destaque</TableHead><TableHead>Contatos</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome_regiao}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{[r.bairro, r.cidade].filter(Boolean).join(" · ") || "—"}</TableCell>
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
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma unidade cadastrada ainda.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar" : "Nova"} unidade CDT</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={edit.nome_regiao} onChange={(e) => setEdit({ ...edit, nome_regiao: e.target.value })} placeholder="Ex: Cartão de Todos Justinópolis" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Bairro</Label><Input value={edit.bairro} onChange={(e) => setEdit({ ...edit, bairro: e.target.value })} placeholder="Ex: Centro" /></div>
                <div><Label>Cidade</Label><Input value={edit.cidade} onChange={(e) => setEdit({ ...edit, cidade: e.target.value })} placeholder="Ex: Ribeirão das Neves" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label>Endereço</Label><Input value={edit.endereco} onChange={(e) => setEdit({ ...edit, endereco: e.target.value })} placeholder="Rua Exemplo" /></div>
                <div><Label>Número</Label><Input value={edit.numero} onChange={(e) => setEdit({ ...edit, numero: e.target.value })} placeholder="100" /></div>
              </div>
              <div><Label>Ponto de referência (opcional)</Label><Input value={edit.ponto_referencia} onChange={(e) => setEdit({ ...edit, ponto_referencia: e.target.value })} placeholder="Ex: em frente à praça da Matriz" /></div>
              <div><Label>Horário</Label><Input value={edit.horario} onChange={(e) => setEdit({ ...edit, horario: e.target.value })} placeholder="Ex: Seg a sex, 8h às 18h · Sáb, 8h às 12h" /></div>
              <div><Label>Telefone 1</Label><Input value={edit.contato1} onChange={(e) => setEdit({ ...edit, contato1: e.target.value })} placeholder="(31) 99999-0000" /></div>
              <div><Label>Telefone 2 (opcional)</Label><Input value={edit.contato2} onChange={(e) => setEdit({ ...edit, contato2: e.target.value })} /></div>
              <div><Label>Telefone 3 (opcional)</Label><Input value={edit.contato3} onChange={(e) => setEdit({ ...edit, contato3: e.target.value })} /></div>
              <div>
                <Label>Link do Google Maps (opcional)</Label>
                <Input value={edit.maps_url} onChange={(e) => setEdit({ ...edit, maps_url: e.target.value })} placeholder="Deixe vazio para gerar pelo endereço" />
              </div>
              <div>
                <Label>Atende também</Label>
                <TagsInput value={edit.atende_tambem} onChange={(v) => setEdit({ ...edit, atende_tambem: v })} placeholder="Digite uma cidade/bairro e Enter" />
              </div>
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
          <DialogHeader><DialogTitle>Preencher Unidades CDT com IA</DialogTitle></DialogHeader>
          {aiPreview.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cole a lista de unidades, endereços e telefones (pode ser texto corrido, bagunçado). A IA organiza.</p>
              <Textarea rows={12} value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={"Ex:\nCartão de Todos Justinópolis - Rua Exemplo, 100, bairro Centro, Ribeirão das Neves - (31) 99999-0000, atende seg a sex 8h-18h"} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Confira antes de importar. Dê prioridade a corrigir bairro/cidade, pois a IA só preenche quando tem certeza.</p>
              <Table>
                <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Nome</TableHead><TableHead>Bairro · Cidade</TableHead><TableHead>Endereço</TableHead><TableHead>Contatos</TableHead></TableRow></TableHeader>
                <TableBody>
                  {aiPreview.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell><input type="checkbox" checked={item.selected} onChange={(e) => setAiPreview((prev) => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))} /></TableCell>
                      <TableCell className="font-medium">{item.nome_regiao}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{[item.bairro, item.cidade].filter(Boolean).join(" · ") || "—"}</TableCell>
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
                <Button onClick={importSelected} disabled={aiImporting || aiPreview.every((p) => !p.selected)}>{aiImporting ? "Importando..." : `Importar ${aiPreview.filter((p) => p.selected).length} unidade(s)`}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={organizeOpen} onOpenChange={(v) => { setOrganizeOpen(v); if (!v) setOrganizeProposals([]); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Organizar Unidades CDT com IA</DialogTitle></DialogHeader>
          {organizing && <p className="text-sm text-muted-foreground py-6 text-center">Analisando as unidades cadastradas...</p>}
          {!organizing && organizeProposals.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Revise as mudanças propostas antes de aplicar — desmarque o que não quiser alterar.</p>
              <div className="space-y-2">
                {organizeProposals.map((p, idx) => (
                  <div key={p.id} className="flex gap-2 items-start p-2 rounded-md border border-border">
                    <input type="checkbox" checked={p.selected} className="mt-1.5"
                      onChange={(e) => setOrganizeProposals((prev) => prev.map((x, i) => i === idx ? { ...x, selected: e.target.checked } : x))} />
                    <div className="flex-1 text-sm grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span className="text-muted-foreground line-through">{p.original.nome_regiao}</span>
                      <span className="font-medium">{p.nome_regiao}</span>
                      <span className="text-muted-foreground line-through">{[p.original.endereco, p.original.numero].filter(Boolean).join(", ") || "—"}</span>
                      <span className="font-medium">{[p.endereco, p.numero].filter(Boolean).join(", ") || "—"}</span>
                      <span className="text-muted-foreground line-through">{[p.original.contato1, p.original.contato2, p.original.contato3].filter(Boolean).join(" · ") || "—"}</span>
                      <span className="font-medium">{[p.contato1, p.contato2, p.contato3].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!organizing && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOrganizeOpen(false)}>Cancelar</Button>
              <Button onClick={aplicarOrganizacao} disabled={organizeApplying || organizeProposals.every((p) => !p.selected)}>
                {organizeApplying ? "Aplicando..." : `Aplicar ${organizeProposals.filter((p) => p.selected).length} mudança(s)`}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// Suporte e setores (tipo = outros)
// ============================================================
type SuporteDraft = { nome_regiao: string; subtitulo: string; whatsapp: string; contato1: string; email: string; site: string; selected: boolean };

function SuporteSubTab() {
  const upsert = useServerFn(upsertContato);
  const del = useServerFn(deleteContato);
  const genAI = useServerFn(simulatorChat);
  const { rows, qc, isLoading } = useContatosRows("outros");

  const [edit, setEdit] = useState<null | {
    id?: string; nome_regiao: string; subtitulo: string; quando_indicar: string; whatsapp: string;
    contato1: string; contato2: string; contato3: string; email: string; site: string; horario: string; position: number;
  }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, tipo: "outros", nome_regiao: edit!.nome_regiao,
      subtitulo: edit!.subtitulo || null, quando_indicar: edit!.quando_indicar || null, whatsapp: edit!.whatsapp || null,
      contato1: edit!.contato1 || null, contato2: edit!.contato2 || null, contato3: edit!.contato3 || null,
      email: edit!.email || null, site: edit!.site || null, horario: edit!.horario || null,
      destaque: false, position: edit!.position,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["contatos"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["contatos"] }); },
  });

  const moveRow = async (idx: number, dir: -1 | 1) => {
    const arr = [...rows];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((r, i) => upsert({ data: { ...r, position: i * 10 } })));
    qc.invalidateQueries({ queryKey: ["contatos"] });
  };

  const openEdit = (r: Row) => setEdit({
    id: r.id, nome_regiao: r.nome_regiao, subtitulo: r.subtitulo ?? "", quando_indicar: r.quando_indicar ?? "",
    whatsapp: r.whatsapp ?? "", contato1: r.contato1 ?? "", contato2: r.contato2 ?? "", contato3: r.contato3 ?? "",
    email: r.email ?? "", site: r.site ?? "", horario: r.horario ?? "", position: r.position,
  });
  const novo = () => setEdit({
    nome_regiao: "", subtitulo: "", quando_indicar: "", whatsapp: "", contato1: "", contato2: "", contato3: "",
    email: "", site: "", horario: "", position: rows.length * 10,
  });

  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiPreview, setAiPreview] = useState<SuporteDraft[]>([]);

  const generateFromAI = async () => {
    if (!aiInput.trim()) return;
    setAiGenerating(true);
    try {
      const prompt = `Você organiza uma lista de suportes e setores do Cartão de Todos (produtos/áreas que o cliente resolve direto com outra equipe — ex: Ouvidoria, Refuturiza, Energia de TODOS), a partir de texto livre enviado por um administrador.
Extraia cada suporte mencionado e devolva um array JSON, um objeto por item, no formato exato:
[{"nome_regiao": "...", "subtitulo": "...", "quando_indicar": "...", "whatsapp": "...", "contato1": "...", "email": "...", "site": "..."}]

Regras:
- "nome_regiao": nome do suporte/produto (ex: "Refuturiza", "Ouvidoria Cartão de TODOS").
- "subtitulo": linha curta do que resolve (ex: "Cursos online · acesso e certificados"). Use "" se não houver.
- "quando_indicar": quando o atendente deve indicar esse suporte, só se o texto disser. Use "" se não houver.
- "whatsapp", "contato1" (telefone), "email", "site": só o que estiver explícito no texto. Use "" para o que não existir.
- Responda APENAS com o array JSON, sem markdown, sem texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: aiInput }], model: ADMIN_ASSISTANT_MODEL } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: SuporteDraft[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({ nome_regiao: it.nome_regiao || "", subtitulo: it.subtitulo || "", whatsapp: it.whatsapp || "", contato1: it.contato1 || "", email: it.email || "", site: it.site || "", selected: true }))
        .filter((it: SuporteDraft) => it.nome_regiao);
      if (items.length === 0) { toast.error("A IA não conseguiu identificar nenhum suporte no texto enviado."); return; }
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
        await upsert({ data: {
          tipo: "outros", nome_regiao: item.nome_regiao, subtitulo: item.subtitulo || null, whatsapp: item.whatsapp || null,
          contato1: item.contato1 || null, email: item.email || null, site: item.site || null, destaque: false, position: 0,
        } });
      }
      toast.success(`${toImport.length} suporte(s) importado(s)!`);
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
        <h3 className="font-semibold">Suporte e setores ({rows.length})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" /> Preencher com IA</Button>
          <Button size="sm" className="gap-2" onClick={novo}><Plus className="h-4 w-4" /> Novo</Button>
        </div>
      </div>
      {isLoading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Subtítulo</TableHead><TableHead>Contatos</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome_regiao}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.subtitulo || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{[r.whatsapp, r.contato1, r.contato2, r.contato3].filter(Boolean).join(" · ") || "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => moveRow(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === rows.length - 1} onClick={() => moveRow(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum suporte cadastrado ainda.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar" : "Novo"} suporte</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Nome (produto/setor)</Label><Input value={edit.nome_regiao} onChange={(e) => setEdit({ ...edit, nome_regiao: e.target.value })} placeholder="Ex: Refuturiza" /></div>
              <div><Label>Subtítulo</Label><Input value={edit.subtitulo} onChange={(e) => setEdit({ ...edit, subtitulo: e.target.value })} placeholder="Ex: Cursos online · acesso e certificados" /></div>
              <div><Label>Quando indicar</Label><Textarea rows={2} value={edit.quando_indicar} onChange={(e) => setEdit({ ...edit, quando_indicar: e.target.value })} placeholder="Ex: cliente não consegue acessar a plataforma, esqueceu a senha..." /></div>
              <div><Label>WhatsApp</Label><Input value={edit.whatsapp} onChange={(e) => setEdit({ ...edit, whatsapp: e.target.value })} placeholder="(31) 99999-0000" /></div>
              <div><Label>Telefone 1</Label><Input value={edit.contato1} onChange={(e) => setEdit({ ...edit, contato1: e.target.value })} /></div>
              <div><Label>Telefone 2 (opcional)</Label><Input value={edit.contato2} onChange={(e) => setEdit({ ...edit, contato2: e.target.value })} /></div>
              <div><Label>Telefone 3 (opcional)</Label><Input value={edit.contato3} onChange={(e) => setEdit({ ...edit, contato3: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="suporte@exemplo.com.br" /></div>
              <div><Label>Site</Label><Input value={edit.site} onChange={(e) => setEdit({ ...edit, site: e.target.value })} placeholder="exemplo.com.br/ajuda" /></div>
              <div><Label>Horário</Label><Input value={edit.horario} onChange={(e) => setEdit({ ...edit, horario: e.target.value })} placeholder="Ex: Seg a sex, 8h às 18h" /></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={(v) => { setAiOpen(v); if (!v) { setAiPreview([]); setAiInput(""); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preencher Suporte e setores com IA</DialogTitle></DialogHeader>
          {aiPreview.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cole a lista de suportes, com o que cada um resolve e os contatos (pode ser texto corrido).</p>
              <Textarea rows={12} value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={"Ex:\nRefuturiza - cursos online, acesso e certificados - WhatsApp (31) 90000-0000 - suporte@refuturiza.com.br"} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Confira antes de importar.</p>
              <Table>
                <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Nome</TableHead><TableHead>Subtítulo</TableHead><TableHead>Contatos</TableHead></TableRow></TableHeader>
                <TableBody>
                  {aiPreview.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell><input type="checkbox" checked={item.selected} onChange={(e) => setAiPreview((prev) => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))} /></TableCell>
                      <TableCell className="font-medium">{item.nome_regiao}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.subtitulo || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{[item.whatsapp, item.contato1].filter(Boolean).join(" · ") || "—"}</TableCell>
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
                <Button onClick={importSelected} disabled={aiImporting || aiPreview.every((p) => !p.selected)}>{aiImporting ? "Importando..." : `Importar ${aiPreview.filter((p) => p.selected).length} suporte(s)`}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
