import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminDescartarExercicio, adminGerarRascunhos, adminListExercicios, adminSalvarExercicio, type ExercicioAdmin } from "@/lib/aquecimento-admin.functions";
import { HABITOS, HABITO_CHAVES, STATUS_LABEL, TIPOS_EXERCICIO, TIPO_LABEL, type TipoExercicio } from "@/lib/aquecimento";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { AdminListDetail, DeleteLink, FieldLabel, ListRow, PanelEmpty, PanelHeader, inputCls } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";
import { erro } from "@/components/admin/aquecimento-shared";


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
