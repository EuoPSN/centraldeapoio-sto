import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listHomepageMessages, upsertHomepageMessage, deleteHomepageMessage } from "@/lib/homepage.functions";
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
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

type Fonte = "padrao" | "arredondada" | "elegante" | "festiva";
type Tipo = "padrao" | "data_especial" | "aniversario";

interface MessageRow {
  id: string; titulo: string; subtitulo: string | null; cor_fundo: string; cor_fundo_2: string | null; fonte: Fonte; tipo: Tipo;
  data_inicio: string | null; data_fim: string | null; ativo: boolean; position: number;
}

const FONTE_LABELS: Record<Fonte, string> = { padrao: "Padrão", arredondada: "Arredondada", elegante: "Elegante", festiva: "Festiva" };
const TIPO_LABELS: Record<Tipo, string> = { padrao: "Padrão (rotaciona)", data_especial: "Data especial", aniversario: "Aniversário" };

export function HomepageMessagesTab() {
  const list = useServerFn(listHomepageMessages);
  const upsert = useServerFn(upsertHomepageMessage);
  const del = useServerFn(deleteHomepageMessage);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["homepage-messages"], queryFn: () => list({}) });
  const messages = (q.data ?? []) as MessageRow[];

  const [edit, setEdit] = useState<null | {
    id?: string; titulo: string; subtitulo: string; cor_fundo: string; cor_fundo_2: string; fonte: Fonte; tipo: Tipo;
    data_inicio: string; data_fim: string; ativo: boolean;
  }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, titulo: edit!.titulo, subtitulo: edit!.subtitulo || null,
      cor_fundo: edit!.cor_fundo, cor_fundo_2: edit!.cor_fundo_2 || null, fonte: edit!.fonte, tipo: edit!.tipo,
      data_inicio: edit!.tipo === "data_especial" ? (edit!.data_inicio || null) : null,
      data_fim: edit!.tipo === "data_especial" ? (edit!.data_fim || null) : null,
      ativo: edit!.ativo, position: 0,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["homepage-messages"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removida."); qc.invalidateQueries({ queryKey: ["homepage-messages"] }); },
  });
  const toggleAtivo = (m: MessageRow) => upsert({ data: { ...m, ativo: !m.ativo } }).then(() => qc.invalidateQueries({ queryKey: ["homepage-messages"] }));

  const openEdit = (m: MessageRow) => {
    setEdit({
      id: m.id, titulo: m.titulo, subtitulo: m.subtitulo ?? "", cor_fundo: m.cor_fundo, cor_fundo_2: m.cor_fundo_2 ?? "", fonte: m.fonte, tipo: m.tipo,
      data_inicio: m.data_inicio ?? "", data_fim: m.data_fim ?? "", ativo: m.ativo,
    });
  };

  const moveMessage = async (idx: number, dir: -1 | 1) => {
    const padroes = messages.filter((m) => m.tipo === "padrao").sort((a, b) => a.position - b.position);
    const arr = [...padroes];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((m, i) => upsert({ data: { ...m, position: i * 10 } })));
    qc.invalidateQueries({ queryKey: ["homepage-messages"] });
  };

  const padroes = messages.filter((m) => m.tipo === "padrao").sort((a, b) => a.position - b.position);
  const outras = messages.filter((m) => m.tipo !== "padrao");

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Mensagens da Tela Inicial ({messages.length})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ titulo: "", subtitulo: "", cor_fundo: "#F1F5F9", cor_fundo_2: "", fonte: "padrao", tipo: "padrao", data_inicio: "", data_fim: "", ativo: true })}>
          <Plus className="h-4 w-4" /> Nova mensagem
        </Button>
      </div>
      <div className="p-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Padrão (rotaciona automaticamente por dia)</p>
        <Table>
          <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Cor</TableHead><TableHead>Fonte</TableHead><TableHead>Ativa</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {padroes.map((m, idx) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.titulo}</TableCell>
                <TableCell><span className="inline-block h-4 w-4 rounded-full border border-border align-middle" style={{ background: m.cor_fundo_2 ? `linear-gradient(135deg, ${m.cor_fundo}, ${m.cor_fundo_2})` : m.cor_fundo }} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{FONTE_LABELS[m.fonte]}</TableCell>
                <TableCell><Switch checked={m.ativo} onCheckedChange={() => toggleAtivo(m)} /></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => moveMessage(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === padroes.length - 1} onClick={() => moveMessage(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {padroes.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma mensagem padrão cadastrada.</TableCell></TableRow>}
          </TableBody>
        </Table>

        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-3">Datas especiais e aniversário</p>
        <Table>
          <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Tipo</TableHead><TableHead>Período</TableHead><TableHead>Ativa</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {outras.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.titulo}</TableCell>
                <TableCell><Badge variant="secondary">{TIPO_LABELS[m.tipo]}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.tipo === "data_especial" ? `${m.data_inicio} a ${m.data_fim}` : "—"}</TableCell>
                <TableCell><Switch checked={m.ativo} onCheckedChange={() => toggleAtivo(m)} /></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {outras.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma cadastrada ainda.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar mensagem" : "Nova mensagem"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={edit.tipo} onValueChange={(v) => setEdit({ ...edit, tipo: v as Tipo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão (entra na rotação diária)</SelectItem>
                    <SelectItem value="data_especial">Data especial (ex: Natal, Ano Novo)</SelectItem>
                    <SelectItem value="aniversario">Aniversário (só pra quem faz aniversário)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Título</Label><Input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></div>
              <div><Label>Subtítulo (opcional)</Label><Textarea rows={2} value={edit.subtitulo} onChange={(e) => setEdit({ ...edit, subtitulo: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cor de fundo</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={edit.cor_fundo} onChange={(e) => setEdit({ ...edit, cor_fundo: e.target.value })} className="w-14 p-1 h-9" />
                    <Input value={edit.cor_fundo} onChange={(e) => setEdit({ ...edit, cor_fundo: e.target.value })} placeholder="#F1F5F9" />
                  </div>
                </div>
                <div>
                  <Label>2ª cor (opcional — vira gradiente)</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={edit.cor_fundo_2 || "#F1F5F9"} onChange={(e) => setEdit({ ...edit, cor_fundo_2: e.target.value })} className="w-14 p-1 h-9" />
                    <Input value={edit.cor_fundo_2} onChange={(e) => setEdit({ ...edit, cor_fundo_2: e.target.value })} placeholder="Deixe vazio p/ cor sólida" />
                  </div>
                </div>
                <div>
                  <Label>Fonte</Label>
                  <Select value={edit.fonte} onValueChange={(v) => setEdit({ ...edit, fonte: v as Fonte })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FONTE_LABELS) as Fonte[]).map((f) => <SelectItem key={f} value={f}>{FONTE_LABELS[f]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {edit.tipo === "data_especial" && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início (MM-DD)</Label><Input value={edit.data_inicio} onChange={(e) => setEdit({ ...edit, data_inicio: e.target.value })} placeholder="12-20" /></div>
                  <div><Label>Fim (MM-DD)</Label><Input value={edit.data_fim} onChange={(e) => setEdit({ ...edit, data_fim: e.target.value })} placeholder="12-26" /></div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
                <Label className="!mt-0">Ativa</Label>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
