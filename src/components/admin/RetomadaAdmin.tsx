import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminEquipe7Dias, adminListCadencia, adminListMotivos, adminSalvarCadencia, deleteMotivo, upsertMotivo,
} from "@/lib/retomada.functions";
import {
  CANAIS, CANAL_LABEL, ETAPA_LABEL, PAPEIS, PAPEL_LABEL, PONTOS_CADENCIA, PONTO_CURTO, PONTO_LABEL, REGUA,
  VARIAVEIS_RETOMADA, semTexto, type CadenciaMensagem, type Canal, type EtapaRetomada, type Papel, type PontoCadencia,
} from "@/lib/retomada";
import { supabase } from "@/integrations/supabase/client";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { Overline } from "@/components/cliente-disse/shared";
import { AudioExemplo, AUDIO_BUCKET } from "@/components/retomada/AudioExemplo";
import { BaixarRelatorioButton } from "@/components/retomada/BaixarRelatorio";
import {
  AdminListDetail, DeleteLink, FieldLabel, FilterPill, ListRow, PanelEmpty, PanelHeader, StatusTag, inputCls,
} from "@/components/admin/AdminListDetail";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
const CAD_KEY = ["admin-cadencia"] as const;
const EQUIPE_KEY = ["admin-retomada-equipe"] as const;
const MOTIVOS_KEY = ["admin-motivos-perda"] as const;

const ordemEtapa = (e: EtapaRetomada) => (e === "follow_up" ? 0 : REGUA.indexOf(e as (typeof REGUA)[number]) + 1);
const resumoTexto = (t: string) => (semTexto(t) ? "A escrever" : t.replace(/\s+/g, " ").slice(0, 70));

// ===========================================================================
// Cadência de retomada
// ===========================================================================

export function CadenciaAdminTab() {
  const listFn = useServerFn(adminListCadencia);
  const salvarFn = useServerFn(adminSalvarCadencia);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CAD_KEY, queryFn: () => listFn({}) });
  const [ponto, setPonto] = useState<PontoCadencia>("recebeu_proposta");
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CadenciaMensagem | null>(null);

  const lista = (q.data ?? []).filter((m) => m.ponto_parada === ponto).sort((a, b) => ordemEtapa(a.etapa) - ordemEtapa(b.etapa));

  const abrir = (m: CadenciaMensagem) => { setSelId(m.id); setDraft({ ...m }); };

  const salvar = useMutation({
    mutationFn: (v: { m: CadenciaMensagem; status: "rascunho" | "publicada" }) =>
      salvarFn({ data: { id: v.m.id, canal: v.m.canal, papel: v.m.papel, texto: v.m.texto, por_que: v.m.por_que, audio_exemplo_url: v.m.audio_exemplo_url, status: v.status } }),
    onSuccess: (m, v) => {
      toast.success(v.status === "publicada" ? `Publicada (versão ${m.versao}).` : "Salvo como rascunho.");
      setDraft({ ...m });
      qc.invalidateQueries({ queryKey: CAD_KEY });
    },
    onError: erro,
  });

  return (
    <AdminListDetail
      title="Cadência de retomada"
      subtitle="Uma sequência para cada ponto de parada. O atendente recebe a mensagem do dia já com os dados do cliente."
      filters={PONTOS_CADENCIA.map((p) => (
        <FilterPill key={p} active={ponto === p} onClick={() => { setPonto(p); setSelId(null); setDraft(null); }}>{PONTO_CURTO[p]}</FilterPill>
      ))}
      panel={draft ? <CadenciaPainel key={draft.id} m={draft} onChange={setDraft} salvando={salvar.isPending}
        onSalvar={(status) => salvar.mutate({ m: draft, status })} onCancelar={() => { setDraft(null); setSelId(null); }} /> : <PanelEmpty>Escolha uma etapa para editar.</PanelEmpty>}
    >
      {q.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : lista.length === 0 ? (
        <p className="py-6 text-[14px] text-ink-muted">Sem etapas para este ponto de parada.</p>
      ) : (
        <div className="border-t border-line">
          {lista.map((m) => (
            <ListRow key={m.id} active={m.id === selId} onClick={() => abrir(m)}>
              <span className="w-12 shrink-0 text-[15px] font-semibold text-ink">{ETAPA_LABEL[m.etapa]}</span>
              <span className="w-16 shrink-0 text-[13.5px] text-ink-muted">{CANAL_LABEL[m.canal]}</span>
              <span className="w-24 shrink-0"><StatusTag status={m.status} /></span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
                <span className="text-ink-muted">{PAPEL_LABEL[m.papel]} · </span>{resumoTexto(m.texto)}
              </span>
            </ListRow>
          ))}
        </div>
      )}
      <EquipeBloco />
    </AdminListDetail>
  );
}

