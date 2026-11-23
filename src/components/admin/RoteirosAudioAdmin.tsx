import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AdminListDetail } from "@/components/admin/AdminListDetail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AudioPlayer } from "@/components/scripts/AudioPlayer";
import { supabase } from "@/integrations/supabase/client";
import { deleteRoteiroAudio, listRoteirosAudio, upsertRoteiroAudio } from "@/lib/roteiros.functions";
import { CATEGORIAS_AUDIO, erroDoArquivoDeAudio, nomeSeguroDeArquivo } from "@/lib/roteiros";
import { matches } from "@/components/amor-saude/model";
import { cn } from "@/lib/utils";

interface Linha { id: string; titulo: string; categoria: string; situacao: string; texto: string; dicas: string[]; audio_url: string | null; duracao: string | null; status: "rascunho" | "publicada"; position: number }
interface Edit { id?: string; titulo: string; categoria: string; situacao: string; texto: string; dicas: string; audio_url: string | null; duracao: string; publicada: boolean; position: number }
const NOVO: Edit = { titulo: "", categoria: "Retomada", situacao: "", texto: "", dicas: "", audio_url: null, duracao: "", publicada: false, position: 1000 };
const daLinha = (r: Linha): Edit => ({ id: r.id, titulo: r.titulo, categoria: r.categoria, situacao: r.situacao, texto: r.texto, dicas: (r.dicas ?? []).join("\n"), audio_url: r.audio_url, duracao: r.duracao ?? "", publicada: r.status === "publicada", position: r.position });
const BUCKET = "roteiros-audio";

