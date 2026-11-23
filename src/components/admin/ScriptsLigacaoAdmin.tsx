import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AdminListDetail } from "@/components/admin/AdminListDetail";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteRoteiroLigacao, getRecursos, listRoteirosLigacao, setRecursoLigacao, upsertRoteiroLigacao } from "@/lib/roteiros.functions";
import { ETAPAS_LIGACAO } from "@/lib/roteiros";
import { matches } from "@/components/amor-saude/model";
import { cn } from "@/lib/utils";

type Etapa = (typeof ETAPAS_LIGACAO)[number];
interface Linha { id: string; titulo: string; etapa: Etapa; situacao: string; texto: string; dicas: string[]; status: "rascunho" | "publicada"; position: number }
interface Edit { id?: string; titulo: string; etapa: Etapa; situacao: string; texto: string; dicas: string; publicada: boolean; position: number }
const NOVO: Edit = { titulo: "", etapa: "Abertura", situacao: "", texto: "", dicas: "", publicada: false, position: 1000 };
const daLinha = (r: Linha): Edit => ({ id: r.id, titulo: r.titulo, etapa: r.etapa, situacao: r.situacao, texto: r.texto, dicas: (r.dicas ?? []).join("\n"), publicada: r.status === "publicada", position: r.position });

export function ScriptsLigacaoAdminTab() {
  const list = useServerFn(listRoteirosLigacao);
  const upsert = useServerFn(upsertRoteiroLigacao);
  const del = useServerFn(deleteRoteiroLigacao);
  const recFn = useServerFn(getRecursos);
  const setRec = useServerFn(setRecursoLigacao);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["roteiros-ligacao-admin"], queryFn: () => list({}) });
  const rec = useQuery({ queryKey: ["recursos"], queryFn: () => recFn({}) });
  const linhas = (q.data ?? []) as Linha[];
  const liberado = rec.data?.scripts_ligacao_liberado ?? false;

  const [etapa, setEtapa] = useState<"Todas" | Etapa>("Todas");
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [confirmar, setConfirmar] = useState<null | boolean>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  const visiveis = useMemo(
    () => linhas.filter((l) => (etapa === "Todas" || l.etapa === etapa) && matches(busca, l.titulo, l.texto, l.etapa)),
    [linhas, etapa, busca],
  );
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["roteiros-ligacao-admin"] });
    qc.invalidateQueries({ queryKey: ["roteiros-ligacao"] });
  };

  const salvar = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, titulo: edit!.titulo, etapa: edit!.etapa, situacao: edit!.situacao, texto: edit!.texto,
      dicas: edit!.dicas.split("\n").map((l) => l.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean),
      status: edit!.publicada ? "publicada" : "rascunho", position: edit!.position,
    } }),
    onSuccess: (r) => { toast.success(edit?.publicada ? "Salvo e publicado." : "Salvo como rascunho."); recarregar(); setEdit(daLinha(r as unknown as Linha)); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); setEdit(null); recarregar(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });
  const liberar = useMutation({
    mutationFn: (v: boolean) => setRec({ data: { liberado: v } }),
    onSuccess: (_r, v) => {
      toast.success(v ? "Liberado: os atendentes já veem a página." : "Desligado: os atendentes voltam a ver \"Em breve\".");
      setConfirmar(null);
      qc.invalidateQueries({ queryKey: ["recursos"] });
    },
    onError: (e) => { setConfirmar(null); toast.error(e instanceof Error ? e.message : "Não foi possível mudar."); },
  });
  const inserir = (marca: string) => {
    if (!edit) return;
    const el = ta.current;
    const a = el?.selectionStart ?? edit.texto.length;
    const b = el?.selectionEnd ?? a;
    setEdit({ ...edit, texto: edit.texto.slice(0, a) + marca + edit.texto.slice(b) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + marca.length, a + marca.length); });
  };

  return (
    <AdminListDetail
      title="Scripts de ligação"
      subtitle="O roteiro da ligação, por etapa. A equipe só vê depois que você liberar."
      actions={<Button size="sm" className="gap-1" onClick={() => setEdit({ ...NOVO })}><Plus className="h-4 w-4" /> Novo roteiro</Button>}
      belowHeader={
        <Card className="flex flex-wrap items-center gap-4 p-4">
          <Switch id="liberar-ligacao" checked={liberado} disabled={rec.isLoading || liberar.isPending} onCheckedChange={(v) => setConfirmar(v)} aria-describedby="liberar-ligacao-desc" />
          <div className="min-w-0 flex-1">
            <Label htmlFor="liberar-ligacao" className="text-sm font-semibold">Liberar para a equipe</Label>
            <p id="liberar-ligacao-desc" className="text-xs text-muted-foreground">
              {liberado ? "Ligado: os atendentes veem a página Scripts de ligação." : 'Desligado: os atendentes veem "Em breve". Só você vê, com o selo "Só você vê".'}
            </p>
          </div>
          <Badge variant={liberado ? "secondary" : "outline"}>{liberado ? "Liberado" : "Só você vê"}</Badge>
        </Card>
      }
      filters={(["Todas", ...ETAPAS_LIGACAO] as const).map((e) => (
        <button key={e} type="button" aria-pressed={etapa === e} onClick={() => setEtapa(e)}
          className={cn("h-8 rounded-full border px-3 text-[13px] font-medium", etapa === e ? "border-ink bg-ink text-surface" : "border-line-strong text-ink hover:bg-surface-2")}>{e}</button>
      ))}
      search={busca}
      onSearch={setBusca}
      panel={
        edit ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }}>
            <h3 className="text-lg font-semibold">{edit.id ? "Editar roteiro" : "Novo roteiro"}</h3>
            <div><Label>Título</Label><Input required value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></div>
            <div>
              <Label>Etapa da ligação</Label>
              <Select value={edit.etapa} onValueChange={(v) => setEdit({ ...edit, etapa: v as Etapa })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ETAPAS_LIGACAO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Situação (quando usar)</Label><Textarea rows={2} value={edit.situacao} onChange={(e) => setEdit({ ...edit, situacao: e.target.value })} /></div>
            <div>
              <Label>O que falar</Label>
              <div className="mb-1 flex flex-wrap gap-1.5">
                {["[nome]", "[seu nome]", "(pausa curta)", "(sorria)"].map((m) => (
                  <Button key={m} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => inserir(m)}>{m}</Button>
                ))}
              </div>
              <Textarea ref={ta} rows={9} value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} />
            </div>
            <div><Label>Dicas da ligação (uma por linha)</Label><Textarea rows={4} value={edit.dicas} onChange={(e) => setEdit({ ...edit, dicas: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={edit.publicada} onCheckedChange={(v) => setEdit({ ...edit, publicada: v })} /> Publicado (a equipe vê quando a página estiver liberada)
            </label>
            {edit.publicada && !edit.texto.trim() && <p role="alert" className="text-xs text-destructive">Escreva o texto antes de publicar.</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={salvar.isPending || (edit.publicada && !edit.texto.trim())}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>Fechar</Button>
              {edit.id && <Button type="button" variant="ghost" className="ml-auto text-destructive" onClick={() => confirm(`Excluir "${edit.titulo}"? Não dá para desfazer.`) && excluir.mutate(edit.id!)}>Excluir</Button>}
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Escolha um roteiro para editar. Os cinco de exemplo (um por etapa) estão em rascunho: reescreva e publique.</p>
        )
      }
    >
      {q.isLoading ? <p className="py-6 text-sm text-muted-foreground">Carregando…</p> : visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted-foreground">{linhas.length === 0 ? 'Nenhum roteiro ainda. Use "Novo roteiro".' : "Nenhum roteiro neste filtro."}</p>
      ) : (
        <ul>
          {visiveis.map((r) => (
            <li key={r.id} className={cn("border-b border-line", edit?.id === r.id && "bg-sidebar")}>
              <button type="button" onClick={() => setEdit(daLinha(r))} className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-sidebar/60">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.titulo}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.etapa}</span>
                {r.status === "publicada" ? <Badge variant="secondary">Publicado</Badge> : <Badge variant="outline" className="border-warning text-warning">Rascunho</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={confirmar !== null} onOpenChange={(v) => { if (!v && !liberar.isPending) setConfirmar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar ? "Liberar para a equipe?" : "Desligar para a equipe?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar
                ? "Os atendentes passam a ver esta página. Confira se os roteiros publicados estão como você quer."
                : 'Os atendentes deixam de ver esta página e voltam a ver "Em breve". Só você continua vendo.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={liberar.isPending}>Cancelar</AlertDialogCancel>
            <Button onClick={() => liberar.mutate(!!confirmar)} disabled={liberar.isPending}>{liberar.isPending ? "Salvando…" : confirmar ? "Liberar" : "Desligar"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminListDetail>
  );
}
