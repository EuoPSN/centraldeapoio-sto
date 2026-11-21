import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminAquecimento, adminDescartarExercicio, adminGerarRascunhos, adminListExercicios, adminMapaEquipe, adminReordenarTemas,
  adminSalvarAquecimento, adminSalvarExercicio, adminSalvarTema, type ExercicioAdmin,
} from "@/lib/aquecimento-admin.functions";
import {
  HABITOS, HABITO_CHAVES, NIVEL_LABEL, NIVEL_ORDEM, STATUS_LABEL, TIPOS_EXERCICIO, TIPO_LABEL, type Nivel, type TipoExercicio,
} from "@/lib/aquecimento";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { Overline } from "@/components/cliente-disse/shared";
import { AdminListDetail, DeleteLink, FieldLabel, ListRow, PanelEmpty, PanelHeader, inputCls } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";

const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não consegui salvar agora.");

// ---------------------------------------------------------------------------
// Mapa da equipe
// ---------------------------------------------------------------------------

function Celula({ nivel, nome, tema }: { nivel: Nivel; nome: string; tema: string }) {
  return (
    <span
      role="img"
      aria-label={`${nome}, ${tema}: ${NIVEL_LABEL[nivel]}`}
      title={NIVEL_LABEL[nivel]}
      className={cn(
        "block h-7 rounded-md",
        nivel === "dominando" && "bg-gold",
        nivel === "aprendendo" && "bg-gold/30",
        nivel === "nao_testado" && "border border-dashed border-line-strong",
      )}
    />
  );
}

