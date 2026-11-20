import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminListFechamento, adminListObjecoes, adminListPendentes, aprovarPendente, deleteFechamentoItem, deleteObjecao,
  recusarPendente, salvarRascunhoPendente, setItemEconomia, setMensalidadePlano, sugerirRespostaObjecao,
  upsertFechamentoItem, upsertObjecao, type PendenteAdmin,
} from "@/lib/cliente-disse.functions";
import {
  ANGULO_LABEL, ANGULO_TIPOS, ETAPAS, ETAPA_LABEL, ITEM_TIPOS, ITEM_TIPO_LABEL, PLANOS, PLANO_LABEL, VARIAVEIS, brl,
  objecaoVazia, type AnguloTipo, type Etapa, type FechamentoItem, type ItemAmor, type ItemTipo, type Objecao,
  type ObjecaoConteudo, type Status,
} from "@/lib/cliente-disse";
import { GoldButton, OutlineButton, normalize } from "@/components/scripts/shared";
import { BASE_KEY, useClienteDisseBase } from "@/components/cliente-disse/shared";
import {
  AdminListDetail, DeleteLink, FieldLabel, FilterPill, ListRow, PanelEmpty, PanelHeader, StatusTag, TagsField,
  fmtDia, inputCls,
} from "@/components/admin/AdminListDetail";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar.");

// ===========================================================================
// Formulário de objeção (usado em Objeções e em Objeções novas)
// ===========================================================================