function CadenciaPainel({ m, onChange, onSalvar, onCancelar, salvando }: {
  m: CadenciaMensagem; onChange: (m: CadenciaMensagem) => void; onSalvar: (s: "rascunho" | "publicada") => void; onCancelar: () => void; salvando: boolean;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [subindo, setSubindo] = useState(false);
  const set = (patch: Partial<CadenciaMensagem>) => onChange({ ...m, ...patch });
  const audio = m.canal === "audio";

  const inserir = (v: string) => {
    const el = ta.current;
    const tag = `{${v}}`;
    if (!el) return set({ texto: m.texto + tag });
    const a = el.selectionStart ?? m.texto.length, b = el.selectionEnd ?? a;
    set({ texto: m.texto.slice(0, a) + tag + m.texto.slice(b) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); });
  };

  const enviarAudio = async (f: File) => {
    if (!f.type.startsWith("audio/")) return toast.error("Envie um arquivo de áudio (mp3, m4a, ogg…).");
    if (f.size > 10 * 1024 * 1024) return toast.error("O áudio passa de 10 MB.");
    setSubindo(true);
    try {
      const path = `${m.id}/${Date.now()}-${f.name.normalize("NFD").replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, f, { contentType: f.type });
      if (error) throw error;
      set({ audio_exemplo_url: path });
      toast.success("Áudio enviado. Salve para aplicar.");
    } catch (e) { erro(e); } finally { setSubindo(false); }
  };

  return (
    <div>
      <PanelHeader overline={`Editando · ${PONTO_LABEL[m.ponto_parada]} · ${ETAPA_LABEL[m.etapa]}`} title={`Mensagem do ${ETAPA_LABEL[m.etapa]}`} onClose={onCancelar} />
      <p className="-mt-2 mb-3 text-[13px] text-ink-muted">Versão {m.versao} · <StatusTag status={m.status} /></p>

      <FieldLabel>Canal</FieldLabel>
      <div className="flex gap-1.5">
        {CANAIS.map((c: Canal) => <FilterPill key={c} active={m.canal === c} onClick={() => set({ canal: c })}>{CANAL_LABEL[c]}</FilterPill>)}
      </div>

      <FieldLabel>Papel na cadência</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {PAPEIS.map((p: Papel) => <FilterPill key={p} active={m.papel === p} onClick={() => set({ papel: p })}>{PAPEL_LABEL[p]}</FilterPill>)}
      </div>

      <FieldLabel>{audio ? "Roteiro do áudio (até 30 s)" : "Texto da mensagem"}</FieldLabel>
      <textarea ref={ta} rows={6} className={cn(inputCls, "resize-y leading-6")} value={m.texto} onChange={(e) => set({ texto: e.target.value })} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {VARIAVEIS_RETOMADA.map((v) => (
          <button key={v} type="button" onClick={() => inserir(v)} className="rounded-md border border-dashed border-gold px-2 py-0.5 text-[12.5px] text-gold-text hover:bg-gold/10">{`{${v}}`}</button>
        ))}
      </div>

      {audio && (
        <>
          <FieldLabel>Áudio de exemplo</FieldLabel>
          <div className="space-y-2">
            {m.audio_exemplo_url && <AudioExemplo path={m.audio_exemplo_url} />}
            <div className="flex items-center gap-3">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] font-medium text-ink hover:bg-surface-2 focus-within:outline-2 focus-within:outline-ring">
                {subindo ? "Enviando…" : m.audio_exemplo_url ? "Trocar" : "Enviar áudio"}
                <input type="file" accept="audio/*" className="sr-only" disabled={subindo} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviarAudio(f); }} />
              </label>
              {m.audio_exemplo_url && <button type="button" className="text-[13.5px] text-ink-muted hover:text-ink" onClick={() => set({ audio_exemplo_url: null })}>Remover</button>}
            </div>
          </div>
        </>
      )}

      <FieldLabel>Por que esta mensagem (aparece para o atendente)</FieldLabel>
      <textarea rows={2} className={cn(inputCls, "resize-y")} value={m.por_que} onChange={(e) => set({ por_que: e.target.value })} />

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {m.status === "publicada" ? (
          <GoldButton className="h-9 text-[14px]" disabled={salvando || semTexto(m.texto)} onClick={() => onSalvar("publicada")}>Salvar (nova versão)</GoldButton>
        ) : (
          <>
            <GoldButton className="h-9 text-[14px]" disabled={salvando || semTexto(m.texto)} onClick={() => onSalvar("publicada")}>Publicar</GoldButton>
            <OutlineButton className="h-9 text-[14px]" disabled={salvando} onClick={() => onSalvar("rascunho")}>Salvar rascunho</OutlineButton>
          </>
        )}
        {m.status === "publicada" && <OutlineButton className="h-9 text-[14px]" disabled={salvando} onClick={() => onSalvar("rascunho")}>Voltar para rascunho</OutlineButton>}
        <OutlineButton className="h-9 text-[14px]" onClick={onCancelar}>Cancelar</OutlineButton>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-muted">Editar uma mensagem publicada guarda a versão antiga e cria a versão {m.status === "publicada" ? m.versao + 1 : m.versao}. As variáveis sem dado ficam vazias.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipe · últimos 7 dias (só números)
// ---------------------------------------------------------------------------

function EquipeBloco() {
  const fn = useServerFn(adminEquipe7Dias);
  const q = useQuery({ queryKey: EQUIPE_KEY, queryFn: () => fn({}), staleTime: 60_000 });
  const [detalhe, setDetalhe] = useState(false);
  const d = q.data;
  const cards: { n: string; l: string }[] = d ? [
    { n: String(d.naFila), l: "na fila" },
    { n: d.pctNoDia == null ? "—" : `${d.pctNoDia}%`, l: "retomadas feitas no dia" },
    { n: String(d.responderam), l: "responderam" },
    { n: String(d.fecharam), l: "fecharam" },
    { n: String(d.perdidos), l: d.primeiroMotivo ? `perdidos · “${d.primeiroMotivo}” é o 1º motivo` : "perdidos" },
  ] : [];

  return (
    <section className="mt-8" aria-label="Equipe nos últimos 7 dias">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Overline>Equipe · últimos 7 dias</Overline>
        <BaixarRelatorioButton admin variant="button" />
      </div>
      {q.isLoading ? <p className="mt-3 text-[14px] text-ink-muted">Carregando…</p> : q.isError ? <p className="mt-3 text-[14px] text-ink-muted">Não consegui carregar os números agora.</p> : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {cards.map((c) => (
              <div key={c.l} className="min-h-[104px] rounded-xl border border-line-strong p-3.5">
                <p className="text-[30px] font-medium leading-9 text-ink">{c.n}</p>
                <p className="mt-1 text-[13px] leading-[18px] text-ink-muted">{c.l}</p>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setDetalhe((v) => !v)} className="mt-3 text-[14px] font-semibold text-gold-text hover:underline" aria-expanded={detalhe}>
            {detalhe ? "Esconder por atendente" : "Ver por atendente"} <span aria-hidden>→</span>
          </button>
          {detalhe && d && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-left text-[13.5px]">
                <thead className="border-b border-line text-[11.5px] uppercase tracking-[0.1em] text-ink-muted">
                  <tr>{["Atendente", "Na fila", "Atrasados +1 dia", "Enviados", "% no dia", "Responderam", "Fecharam", "Perdidos"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {d.porAtendente.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-ink-muted">Sem dados ainda.</td></tr>}
                  {d.porAtendente.map((l) => (
                    <tr key={l.user_id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 font-medium text-ink">{l.atendente}</td>
                      <td className="px-3 py-2">{l.na_fila}</td>
                      <td className={cn("px-3 py-2", l.atrasados > 0 && "font-semibold text-gold-text")}>{l.atrasados}</td>
                      <td className="px-3 py-2">{l.enviadas}</td>
                      <td className="px-3 py-2">{l.enviadas ? `${Math.round((l.no_dia / l.enviadas) * 100)}%` : "—"}</td>
                      <td className="px-3 py-2">{l.responderam}</td>
                      <td className="px-3 py-2">{l.fecharam}</td>
                      <td className="px-3 py-2">{l.perdidos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line px-3 py-2 text-[12.5px] text-ink-muted">Só números: nomes de clientes e telefones não aparecem aqui.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ===========================================================================
// Motivos de perda
// ===========================================================================

interface MotivoEdit { id?: string; nome: string; ordem: number; ativo: boolean; usos?: number }

export function MotivosPerdaAdminTab() {
  const listFn = useServerFn(adminListMotivos);
  const upsertFn = useServerFn(upsertMotivo);
  const delFn = useServerFn(deleteMotivo);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: MOTIVOS_KEY, queryFn: () => listFn({}) });
  const [edit, setEdit] = useState<MotivoEdit | null>(null);
  const motivos = q.data ?? [];

  const refresh = () => { qc.invalidateQueries({ queryKey: MOTIVOS_KEY }); qc.invalidateQueries({ queryKey: ["retomada-base"] }); };
  const salvar = useMutation({
    mutationFn: (v: MotivoEdit) => upsertFn({ data: { id: v.id, nome: v.nome, ordem: v.ordem, ativo: v.ativo } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); refresh(); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído."); setEdit(null); refresh(); },
    onError: erro,
  });

  return (
    <AdminListDetail
      title="Motivos de perda"
      subtitle="As opções que o atendente vê ao marcar um cliente como perdido."
      actions={<GoldButton className="h-9 text-[14px]" onClick={() => setEdit({ nome: "", ordem: (motivos.length + 1) * 10, ativo: true })}>+ Novo motivo</GoldButton>}
      panel={edit ? (
        <div>
          <PanelHeader overline={edit.id ? "Editando · motivo" : "Novo · motivo"} title={edit.nome || "Sem nome"} onClose={() => setEdit(null)} />
          <FieldLabel>Nome</FieldLabel>
          <input className={inputCls} value={edit.nome} maxLength={80} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
          <FieldLabel>Ordem (menor aparece primeiro)</FieldLabel>
          <input type="number" className={cn(inputCls, "w-28")} value={edit.ordem} onChange={(e) => setEdit({ ...edit, ordem: Number(e.target.value) || 0 })} />
          <label className="mt-4 flex items-center gap-2 text-[14px] text-ink">
            <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} /> Aparece para o atendente
          </label>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <GoldButton className="h-9 text-[14px]" disabled={!edit.nome.trim() || salvar.isPending} onClick={() => salvar.mutate(edit)}>Salvar</GoldButton>
            <OutlineButton className="h-9 text-[14px]" onClick={() => setEdit(null)}>Cancelar</OutlineButton>
            {edit.id && <DeleteLink title="Excluir este motivo?" description="Os clientes já marcados com ele continuam com o texto gravado." onConfirm={() => excluir.mutate(edit.id!)} />}
          </div>
        </div>
      ) : <PanelEmpty />}
    >
      {q.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : (
        <div className="border-t border-line">
          {motivos.map((m) => (
            <ListRow key={m.id} active={edit?.id === m.id} onClick={() => setEdit({ id: m.id, nome: m.nome, ordem: m.ordem, ativo: m.ativo })}>
              <span className={cn("min-w-0 flex-1 truncate text-[15px] font-medium", m.ativo ? "text-ink" : "text-ink-muted")}>{m.nome}</span>
              <span className="shrink-0 text-[13px] text-ink-muted">{m.usos} {m.usos === 1 ? "perdido" : "perdidos"}</span>
              {!m.ativo && <span className="shrink-0 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11.5px] text-ink-muted">Oculto</span>}
            </ListRow>
          ))}
        </div>
      )}
    </AdminListDetail>
  );
}
