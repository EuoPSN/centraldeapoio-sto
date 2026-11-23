import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AdminListDetail } from "@/components/admin/AdminListDetail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  criarDuvidaDaPergunta, deleteDuvida, getMaisPerguntadas, listDuvidas, upsertDuvida,
} from "@/lib/duvidas.functions";
import { TEMAS_PADRAO } from "@/lib/duvidas";
import { matches } from "@/components/amor-saude/model";
import type { Duvida } from "@/components/amor-saude/useDuvidas";
import { cn } from "@/lib/utils";

interface Edit { id?: string; tema: string; pergunta: string; resposta: string; publicada: boolean; origem: "manual" | "marciana"; position: number }
const NOVA: Edit = { tema: "Planos", pergunta: "", resposta: "", publicada: false, origem: "manual", position: 1000 };
const daDuvida = (d: Duvida): Edit => ({ id: d.id, tema: d.tema, pergunta: d.pergunta, resposta: d.resposta, publicada: d.status === "publicada", origem: d.origem, position: d.position });

export function DuvidasAdminTab() {
  const list = useServerFn(listDuvidas);
  const upsert = useServerFn(upsertDuvida);
  const del = useServerFn(deleteDuvida);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["duvidas-admin"], queryFn: () => list({}) });
  const duvidas = (q.data ?? []) as Duvida[];

  const [status, setStatus] = useState<"todas" | "rascunho" | "publicada">("todas");
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);

  const temas = useMemo(() => [...new Set([...TEMAS_PADRAO, ...duvidas.map((d) => d.tema)])], [duvidas]);
  const visiveis = useMemo(
    () => duvidas.filter((d) => (status === "todas" || d.status === status) && matches(busca, d.pergunta, d.resposta, d.tema)),
    [duvidas, status, busca],
  );
  const nRascunho = duvidas.filter((d) => d.status === "rascunho").length;
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["duvidas-admin"] });
    qc.invalidateQueries({ queryKey: ["duvidas"] });
    qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
  };

  const salvar = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, tema: edit!.tema, pergunta: edit!.pergunta, resposta: edit!.resposta,
      status: edit!.publicada ? "publicada" : "rascunho", origem: edit!.origem, position: edit!.position,
    } }),
    onSuccess: (r) => {
      toast.success(edit?.publicada ? "Salvo e publicada. Para a MarcIAna usar, reindexe a Base IA." : "Salvo como rascunho.");
      recarregar();
      setEdit(daDuvida(r as unknown as Duvida));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removida."); setEdit(null); recarregar(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });

  return (
    <AdminListDetail
      title="Dúvidas frequentes"
      subtitle={nRascunho > 0 ? `${nRascunho} em rascunho esperando a sua revisão. Só as publicadas aparecem para a equipe.` : "Só as publicadas aparecem para a equipe."}
      actions={<Button size="sm" className="gap-1" onClick={() => setEdit({ ...NOVA })}><Plus className="h-4 w-4" /> Nova dúvida</Button>}
      belowHeader={<MaisPerguntadas aoCriar={(d) => { recarregar(); setEdit(daDuvida(d)); }} />}
      filters={(["todas", "rascunho", "publicada"] as const).map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={status === f}
          onClick={() => setStatus(f)}
          className={cn("h-8 rounded-full border px-3 text-[13px] font-medium", status === f ? "border-ink bg-ink text-surface" : "border-line-strong text-ink hover:bg-surface-2")}
        >
          {f === "todas" ? "Todas" : f === "rascunho" ? `Rascunhos (${nRascunho})` : "Publicadas"}
        </button>
      ))}
      search={busca}
      onSearch={setBusca}
      panel={
        edit ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }}>
            <h3 className="text-lg font-semibold">{edit.id ? "Editar dúvida" : "Nova dúvida"}</h3>
            {edit.origem === "marciana" && <p className="text-xs text-muted-foreground">Veio das perguntas à MarcIAna. Escreva a resposta e publique.</p>}
            <div>
              <Label>Tema</Label>
              <Input list="duvidas-temas" required value={edit.tema} onChange={(e) => setEdit({ ...edit, tema: e.target.value })} />
              <datalist id="duvidas-temas">{temas.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div><Label>Pergunta</Label><Input required value={edit.pergunta} onChange={(e) => setEdit({ ...edit, pergunta: e.target.value })} /></div>
            <div><Label>Resposta</Label><Textarea rows={8} value={edit.resposta} onChange={(e) => setEdit({ ...edit, resposta: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={edit.publicada} onCheckedChange={(v) => setEdit({ ...edit, publicada: v })} />
              Publicada (aparece para a equipe e para a MarcIAna)
            </label>
            {edit.publicada && !edit.resposta.trim() && <p role="alert" className="text-xs text-destructive">Escreva a resposta antes de publicar.</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={salvar.isPending || (edit.publicada && !edit.resposta.trim())}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>Fechar</Button>
              {edit.id && <Button type="button" variant="ghost" className="ml-auto text-destructive" onClick={() => confirm(`Excluir "${edit.pergunta}"? Não dá para desfazer.`) && excluir.mutate(edit.id!)}>Excluir</Button>}
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Escolha uma dúvida na lista para editar ou publicar. As do seed entram como rascunho: confira cada resposta antes de publicar.</p>
        )
      }
    >
      {q.isLoading ? <p className="py-6 text-sm text-muted-foreground">Carregando…</p> : visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted-foreground">Nenhuma dúvida neste filtro.</p>
      ) : (
        <ul>
          {visiveis.map((d) => (
            <li key={d.id} className={cn("border-b border-line", edit?.id === d.id && "bg-sidebar")}>
              <button type="button" onClick={() => setEdit(daDuvida(d))} className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-sidebar/60">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.pergunta}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{d.tema}</span>
                {d.status === "publicada"
                  ? <Badge variant="secondary">Publicada · {d.copias_count} cópias</Badge>
                  : <Badge variant="outline" className="border-warning text-warning">Rascunho</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </AdminListDetail>
  );
}

function MaisPerguntadas({ aoCriar }: { aoCriar: (d: Duvida) => void }) {
  const fn = useServerFn(getMaisPerguntadas);
  const criar = useServerFn(criarDuvidaDaPergunta);
  const q = useQuery({ queryKey: ["mais-perguntadas"], queryFn: () => fn({}), retry: false, staleTime: 5 * 60_000 });
  const virar = useMutation({
    mutationFn: (pergunta: string) => criar({ data: { pergunta } }),
    onSuccess: (r) => {
      toast.success((r as { jaExistia?: boolean }).jaExistia ? "Essa pergunta já está na lista." : "Rascunho criado. Escreva a resposta ao lado.");
      aoCriar(r as unknown as Duvida);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar."),
  });
  const d = q.data;
  return (
    <Card className="space-y-3 p-4" data-tour="duvidas-admin-1">
      <div>
        <h3 className="font-semibold">Mais perguntadas à MarcIAna · últimos 30 dias</h3>
        <p className="text-xs text-muted-foreground">
          Só entram perguntas iguais feitas por 2 pessoas ou mais, sem telefone, CPF, e-mail nem número. Perguntas parecidas, mas escritas de outro jeito, não são juntadas.
        </p>
      </div>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : q.isError ? (
        <p className="text-sm text-muted-foreground">Não consegui ler as perguntas agora.</p>
      ) : d && (
        <>
          {d.perguntas.length > 0 ? (
            <ul className="divide-y divide-line">
              {d.perguntas.map((p) => <Linha key={p.pergunta} texto={p.pergunta} nota={`${p.vezes}× · ${p.pessoas} pessoas`} ocupado={virar.isPending} onVirar={() => virar.mutate(p.pergunta)} />)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nenhuma pergunta repetida por 2 pessoas ou mais neste período.</p>}
          {d.sugestoes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugestões na tela da MarcIAna</p>
              <ul className="divide-y divide-line">
                {d.sugestoes.map((s) => <Linha key={s.id} texto={s.texto} ocupado={virar.isPending} onVirar={() => virar.mutate(s.texto)} />)}
              </ul>
            </div>
          )}
          {d.naoUteis > 0 && (
            <p className="text-sm text-muted-foreground">
              👎 {d.naoUteis} resposta(s) marcadas como não úteis.{d.motivos.length > 0 && <> Motivos mais citados: {d.motivos.map((m) => `${m.motivo} (${m.vezes})`).join(", ")}.</>}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function Linha({ texto, nota, onVirar, ocupado }: { texto: string; nota?: string; onVirar: () => void; ocupado: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm" title={texto}>{texto}</span>
      {nota && <span className="shrink-0 text-xs text-muted-foreground">{nota}</span>}
      <Button size="sm" variant="outline" disabled={ocupado} onClick={onVirar}>Virar dúvida frequente</Button>
    </li>
  );
}