function ObjecaoForm({ value, onChange }: { value: ObjecaoConteudo; onChange: (v: ObjecaoConteudo) => void }) {
  const set = (patch: Partial<ObjecaoConteudo>) => onChange({ ...value, ...patch });
  return (
    <div>
      <FieldLabel>Nome da objeção</FieldLabel>
      <input className={inputCls} value={value.nome} onChange={(e) => set({ nome: e.target.value })} />

      <FieldLabel>Como o cliente costuma dizer</FieldLabel>
      <TagsField value={value.exemplos_de_fala} onChange={(v) => set({ exemplos_de_fala: v })} placeholder="Digite uma fala e Enter" />

      <FieldLabel>O que ele(a) pode querer dizer</FieldLabel>
      <div className="space-y-2">
        {value.leituras.map((l, i) => (
          <div key={i} className="rounded-md border border-line p-2.5">
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Leitura (ex.: Não viu valor ainda)"
                value={l.titulo}
                onChange={(e) => set({ leituras: value.leituras.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) })}
              />
              <button type="button" aria-label="Remover leitura" className="text-ink-muted hover:text-ink" onClick={() => set({ leituras: value.leituras.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <input
              className={cn(inputCls, "mt-2")}
              placeholder="Pergunte: …"
              value={l.pergunta}
              onChange={(e) => set({ leituras: value.leituras.map((x, j) => (j === i ? { ...x, pergunta: e.target.value } : x)) })}
            />
          </div>
        ))}
        {value.leituras.length < 8 && (
          <button type="button" className="text-[13.5px] font-semibold text-gold-text hover:underline" onClick={() => set({ leituras: [...value.leituras, { titulo: "", pergunta: "" }] })}>
            + Leitura
          </button>
        )}
      </div>

      <FieldLabel>Ângulos de resposta</FieldLabel>
      <div className="space-y-2">
        {value.angulos.map((a, i) => (
          <div key={i} className="rounded-md border border-line p-2.5">
            <div className="flex gap-2">
              <select
                className={cn(inputCls, "w-36 shrink-0")}
                value={a.tipo}
                onChange={(e) => set({ angulos: value.angulos.map((x, j) => (j === i ? { ...x, tipo: e.target.value as AnguloTipo } : x)) })}
              >
                {ANGULO_TIPOS.map((t) => <option key={t} value={t}>{ANGULO_LABEL[t]}</option>)}
              </select>
              <input
                className={inputCls}
                placeholder="Rótulo (ex.: a conta)"
                value={a.rotulo}
                onChange={(e) => set({ angulos: value.angulos.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)) })}
              />
              <button type="button" aria-label="Remover ângulo" className="text-ink-muted hover:text-ink" onClick={() => set({ angulos: value.angulos.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              rows={3}
              className={cn(inputCls, "mt-2")}
              placeholder="Texto da resposta"
              value={a.texto}
              onChange={(e) => set({ angulos: value.angulos.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
            />
          </div>
        ))}
        {value.angulos.length < 6 && (
          <button
            type="button"
            className="text-[13.5px] font-semibold text-gold-text hover:underline"
            onClick={() => set({ angulos: [...value.angulos, { tipo: ANGULO_TIPOS[value.angulos.length % 3], rotulo: "", texto: "" }] })}
          >
            + Ângulo
          </button>
        )}
      </div>

      <FieldLabel>Pergunta para avançar</FieldLabel>
      <textarea rows={2} className={inputCls} value={value.pergunta_avancar ?? ""} onChange={(e) => set({ pergunta_avancar: e.target.value || null })} />

      <FieldLabel>Evite dizer</FieldLabel>
      <textarea rows={2} className={inputCls} value={value.evite_dizer ?? ""} onChange={(e) => set({ evite_dizer: e.target.value || null })} />
    </div>
  );
}

// ===========================================================================
// Objeções
// ===========================================================================

type ObjecaoEdit = ObjecaoConteudo & { id?: string; prioridade: number; status: Status };

export function ObjecoesAdminTab() {
  const listFn = useServerFn(adminListObjecoes);
  const upsertFn = useServerFn(upsertObjecao);
  const delFn = useServerFn(deleteObjecao);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-objecoes"], queryFn: () => listFn({}) });
  const [filtro, setFiltro] = useState<"todas" | Status>("todas");
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<ObjecaoEdit | null>(null);

  const objecoes = q.data?.objecoes ?? [];
  const uso30 = q.data?.uso30 ?? {};
  const lista = objecoes.filter((o) =>
    (filtro === "todas" || o.status === filtro) && (!busca.trim() || normalize(`${o.nome} ${o.exemplos_de_fala.join(" ")}`).includes(normalize(busca.trim()))),
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-objecoes"] });
    qc.invalidateQueries({ queryKey: BASE_KEY });
  };
  const salvar = useMutation({
    mutationFn: (v: ObjecaoEdit) => upsertFn({ data: v }),
    onSuccess: (o) => { toast.success(o.status === "publicada" ? "Objeção publicada." : "Salvo como rascunho."); setEdit(toEdit(o)); refresh(); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída."); setEdit(null); refresh(); },
    onError: erro,
  });

  return (
    <AdminListDetail
      title="Objeções"
      subtitle="Respostas aprovadas que aparecem em Scripts → O cliente disse…"
      actions={<GoldButton className="h-9 text-[14px]" onClick={() => setEdit({ ...objecaoVazia(), prioridade: (objecoes.length + 1) * 10, status: "rascunho" })}>+ Nova objeção</GoldButton>}
      filters={(["todas", "publicada", "rascunho"] as const).map((f) => (
        <FilterPill key={f} active={filtro === f} onClick={() => setFiltro(f)}>
          {f === "todas" ? "Todas" : f === "publicada" ? "Publicadas" : "Rascunhos"}
        </FilterPill>
      ))}
      search={busca}
      onSearch={setBusca}
      panel={
        edit ? (
          <div>
            <PanelHeader overline={edit.id ? "Editando · objeção" : "Nova · objeção"} title={edit.nome || "Sem nome"} onClose={() => setEdit(null)} />
            <ObjecaoForm value={edit} onChange={(v) => setEdit({ ...edit, ...v })} />
            <FieldLabel>Prioridade (menor trata primeiro)</FieldLabel>
            <input type="number" className={cn(inputCls, "w-28")} value={edit.prioridade} onChange={(e) => setEdit({ ...edit, prioridade: Number(e.target.value) || 0 })} />
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <GoldButton className="h-9 text-[14px]" disabled={!edit.nome.trim() || salvar.isPending} onClick={() => salvar.mutate(edit)}>Salvar</GoldButton>
              {edit.status === "rascunho" ? (
                <OutlineButton className="h-9 text-[14px]" disabled={!edit.nome.trim() || salvar.isPending} onClick={() => salvar.mutate({ ...edit, status: "publicada" })}>Publicar</OutlineButton>
              ) : (
                <OutlineButton className="h-9 text-[14px]" disabled={salvar.isPending} onClick={() => salvar.mutate({ ...edit, status: "rascunho" })}>Voltar para rascunho</OutlineButton>
              )}
              <OutlineButton className="h-9 text-[14px]" onClick={() => setEdit(null)}>Cancelar</OutlineButton>
              {edit.id && <DeleteLink title="Excluir esta objeção?" onConfirm={() => excluir.mutate(edit.id!)} />}
            </div>
          </div>
        ) : <PanelEmpty />
      }
    >
      {q.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
      {!q.isLoading && lista.length === 0 && <p className="py-6 text-sm text-ink-muted">Nenhuma objeção {filtro === "publicada" ? "publicada " : ""}ainda.</p>}
      {lista.map((o) => {
        const u = uso30[o.id];
        return (
          <ListRow key={o.id} active={edit?.id === o.id} onClick={() => setEdit(toEdit(o))}>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-[15px] text-ink", edit?.id === o.id && "font-semibold")}>{o.nome}</span>
              <span className="block truncate text-[12.5px] text-ink-muted">
                usada {u?.total ?? 0}× em 30 dias{u?.topAngulo ? ` · mais usado: ${ANGULO_LABEL[u.topAngulo as AnguloTipo] ?? (u.topAngulo === "avancar" ? "Para avançar" : u.topAngulo)}` : ""}
              </span>
            </span>
            <StatusTag status={o.status} />
            <span className="hidden shrink-0 text-[12.5px] text-ink-muted sm:inline">Atualizado {fmtDia(o.updated_at)}</span>
          </ListRow>
        );
      })}
    </AdminListDetail>
  );
}

function toEdit(o: Objecao): ObjecaoEdit {
  return {
    id: o.id, nome: o.nome, exemplos_de_fala: o.exemplos_de_fala, leituras: o.leituras, angulos: o.angulos,
    pergunta_avancar: o.pergunta_avancar, evite_dizer: o.evite_dizer, prioridade: o.prioridade, status: o.status,
  };
}

// ===========================================================================
// Objeções novas (fila)
// ===========================================================================

function quando(iso: string) {
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return fmtDia(iso);
}

export function ObjecoesNovasTab() {
  const listFn = useServerFn(adminListPendentes);
  const aprovarFn = useServerFn(aprovarPendente);
  const rascunhoFn = useServerFn(salvarRascunhoPendente);
  const recusarFn = useServerFn(recusarPendente);
  const sugerirFn = useServerFn(sugerirRespostaObjecao);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-objecoes-pendentes"], queryFn: () => listFn({}) });
  const lista = q.data ?? [];
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState<ObjecaoConteudo | null>(null);
  const sel = lista.find((p) => p.id === selId) ?? null;

  const abrir = (p: PendenteAdmin) => {
    setSelId(p.id);
    setForm(p.sugestao_ia ?? { ...objecaoVazia(), exemplos_de_fala: [p.fala_exemplo, ...p.falas_parecidas].slice(0, 10) });
  };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-objecoes-pendentes"] });
    qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
  };
  const fechar = () => { setSelId(null); setForm(null); };

  const aprovar = useMutation({
    mutationFn: () => aprovarFn({ data: { pendente_id: selId!, objecao: form! } }),
    onSuccess: () => {
      toast.success("Aprovada e publicada. Já aparece em Novidades.");
      fechar(); refresh();
      qc.invalidateQueries({ queryKey: ["admin-objecoes"] });
      qc.invalidateQueries({ queryKey: BASE_KEY });
    },
    onError: erro,
  });
  const rascunho = useMutation({
    mutationFn: () => rascunhoFn({ data: { pendente_id: selId!, objecao: form! } }),
    onSuccess: () => { toast.success("Rascunho salvo."); refresh(); },
    onError: erro,
  });
  const recusar = useMutation({
    mutationFn: () => recusarFn({ data: { pendente_id: selId! } }),
    onSuccess: () => { toast.success("Recusada."); fechar(); refresh(); },
    onError: erro,
  });
  const sugerir = useMutation({
    mutationFn: (p: PendenteAdmin) => sugerirFn({ data: { fala: p.fala_exemplo, pendente_id: p.id } }),
    onSuccess: (s) => { setForm(s); refresh(); },
    onError: () => toast.error("Não consegui gerar a sugestão agora. Tente de novo."),
  });

  return (
    <AdminListDetail
      title="Objeções novas"
      subtitle="Falas sem resposta aprovada, agrupadas por semelhança. As que mais aparecem vêm primeiro."
      panel={
        sel && form ? (
          <div>
            <p className="type-overline text-ink-muted">Revisando · {sel.semana} {sel.semana === 1 ? "vez" : "vezes"} esta semana</p>
            <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink [overflow-wrap:anywhere]">“{sel.fala_exemplo}”</h3>
            {sel.falas_parecidas.length > 0 && (
              <p className="mt-3 text-[14px] text-ink-muted">
                Falas parecidas: {sel.falas_parecidas.slice(-6).map((f, i) => (
                  <span key={i}>{i > 0 && ", "}<span className="font-semibold text-ink">“{f}”</span></span>
                ))}
              </p>
            )}
            {sel.respostas.map((r, i) => (
              <p key={i} className="mt-2 text-[14px] text-ink-muted">
                {r.nome} respondeu: <span className="font-semibold text-ink">“{r.texto}”</span>
              </p>
            ))}
            {!sel.sugestao_ia && (
              <p className="mt-3 text-[13.5px] text-ink-muted">
                Sem sugestão da IA ainda.{" "}
                <button type="button" className="font-semibold text-gold-text hover:underline" disabled={sugerir.isPending} onClick={() => sugerir.mutate(sel)}>
                  {sugerir.isPending ? "Gerando…" : "Gerar sugestão"}
                </button>
              </p>
            )}
            <div className="mt-4">
              <ObjecaoForm value={form} onChange={setForm} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <GoldButton className="h-9 text-[14px]" disabled={!form.nome.trim() || aprovar.isPending} onClick={() => aprovar.mutate()}>Aprovar e publicar</GoldButton>
              <OutlineButton className="h-9 text-[14px]" disabled={rascunho.isPending} onClick={() => rascunho.mutate()}>Salvar rascunho</OutlineButton>
              <DeleteLink label="Recusar" title="Recusar esta objeção?" description="Ela sai da fila. As falas continuam guardadas." onConfirm={() => recusar.mutate()} />
            </div>
            <p className="mt-2 text-[12.5px] text-ink-muted">
              Ao aprovar: entra na base{sel.sugerida_por_nome ? ` com crédito a ${sel.sugerida_por_nome}` : ""} e aparece em Novidades.
            </p>
          </div>
        ) : <PanelEmpty>Escolha uma fala na lista para revisar.</PanelEmpty>
      }
    >
      {q.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
      {!q.isLoading && lista.length === 0 && <p className="py-6 text-sm text-ink-muted">Nenhuma objeção nova para revisar.</p>}
      {lista.map((p) => (
        <ListRow
          key={p.id}
          active={p.id === selId}
          onClick={() => abrir(p)}
          trailing={<OutlineButton className="h-8 px-3 text-[13.5px]" onClick={() => abrir(p)}>Revisar</OutlineButton>}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink">“{p.fala_exemplo}”</span>
            <span className="block truncate text-[12.5px] text-ink-muted">
              {p.sugerida_por_nome ? `Sugerida por ${p.sugerida_por_nome} · ${quando(p.ultima_ocorrencia)}` : "Detectada automaticamente"}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[17px] font-semibold tabular-nums text-ink">{p.semana}</span>
            <span className="block text-[11.5px] text-ink-muted">esta semana</span>
          </span>
        </ListRow>
      ))}
    </AdminListDetail>
  );
}

// ===========================================================================
// Fechamento
// ===========================================================================

type ItemEdit = Omit<FechamentoItem, "id" | "updated_at"> & { id?: string };

export function FechamentoAdminTab() {
  const listFn = useServerFn(adminListFechamento);
  const upsertFn = useServerFn(upsertFechamentoItem);
  const delFn = useServerFn(deleteFechamentoItem);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-fechamento"], queryFn: () => listFn({}) });
  const [tipo, setTipo] = useState<"todos" | ItemTipo>("todos");
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<ItemEdit | null>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);

  const itens = q.data ?? [];
  const filtrados = itens.filter((i) =>
    (tipo === "todos" || i.tipo === tipo) && (!busca.trim() || normalize(`${i.titulo} ${i.exemplos_de_fala.join(" ")}`).includes(normalize(busca.trim()))),
  );
  const porEtapa = useMemo(() => ETAPAS.map((e) => ({
    etapa: e,
    itens: filtrados.filter((i) => i.etapa === e).sort((a, b) => ITEM_TIPOS.indexOf(a.tipo) - ITEM_TIPOS.indexOf(b.tipo) || a.ordem - b.ordem),
  })), [filtrados]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-fechamento"] }); qc.invalidateQueries({ queryKey: BASE_KEY }); };
  const salvar = useMutation({
    mutationFn: (v: ItemEdit) => upsertFn({ data: v }),
    onSuccess: (r) => { toast.success(r.status === "publicada" ? "Publicado." : "Salvo como rascunho."); setEdit({ ...r }); refresh(); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído."); setEdit(null); refresh(); },
    onError: erro,
  });

  const inserirVar = (v: string) => {
    if (!edit) return;
    const el = msgRef.current;
    const atual = edit.mensagem ?? "";
    const ini = el?.selectionStart ?? atual.length;
    const fim = el?.selectionEnd ?? atual.length;
    const novo = atual.slice(0, ini) + v + atual.slice(fim);
    setEdit({ ...edit, mensagem: novo });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + v.length, ini + v.length); });
  };

  const novo = (): ItemEdit => ({
    tipo: tipo === "todos" ? "mensagem_etapa" : tipo, etapa: "proposta", titulo: "", exemplos_de_fala: [], mensagem: null,
    passos: [], evite: null, ordem: (itens.length + 1) * 10, status: "rascunho",
  });

  return (
    <AdminListDetail
      title="Fechamento"
      subtitle="Sinais de compra, mensagens de cada etapa e travamentos da aba Fechar com este cliente."
      actions={<GoldButton className="h-9 text-[14px]" onClick={() => setEdit(novo())}>+ Novo item</GoldButton>}
      filters={(["todos", ...ITEM_TIPOS] as const).map((t) => (
        <FilterPill key={t} active={tipo === t} onClick={() => setTipo(t)}>{t === "todos" ? "Todos" : ITEM_TIPO_LABEL[t]}</FilterPill>
      ))}
      search={busca}
      onSearch={setBusca}
      panel={
        edit ? (
          <div>
            <PanelHeader overline={`${edit.id ? "Editando" : "Novo"} · ${ITEM_TIPO_LABEL[edit.tipo].toLowerCase()}`} title={edit.titulo || "Sem título"} onClose={() => setEdit(null)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Tipo</FieldLabel>
                <select className={inputCls} value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value as ItemTipo })}>
                  {ITEM_TIPOS.map((t) => <option key={t} value={t}>{ITEM_TIPO_LABEL[t]}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Etapa</FieldLabel>
                <select className={inputCls} value={edit.etapa} onChange={(e) => setEdit({ ...edit, etapa: e.target.value as Etapa })}>
                  {ETAPAS.map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
                </select>
              </div>
            </div>
            <FieldLabel>Título</FieldLabel>
            <input className={inputCls} value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} />
            <FieldLabel>Exemplos de fala</FieldLabel>
            <TagsField value={edit.exemplos_de_fala} onChange={(v) => setEdit({ ...edit, exemplos_de_fala: v })} placeholder="Digite uma fala e Enter" />
            <FieldLabel>Mensagem</FieldLabel>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {VARIAVEIS.map((v) => (
                <button key={v} type="button" onClick={() => inserirVar(v)} className="rounded border border-line-strong px-1.5 py-0.5 font-mono text-[12px] text-ink hover:bg-surface-2">{v}</button>
              ))}
            </div>
            <textarea ref={msgRef} rows={5} className={inputCls} value={edit.mensagem ?? ""} onChange={(e) => setEdit({ ...edit, mensagem: e.target.value || null })} />
            <FieldLabel>Passos</FieldLabel>
            <div className="space-y-1.5">
              {edit.passos.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <span className="w-5 pt-2 text-right text-[13px] text-ink-muted">{i + 1}.</span>
                  <input className={inputCls} value={p} onChange={(e) => setEdit({ ...edit, passos: edit.passos.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <button type="button" aria-label="Remover passo" className="text-ink-muted hover:text-ink" onClick={() => setEdit({ ...edit, passos: edit.passos.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" className="text-[13.5px] font-semibold text-gold-text hover:underline" onClick={() => setEdit({ ...edit, passos: [...edit.passos, ""] })}>+ Passo</button>
            </div>
            <FieldLabel>Evite</FieldLabel>
            <textarea rows={2} className={inputCls} value={edit.evite ?? ""} onChange={(e) => setEdit({ ...edit, evite: e.target.value || null })} />
            <div className="mt-4 flex items-center gap-3">
              <Switch id="fech-pub" checked={edit.status === "publicada"} onCheckedChange={(c) => setEdit({ ...edit, status: c ? "publicada" : "rascunho" })} />
              <label htmlFor="fech-pub" className="text-[14px] text-ink">Publicado</label>
              <span className="ml-auto flex items-center gap-2 text-[13px] text-ink-muted">
                Ordem
                <input type="number" className={cn(inputCls, "w-20 py-1")} value={edit.ordem} onChange={(e) => setEdit({ ...edit, ordem: Number(e.target.value) || 0 })} />
              </span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <GoldButton className="h-9 text-[14px]" disabled={!edit.titulo.trim() || salvar.isPending} onClick={() => salvar.mutate({ ...edit, passos: edit.passos.filter((p) => p.trim()) })}>Salvar</GoldButton>
              <OutlineButton className="h-9 text-[14px]" onClick={() => setEdit(null)}>Cancelar</OutlineButton>
              {edit.id && <DeleteLink onConfirm={() => excluir.mutate(edit.id!)} />}
            </div>
          </div>
        ) : <PanelEmpty />
      }
    >
      {q.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
      {porEtapa.map((g) => (
        <section key={g.etapa} className="mb-4">
          <p className="type-overline border-b border-line pb-1.5 text-ink-muted">{ETAPA_LABEL[g.etapa]}</p>
          {g.itens.length === 0 && <p className="py-2 text-[13px] text-ink-muted">Nada cadastrado.</p>}
          {g.itens.map((i) => (
            <ListRow key={i.id} active={edit?.id === i.id} onClick={() => setEdit({ ...i })}>
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{i.titulo}</span>
              <span className="shrink-0 text-[12.5px] text-ink-muted">{ITEM_TIPO_LABEL[i.tipo]}</span>
              <StatusTag status={i.status} />
            </ListRow>
          ))}
        </section>
      ))}
    </AdminListDetail>
  );
}

// ===========================================================================
// Economia
// ===========================================================================

export function EconomiaAdminTab() {
  const base = useClienteDisseBase();
  const mensalFn = useServerFn(setMensalidadePlano);
  const itemFn = useServerFn(setItemEconomia);
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: BASE_KEY });

  const salvarMensal = useMutation({
    mutationFn: (v: { plano: (typeof PLANOS)[number]; mensalidade: number | null }) => mensalFn({ data: v }),
    onSuccess: () => { toast.success("Mensalidade salva."); refresh(); },
    onError: erro,
  });
  const salvarItem = useMutation({
    mutationFn: (v: { tipo: ItemAmor["tipo"]; id: string; preco_particular_medio: number | null; usar_na_economia: boolean }) => itemFn({ data: v }),
    onSuccess: () => refresh(),
    onError: erro,
  });

  const itens = (base.data?.itensAmor ?? []).filter((i) => !busca.trim() || normalize(i.nome).includes(normalize(busca.trim())));
  const tipoLabel = { consulta: "Consulta", exame: "Exame", odontologia: "Odontologia" } as const;
  const parse = (s: string) => {
    const v = s.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    return v === "" || Number.isNaN(Number(v)) ? null : Number(v);
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-medium leading-8 text-ink">Economia</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-muted">Usado em “O que você leva”, na aba Fechar com este cliente.</p>
        <p className="mt-5 type-overline text-ink-muted">Mensalidade de cada plano</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {PLANOS.map((p) => {
            const atual = base.data?.mensalidades[p];
            return (
              <label key={`${p}-${atual ?? ""}`} className="block">
                <span className="text-[13.5px] text-ink">{PLANO_LABEL[p]}</span>
                <input
                  defaultValue={atual != null ? String(atual).replace(".", ",") : ""}
                  placeholder="R$"
                  inputMode="decimal"
                  className={cn(inputCls, "mt-1 w-32")}
                  onBlur={(e) => {
                    const v = parse(e.target.value);
                    if (v !== (atual ?? null)) salvarMensal.mutate({ plano: p, mensalidade: v });
                  }}
                />
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="type-overline text-ink-muted">Itens da Amor Saúde</p>
            <p className="mt-0.5 text-[13.5px] text-ink-muted">Preço particular médio e se o item entra no cálculo. O valor com o cartão vem do cadastro da Amor Saúde.</p>
          </div>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className={cn(inputCls, "h-8 w-56 py-1")} />
        </div>
        {base.isLoading && <p className="mt-3 text-sm text-ink-muted">Carregando…</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.12em] text-ink-muted">
                <th className="py-2 font-semibold">Item</th>
                <th className="py-2 font-semibold">Tipo</th>
                <th className="py-2 font-semibold">Com o cartão</th>
                <th className="py-2 font-semibold">Preço particular médio</th>
                <th className="py-2 font-semibold">Usar no cálculo de economia</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={`${i.tipo}-${i.id}`} className="border-b border-line">
                  <td className="py-2 pr-3 text-ink">{i.nome}</td>
                  <td className="py-2 pr-3 text-ink-muted">{tipoLabel[i.tipo]}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink">{i.cartao != null ? brl(i.cartao) : <span className="text-ink-muted">—</span>}</td>
                  <td className="py-2 pr-3">
                    <input
                      key={`${i.id}-${i.particularMedio ?? ""}`}
                      defaultValue={i.particularMedio != null ? String(i.particularMedio).replace(".", ",") : ""}
                      placeholder="R$"
                      inputMode="decimal"
                      className={cn(inputCls, "w-28 py-1")}
                      onBlur={(e) => {
                        const v = parse(e.target.value);
                        if (v !== i.particularMedio) salvarItem.mutate({ tipo: i.tipo, id: i.id, preco_particular_medio: v, usar_na_economia: i.usarNaEconomia });
                      }}
                    />
                  </td>
                  <td className="py-2">
                    <Switch
                      checked={i.usarNaEconomia}
                      aria-label={`Usar ${i.nome} no cálculo de economia`}
                      onCheckedChange={(c) => salvarItem.mutate({ tipo: i.tipo, id: i.id, preco_particular_medio: i.particularMedio, usar_na_economia: c })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!base.isLoading && itens.length === 0 && <p className="py-4 text-sm text-ink-muted">Nenhum item encontrado.</p>}
        </div>
        <p className="mt-2 text-[12.5px] text-ink-muted">Itens sem valor com o cartão (como os de odontologia) não entram no cálculo, mesmo marcados.</p>
      </section>
    </div>
  );
}