export function MapaEquipeTab() {
  const fn = useServerFn(adminMapaEquipe);
  const q = useQuery({ queryKey: ["admin-mapa-equipe"], queryFn: () => fn({}) });
  const d = q.data;

  const analise = useMemo(() => {
    if (!d) return null;
    const nivelDe = (uid: string, tid: string): Nivel => d.celulas[`${uid}:${tid}`]?.nivel ?? "nao_testado";
    const porTema = d.temas.map((t, ordem) => {
      const c = { dominando: 0, aprendendo: 0, nao_testado: 0 };
      for (const a of d.atendentes) c[nivelDe(a.id, t.id)]++;
      return { ...t, ordem, ...c, testados: c.dominando + c.aprendendo };
    });
    const candidatos = porTema.filter((t) => t.testados > 0);
    const fraco = [...candidatos].sort((a, b) => (a.dominando + a.aprendendo * 0.5) - (b.dominando + b.aprendendo * 0.5) || b.nao_testado - a.nao_testado || a.ordem - b.ordem)[0] ?? null;
    const reforco = fraco
      ? d.atendentes
        .map((a) => ({ a, c: d.celulas[`${a.id}:${fraco.id}`], n: nivelDe(a.id, fraco.id) }))
        .filter((x) => x.n !== "dominando")
        .sort((x, y) => NIVEL_ORDEM[x.n] - NIVEL_ORDEM[y.n] || ((x.c?.acertos ?? 0) / Math.max(1, x.c?.respostas ?? 1)) - ((y.c?.acertos ?? 0) / Math.max(1, y.c?.respostas ?? 1)))
        .slice(0, 3).map((x) => x.a.nome)
      : [];
    return { fraco, reforco };
  }, [d]);

  return (
    <AdminListDetail
      title="Mapa da equipe"
      subtitle={`Nível de cada atendente por tema, nos últimos ${d?.janela_dias ?? 60} dias.`}
      panel={
        analise?.fraco ? (
          <div>
            <p className="type-overline text-ink-muted">Tema mais fraco da equipe</p>
            <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink">{analise.fraco.nome}</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([["dominando", analise.fraco.dominando, "dominando"], ["aprendendo", analise.fraco.aprendendo, "aprendendo"], ["nao_testado", analise.fraco.nao_testado, "não testados"]] as const).map(([k, n, l]) => (
                <div key={k} className="rounded-lg border border-line px-3 py-2">
                  <p className="text-[20px] font-medium leading-7 tabular-nums text-ink">{n}</p>
                  <p className="text-[12.5px] text-ink-muted">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13.5px] leading-5 text-ink-muted">Quem ainda não domina este tema recebe cartões dele primeiro no aquecimento.</p>
            <Link
              to="/treinamentos"
              search={{ busca: analise.fraco.nome }}
              className="mt-3 inline-flex h-10 items-center rounded-lg bg-gold px-[18px] text-[14px] font-semibold text-on-gold hover:brightness-105"
            >
              Abrir treinamento sobre {analise.fraco.nome}
            </Link>
            {analise.reforco.length > 0 && (
              <>
                <div className="mt-6"><Overline>Quem mais precisa de reforço</Overline></div>
                <p className="mt-1 text-[14px] text-ink">{analise.reforco.join(" · ")}</p>
              </>
            )}
            <p className="mt-4 text-[12.5px] leading-5 text-ink-muted">Você vê níveis e contagens, não o texto que cada pessoa digitou nos cartões.</p>
          </div>
        ) : (
          <PanelEmpty>{q.isLoading ? "Carregando…" : "Ainda não há respostas da equipe no aquecimento."}</PanelEmpty>
        )
      }
    >
      {q.isError && <p className="text-[13.5px] text-ink-muted">Não consegui carregar o mapa agora. Tente de novo.</p>}
      {d && d.atendentes.length === 0 && <PanelEmpty>Nenhum atendente cadastrado.</PanelEmpty>}
      {d && d.atendentes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-x-1.5 border-spacing-y-1.5 text-left">
            <thead>
              <tr>
                <th className="w-28" />
                {d.temas.map((t) => <th key={t.id} scope="col" className="px-0.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{t.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.atendentes.map((a) => (
                <tr key={a.id}>
                  <th scope="row" className="whitespace-nowrap pr-2 text-[14px] font-normal text-ink">{a.nome.split(" ")[0]}</th>
                  {d.temas.map((t) => <td key={t.id}><Celula nivel={d.celulas[`${a.id}:${t.id}`]?.nivel ?? "nao_testado"} nome={a.nome} tema={t.nome} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-muted" aria-label="Legenda">
            {(["nao_testado", "aprendendo", "dominando"] as const).map((n) => (
              <li key={n} className="flex items-center gap-1.5"><span className="w-5"><Celula nivel={n} nome="" tema="" /></span>{NIVEL_LABEL[n]}</li>
            ))}
          </ul>
        </div>
      )}
    </AdminListDetail>
  );
}

// ---------------------------------------------------------------------------
// Banco de exercícios
// ---------------------------------------------------------------------------

const BANCO_KEY = ["admin-banco-exercicios"] as const;

function StatusPill({ e }: { e: ExercicioAdmin }) {
  return e.status === "rascunho" ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold px-2.5 py-0.5 text-[12.5px] font-semibold text-gold-text">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />{STATUS_LABEL.rascunho}
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-ink px-2.5 py-0.5 text-[12.5px] font-semibold text-ink">{STATUS_LABEL[e.status]}</span>
  );
}

export function BancoExerciciosTab() {
  const fn = useServerFn(adminListExercicios);
  const gerarFn = useServerFn(adminGerarRascunhos);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: BANCO_KEY, queryFn: () => fn({}) });
  const [selId, setSelId] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [g, setG] = useState<{ tema_id: string; tipo: TipoExercicio; quantidade: number }>({ tema_id: "", tipo: "multipla_escolha", quantidade: 3 });
  const lista = q.data?.exercicios ?? [];
  const temas = q.data?.temas ?? [];
  const sel = lista.find((e) => e.id === selId) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: BANCO_KEY }).then(() => qc.invalidateQueries({ queryKey: ["admin-pending-counts"] }));

  const gerar = useMutation({
    mutationFn: () => gerarFn({ data: { tema_id: g.tema_id || temas[0]?.id, tipo: g.tipo, quantidade: g.quantidade } }),
    onSuccess: (r) => {
      if (r.criados > 0) { toast.success(`${r.criados} ${r.criados === 1 ? "rascunho criado" : "rascunhos criados"}. Revise antes de aprovar.`); setGerando(false); refresh(); }
      else toast.error(r.mensagem ?? "Nenhum rascunho criado.");
    },
    onError: erro,
  });

  return (
    <AdminListDetail
      title="Banco de exercícios"
      subtitle="A IA propõe rascunhos por tema. Nenhum cartão chega à equipe sem a sua aprovação."
      actions={<OutlineButton className="h-9 px-3 text-[14px]" onClick={() => setGerando((v) => !v)}><Plus className="h-4 w-4" strokeWidth={1.5} /> Gerar rascunhos para um tema</OutlineButton>}
      panel={sel ? <PainelExercicio key={sel.id} e={sel} onFechar={() => setSelId(null)} onMudou={refresh} onSaiu={() => setSelId(null)} /> : <PanelEmpty>Escolha um exercício na lista.</PanelEmpty>}
    >
      {gerando && (
        <div className="mb-3 rounded-lg border border-line-strong p-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>Tema</FieldLabel>
              <select className={inputCls} value={g.tema_id || temas[0]?.id || ""} onChange={(e) => setG({ ...g, tema_id: e.target.value })}>
                {temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Tipo</FieldLabel>
              <select className={inputCls} value={g.tipo} onChange={(e) => setG({ ...g, tipo: e.target.value as TipoExercicio })}>
                {TIPOS_EXERCICIO.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Quantos</FieldLabel>
              <input type="number" min={1} max={5} className={inputCls} value={g.quantidade} onChange={(e) => setG({ ...g, quantidade: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} />
            </div>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-muted">A IA usa só o que está no Cérebro e na base de conhecimento. Sem fato disponível, ela não gera.</p>
          <div className="mt-2 flex items-center gap-3">
            <GoldButton className="h-9 px-4 text-[14px]" disabled={gerar.isPending || !temas.length} onClick={() => gerar.mutate()}>{gerar.isPending ? "Gerando…" : "Gerar rascunhos"}</GoldButton>
            <button type="button" className="text-[13.5px] text-ink-muted hover:text-ink" onClick={() => setGerando(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {q.isLoading && <p className="py-6 text-[14px] text-ink-muted">Carregando…</p>}
      {q.isError && <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar o banco agora. Tente de novo.</p>}
      {q.data && lista.length === 0 && <PanelEmpty>Ainda não há exercícios. Gere rascunhos para um tema.</PanelEmpty>}
      <div className="border-t border-line">
        {lista.map((e) => (
          <ListRow key={e.id} active={e.id === selId} onClick={() => setSelId(e.id)}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-ink">{e.tema_nome}</p>
              <p className="truncate text-[13px] text-ink-muted">{TIPO_LABEL[e.tipo]} · {e.titulo || e.contexto || e.pergunta}</p>
            </div>
            <StatusPill e={e} />
          </ListRow>
        ))}
      </div>
    </AdminListDetail>
  );
}

function PainelExercicio({ e, onFechar, onMudou, onSaiu }: { e: ExercicioAdmin; onFechar: () => void; onMudou: () => void; onSaiu: () => void }) {
  const salvarFn = useServerFn(adminSalvarExercicio);
  const descartarFn = useServerFn(adminDescartarExercicio);
  const [d, setD] = useState(e);
  useEffect(() => setD(e), [e]);
  const set = (p: Partial<ExercicioAdmin>) => setD((x) => ({ ...x, ...p }));
  const setAlt = (i: number, texto: string) => set({ alternativas: d.alternativas.map((a, j) => (j === i ? { ...a, texto } : a)) });
  const marcar = (i: number) => set({ alternativas: d.alternativas.map((a, j) => ({ ...a, correta: j === i })) });

  const salvar = useMutation({
    mutationFn: (acao: "salvar" | "aprovar") => salvarFn({ data: {
      id: d.id, titulo: d.titulo, pergunta: d.pergunta, contexto: d.contexto,
      alternativas: d.alternativas.filter((a) => a.texto.trim()), resposta_aprovada: d.resposta_aprovada,
      habito_chave: d.habito_chave, explicacao: d.explicacao, fonte: d.fonte, acao,
    } }),
    onSuccess: (r, acao) => {
      if (!r.ok) return toast.error(r.mensagem);
      toast.success(acao === "aprovar" ? "Aprovado. Já pode entrar nos cartões da equipe." : "Edição salva.");
      onMudou();
      if (acao === "aprovar") onSaiu();
    },
    onError: erro,
  });
  const descartar = useMutation({
    mutationFn: () => descartarFn({ data: { id: d.id } }),
    onSuccess: () => { toast.success("Exercício descartado."); onMudou(); onSaiu(); },
    onError: erro,
  });
  const ocupado = salvar.isPending || descartar.isPending;
  const overline = [d.status === "rascunho" ? (d.criado_por === "ia" ? "Rascunho da IA" : "Rascunho") : STATUS_LABEL[d.status], d.tema_nome, TIPO_LABEL[d.tipo]].join(" · ");

  return (
    <div>
      <PanelHeader overline={overline} title={d.titulo || "Sem título"} onClose={onFechar} />
      <FieldLabel>Título</FieldLabel>
      <input className={inputCls} value={d.titulo} maxLength={120} onChange={(x) => set({ titulo: x.target.value })} />

      {d.tipo !== "multipla_escolha" && (
        <>
          <FieldLabel>{d.tipo === "escrita" ? "Fala do cliente" : "Mensagem para melhorar"}</FieldLabel>
          <textarea rows={2} className={cn(inputCls, "resize-y")} value={d.contexto} maxLength={400} onChange={(x) => set({ contexto: x.target.value })} />
        </>
      )}
      <FieldLabel>Pergunta</FieldLabel>
      <textarea rows={2} className={cn(inputCls, "resize-y")} value={d.pergunta} maxLength={800} onChange={(x) => set({ pergunta: x.target.value })} />

      {d.tipo === "multipla_escolha" && (
        <>
          <FieldLabel>Alternativas (marque a certa)</FieldLabel>
          <ul className="space-y-2">
            {d.alternativas.map((a, i) => (
              <li key={i} className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5", a.correta ? "border-gold" : "border-line-strong")}>
                <input type="radio" name="correta" checked={a.correta} onChange={() => marcar(i)} aria-label={`Alternativa ${i + 1} é a certa`} className="h-4 w-4 accent-[var(--gold,#B8872E)]" />
                <input value={a.texto} maxLength={300} onChange={(x) => setAlt(i, x.target.value)} className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none" aria-label={`Texto da alternativa ${i + 1}`} />
                <button type="button" aria-label="Remover alternativa" onClick={() => set({ alternativas: d.alternativas.filter((_, j) => j !== i) })} className="text-ink-muted hover:text-ink"><Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
              </li>
            ))}
          </ul>
          {d.alternativas.length < 5 && (
            <button type="button" className="mt-2 text-[13.5px] text-ink-muted hover:text-ink" onClick={() => set({ alternativas: [...d.alternativas, { texto: "", correta: false }] })}>+ Alternativa</button>
          )}
        </>
      )}

      {d.tipo === "habito" && (
        <>
          <FieldLabel>Hábito de escrita</FieldLabel>
          <select className={inputCls} value={d.habito_chave ?? ""} onChange={(x) => set({ habito_chave: x.target.value || null })}>
            <option value="">Escolha…</option>
            {HABITO_CHAVES.map((c) => <option key={c} value={c}>{HABITOS[c].titulo}</option>)}
          </select>
        </>
      )}

      {d.tipo !== "multipla_escolha" && (
        <>
          <FieldLabel>Resposta aprovada</FieldLabel>
          <textarea rows={3} className={cn(inputCls, "resize-y")} value={d.resposta_aprovada} maxLength={1000} onChange={(x) => set({ resposta_aprovada: x.target.value })} />
        </>
      )}

      <FieldLabel>{d.tipo === "multipla_escolha" ? "Por que esta é a certa (aparece depois da resposta)" : "O que a boa resposta faz"}</FieldLabel>
      <textarea rows={2} className={cn(inputCls, "resize-y")} value={d.explicacao} maxLength={800} onChange={(x) => set({ explicacao: x.target.value })} />
      <FieldLabel>Fonte</FieldLabel>
      <input className={inputCls} value={d.fonte} maxLength={200} onChange={(x) => set({ fonte: x.target.value })} />
      <p className="mt-2 text-[12.5px] leading-5 text-ink-muted">Confira valores e regras de produto antes de aprovar. A IA só usa o que está no Cérebro e na base de conhecimento.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {d.status === "rascunho" && <GoldButton className="h-10 px-4 text-[14px]" disabled={ocupado} onClick={() => salvar.mutate("aprovar")}>Aprovar</GoldButton>}
        <OutlineButton className="h-10 px-4 text-[14px]" disabled={ocupado} onClick={() => salvar.mutate("salvar")}>Salvar edição</OutlineButton>
        <DeleteLink
          label="Descartar"
          onConfirm={() => descartar.mutate()}
          title="Descartar este exercício?"
          description={d.status === "rascunho" ? "O rascunho some do banco." : "O exercício sai dos cartões da equipe. As respostas já dadas continuam valendo."}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aquecimento (adesão, avisos, limite e temas)
// ---------------------------------------------------------------------------

const AQ_KEY = ["admin-aquecimento"] as const;

export function AquecimentoAdminTab() {
  const fn = useServerFn(adminAquecimento);
  const salvarFn = useServerFn(adminSalvarAquecimento);
  const temaFn = useServerFn(adminSalvarTema);
  const ordemFn = useServerFn(adminReordenarTemas);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: AQ_KEY, queryFn: () => fn({}) });
  const d = q.data;
  const [horarios, setHorarios] = useState<string[]>([]);
  const [limite, setLimite] = useState("5");
  const [temaSel, setTemaSel] = useState<string | "novo" | null>(null);
  const [tema, setTema] = useState({ nome: "", descricao: "", ativo: true });

  useEffect(() => {
    if (!d) return;
    setHorarios(d.horarios);
    setLimite(String(d.limite_diario ?? 5));
  }, [d]);

  const sujo = !!d && (JSON.stringify(horarios) !== JSON.stringify(d.horarios) || limite !== String(d.limite_diario ?? 5));
  const refresh = () => qc.invalidateQueries({ queryKey: AQ_KEY });

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { horarios, limite_diario: Math.max(1, Number(limite) || 5) } }),
    onSuccess: () => { toast.success("Salvo."); refresh(); qc.invalidateQueries({ queryKey: ["aquecimento-status"] }); },
    onError: (e) => erro(e instanceof Error && e.message.includes("HH:MM") ? new Error("Use o formato HH:MM nos horários, como 08:30.") : e),
  });
  const salvarTema = useMutation({
    mutationFn: () => temaFn({ data: { id: temaSel && temaSel !== "novo" ? temaSel : null, ...tema } }),
    onSuccess: () => { toast.success("Tema salvo."); setTemaSel(null); refresh(); qc.invalidateQueries({ queryKey: ["meu-mapa"] }); },
    onError: erro,
  });
  const reordenar = useMutation({
    mutationFn: (ids: string[]) => ordemFn({ data: { ids } }),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["meu-mapa"] }); },
    onError: erro,
  });
  const mover = (id: string, dir: -1 | 1) => {
    if (!d) return;
    const ids = d.temas.map((t) => t.id);
    const i = ids.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reordenar.mutate(ids);
  };
  const abrirTema = (t: NonNullable<typeof d>["temas"][number] | null) => {
    if (!t) { setTemaSel("novo"); setTema({ nome: "", descricao: "", ativo: true }); return; }
    setTemaSel(t.id); setTema({ nome: t.nome, descricao: t.descricao, ativo: t.ativo });
  };

  return (
    <AdminListDetail
      title="Aquecimento"
      subtitle="Adesão da equipe nesta semana: dias em que cada pessoa fez o aquecimento."
      panel={
        <div>
          <p className="type-overline text-ink-muted">Avisos do dia</p>
          <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink">Notificações do Chrome</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {horarios.map((h, i) => (
              <div key={i}>
                <FieldLabel>{i + 1}º aviso</FieldLabel>
                <input type="time" className={inputCls} value={h} onChange={(x) => setHorarios(horarios.map((v, j) => (j === i ? x.target.value : v)))} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] leading-5 text-ink-muted">Cada aviso só chega a quem ainda não fez o aquecimento do dia, com a Omnia aberta. Cada pessoa pode desligar a notificação.</p>

          <FieldLabel>Limite de correções por IA</FieldLabel>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={200} className={cn(inputCls, "w-24")} value={limite} onChange={(x) => setLimite(x.target.value)} aria-label="Correções por IA por dia" />
            <span className="text-[14px] text-ink-muted">por dia</span>
          </div>

          <FieldLabel>Temas de domínio</FieldLabel>
          <ul className="space-y-1.5">
            {(d?.temas ?? []).map((t, i) => (
              <li key={t.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => abrirTema(t)}
                  className={cn("rounded-full border px-3 py-1 text-[13.5px] font-medium", t.id === temaSel ? "border-gold bg-surface-2" : "border-ink", !t.ativo && "border-dashed text-ink-muted")}
                >
                  {t.nome}{!t.ativo && " (desativado)"}
                </button>
                <button type="button" aria-label={`Subir ${t.nome}`} disabled={i === 0 || reordenar.isPending} onClick={() => mover(t.id, -1)} className="text-ink-muted hover:text-ink disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5 rotate-90" strokeWidth={1.5} /></button>
                <button type="button" aria-label={`Descer ${t.nome}`} disabled={i === (d?.temas.length ?? 0) - 1 || reordenar.isPending} onClick={() => mover(t.id, 1)} className="text-ink-muted hover:text-ink disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5 rotate-90" strokeWidth={1.5} /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => abrirTema(null)} className="mt-2 rounded-full border border-dashed border-line-strong px-3 py-1 text-[13.5px] text-ink-muted hover:text-ink">+ Novo tema</button>

          {temaSel && (
            <div className="mt-3 rounded-lg border border-line-strong p-3">
              <FieldLabel>Nome do tema</FieldLabel>
              <input className={inputCls} value={tema.nome} maxLength={60} onChange={(x) => setTema({ ...tema, nome: x.target.value })} />
              <FieldLabel>Descrição</FieldLabel>
              <input className={inputCls} value={tema.descricao} maxLength={200} onChange={(x) => setTema({ ...tema, descricao: x.target.value })} />
              <label className="mt-3 flex items-center gap-2 text-[14px] text-ink">
                <input type="checkbox" checked={tema.ativo} onChange={(x) => setTema({ ...tema, ativo: x.target.checked })} className="h-4 w-4 accent-[var(--gold,#B8872E)]" /> Tema ativo
              </label>
              <div className="mt-3 flex items-center gap-3">
                <GoldButton className="h-9 px-4 text-[14px]" disabled={salvarTema.isPending || !tema.nome.trim()} onClick={() => salvarTema.mutate()}>Salvar tema</GoldButton>
                <button type="button" className="text-[13.5px] text-ink-muted hover:text-ink" onClick={() => setTemaSel(null)}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <GoldButton className="h-10 px-4 text-[14px]" disabled={!sujo || salvar.isPending} onClick={() => salvar.mutate()}>Salvar</GoldButton>
            <OutlineButton className="h-10 px-4 text-[14px]" disabled={!sujo} onClick={() => { if (d) { setHorarios(d.horarios); setLimite(String(d.limite_diario ?? 5)); } }}>Cancelar</OutlineButton>
          </div>
        </div>
      }
    >
      {q.isLoading && <p className="py-6 text-[14px] text-ink-muted">Carregando…</p>}
      {q.isError && <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar agora. Tente de novo.</p>}
      {d && d.adesao.length === 0 && <PanelEmpty>Nenhum atendente cadastrado.</PanelEmpty>}
      {d && d.adesao.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="py-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Atendente</th>
              <th scope="col" className="py-2 text-right text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Dias na semana</th>
            </tr>
          </thead>
          <tbody>
            {d.adesao.map((a) => (
              <tr key={a.id} className="border-b border-line">
                <td className="py-2.5 text-[14.5px] text-ink">{a.nome}</td>
                <td className="py-2.5 text-right text-[14.5px] tabular-nums text-ink">{a.dias} de 5</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-[13px] text-ink-muted">O atendente sabe que você vê a adesão. Faltar não gera cobrança automática.</p>
    </AdminListDetail>
  );
}