export function RoteirosAudioAdminTab() {
  const list = useServerFn(listRoteirosAudio);
  const upsert = useServerFn(upsertRoteiroAudio);
  const del = useServerFn(deleteRoteiroAudio);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["roteiros-audio-admin"], queryFn: () => list({}) });
  const linhas = (q.data?.roteiros ?? []) as Linha[];
  const nCadencia = (q.data?.cadencia ?? []).length;

  const [cat, setCat] = useState("Todas");
  const [status, setStatus] = useState<"todos" | "rascunho" | "publicada">("todos");
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [subindo, setSubindo] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  const categorias = useMemo(() => [...new Set([...CATEGORIAS_AUDIO, ...linhas.map((l) => l.categoria)])], [linhas]);
  const visiveis = useMemo(
    () => linhas.filter((l) => (cat === "Todas" || l.categoria === cat) && (status === "todos" || l.status === status) && matches(busca, l.titulo, l.texto, l.categoria)),
    [linhas, cat, status, busca],
  );
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["roteiros-audio-admin"] });
    qc.invalidateQueries({ queryKey: ["roteiros-audio"] });
  };

  const salvar = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id, titulo: edit!.titulo, categoria: edit!.categoria, situacao: edit!.situacao, texto: edit!.texto,
      dicas: edit!.dicas.split("\n").map((l) => l.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean),
      audio_url: edit!.audio_url, duracao: edit!.duracao, status: edit!.publicada ? "publicada" : "rascunho", position: edit!.position,
    } }),
    onSuccess: (r) => { toast.success(edit?.publicada ? "Salvo e publicado." : "Salvo como rascunho."); recarregar(); setEdit(daLinha(r as unknown as Linha)); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); setEdit(null); recarregar(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });

  const enviarAudio = async (f: File) => {
    if (!edit) return;
    const erro = erroDoArquivoDeAudio(f);
    if (erro) return toast.error(erro);
    setSubindo(true);
    try {
      const path = `${edit.id ?? "novo"}/${Date.now()}-${nomeSeguroDeArquivo(f.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined });
      if (error) throw error;
      setEdit({ ...edit, audio_url: path });
      toast.success("Áudio enviado. Clique em Salvar para aplicar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o áudio.");
    } finally {
      setSubindo(false);
    }
  };
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
      title="Roteiros de áudio"
      subtitle={`O texto de como falar e um áudio de exemplo. ${nCadencia > 0 ? `${nCadencia} áudio(s) da cadência de retomada aparecem para a equipe automaticamente (edite em Retomada).` : ""}`}
      actions={<Button size="sm" className="gap-1" onClick={() => setEdit({ ...NOVO })}><Plus className="h-4 w-4" /> Novo roteiro</Button>}
      filters={
        <>
          {["Todas", ...categorias].map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}
              className={cn("h-8 rounded-full border px-3 text-[13px] font-medium", cat === c ? "border-ink bg-ink text-surface" : "border-line-strong text-ink hover:bg-surface-2")}>{c}</button>
          ))}
          {(["todos", "rascunho", "publicada"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
              className={cn("h-8 rounded-full border px-3 text-[13px]", status === s ? "border-gold bg-gold/15 font-semibold text-ink" : "border-line text-ink-muted hover:bg-surface-2")}>
              {s === "todos" ? "Qualquer situação" : s === "rascunho" ? "Rascunho" : "Publicada"}
            </button>
          ))}
        </>
      }
      search={busca}
      onSearch={setBusca}
      panel={
        edit ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }}>
            <h3 className="text-lg font-semibold">{edit.id ? "Editar roteiro" : "Novo roteiro"}</h3>
            <div><Label>Título</Label><Input required value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></div>
            <div>
              <Label>Categoria</Label>
              <Input list="roteiros-categorias" required value={edit.categoria} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })} />
              <datalist id="roteiros-categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
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
            <div><Label>Dicas de voz (uma por linha)</Label><Textarea rows={4} value={edit.dicas} onChange={(e) => setEdit({ ...edit, dicas: e.target.value })} /></div>
            <div className="space-y-2 rounded-lg border border-line p-3">
              <Label>Áudio de exemplo (mp3, m4a, ogg ou wav · até 5 MB)</Label>
              {edit.audio_url && <AudioPlayer bucket={BUCKET} path={edit.audio_url} duracao={edit.duracao} />}
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-line-strong px-3 text-sm hover:bg-surface-2">
                  {subindo ? "Enviando…" : edit.audio_url ? "Trocar áudio" : "Enviar áudio"}
                  <input type="file" accept=".mp3,.m4a,.ogg,.wav,audio/*" className="sr-only" disabled={subindo}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviarAudio(f); }} />
                </label>
                {edit.audio_url && <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setEdit({ ...edit, audio_url: null })}>Remover</button>}
                <div className="ml-auto w-28"><Label className="text-xs">Duração</Label><Input placeholder="0:38" value={edit.duracao} onChange={(e) => setEdit({ ...edit, duracao: e.target.value })} /></div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={edit.publicada} onCheckedChange={(v) => setEdit({ ...edit, publicada: v })} /> Publicado (aparece para a equipe)
            </label>
            {edit.publicada && !edit.texto.trim() && <p role="alert" className="text-xs text-destructive">Escreva o texto antes de publicar.</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={salvar.isPending || subindo || (edit.publicada && !edit.texto.trim())}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>Fechar</Button>
              {edit.id && <Button type="button" variant="ghost" className="ml-auto text-destructive" onClick={() => confirm(`Excluir "${edit.titulo}"? Não dá para desfazer.`) && excluir.mutate(edit.id!)}>Excluir</Button>}
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Escolha um roteiro para editar ou crie um novo. Rascunho não aparece para a equipe.</p>
        )
      }
    >
      {q.isLoading ? <p className="py-6 text-sm text-muted-foreground">Carregando…</p> : visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted-foreground">
          {linhas.length === 0 ? 'Nenhum roteiro ainda. Use "Novo roteiro" para começar.' : "Nenhum roteiro neste filtro."}
        </p>
      ) : (
        <ul>
          {visiveis.map((r) => (
            <li key={r.id} className={cn("border-b border-line", edit?.id === r.id && "bg-sidebar")}>
              <button type="button" onClick={() => setEdit(daLinha(r))} className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-sidebar/60">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.titulo}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.categoria}</span>
                {r.audio_url && <Badge variant="outline">áudio</Badge>}
                {r.status === "publicada" ? <Badge variant="secondary">Publicado</Badge> : <Badge variant="outline" className="border-warning text-warning">Rascunho</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </AdminListDetail>
  );
}
