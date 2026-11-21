import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminExcluirFicha, adminListAutores, adminListFichas, adminSalvarFicha, type FichaAdmin } from "@/lib/biblioteca.functions";
import {
  PLANOS_FICHA, STATUS_FICHA_LABEL, dataCurta, diasLabel, type PlanoFicha, type StatusFicha,
} from "@/lib/biblioteca";
import { PONTOS, PONTO_LABEL, type Ponto } from "@/lib/retomada";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { Overline, useClienteDisseBase } from "@/components/cliente-disse/shared";
import { EnviarConversaDialog } from "@/components/biblioteca/EnviarConversaDialog";
import { AdminListDetail, DeleteLink, FieldLabel, FilterPill, ListRow, PanelEmpty, PanelHeader, inputCls } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";

const KEY = ["admin-fichas"] as const;
const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não consegui salvar agora.");
type Filtro = "enviada" | "publicada" | "recusada";
const FILTRO_LABEL: Record<Filtro, string> = { enviada: "Novas", publicada: "Publicadas", recusada: "Recusadas" };

export function ConversasEnviadasAdminTab() {
  const fn = useServerFn(adminListFichas);
  const q = useQuery({ queryKey: KEY, queryFn: () => fn({}) });
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("enviada");
  const [selId, setSelId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const todas = q.data ?? [];
  const lista = todas.filter((f) => f.status === filtro);
  const novas = todas.filter((f) => f.status === "enviada").length;
  const sel = todas.find((f) => f.id === selId) ?? null;

  return (
    <>
      <AdminListDetail
        title="Conversas enviadas"
        subtitle="Fichas que os atendentes enviaram ao clicar Fechou. Revise antes de publicar."
        actions={<OutlineButton className="h-9 px-3.5 text-[14px]" onClick={() => setEnviando(true)}>+ Enviar conversa</OutlineButton>}
        filters={(Object.keys(FILTRO_LABEL) as Filtro[]).map((f) => (
          <FilterPill key={f} active={filtro === f} onClick={() => { setFiltro(f); setSelId(null); }}>
            {FILTRO_LABEL[f]}{f === "enviada" && novas > 0 ? ` · ${novas}` : ""}
          </FilterPill>
        ))}
        panel={sel ? <Painel key={sel.id} f={sel} onFechar={() => setSelId(null)} onMudou={() => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ["admin-pending-counts"] }); }} onSaiu={() => setSelId(null)} /> : <PanelEmpty>Escolha uma conversa para revisar.</PanelEmpty>}
      >
        {q.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : q.isError ? (
          <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar as conversas agora. Confira se as migrações da Fase B foram aplicadas.</p>
        ) : lista.length === 0 ? (
          <p className="py-6 text-[14px] text-ink-muted">{filtro === "enviada" ? "Nenhuma conversa nova para revisar." : `Nenhuma conversa ${FILTRO_LABEL[filtro].toLowerCase()}.`}</p>
        ) : (
          <div className="border-t border-line">
            {lista.map((f) => (
              <ListRow key={f.id} active={f.id === selId} onClick={() => setSelId(f.id)} trailing={<StatusPill status={f.status} />}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{f.autor_nome || "Atendente"}</span>
                  <span className="block truncate text-[13px] text-ink-muted">
                    {[f.objecao_rotulo, PONTO_LABEL[f.ponto_parada], f.fechou_em && `Fechou em ${dataCurta(f.fechou_em)}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </ListRow>
            ))}
          </div>
        )}
      </AdminListDetail>

      <EnviarConversaDialog open={enviando} onOpenChange={setEnviando} atendente="" comoAdmin onEnviada={() => { setFiltro("enviada"); }} />
    </>
  );
}

function StatusPill({ status }: { status: StatusFicha }) {
  if (status === "enviada") {
    return <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold px-2.5 py-0.5 text-[12.5px] font-semibold text-gold-text"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />{STATUS_FICHA_LABEL.enviada}</span>;
  }
  return <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-ink px-2.5 py-0.5 text-[12.5px] font-semibold text-ink">{STATUS_FICHA_LABEL[status]}</span>;
}

function Painel({ f, onFechar, onMudou, onSaiu }: { f: FichaAdmin; onFechar: () => void; onMudou: () => void; onSaiu: () => void }) {
  const salvarFn = useServerFn(adminSalvarFicha);
  const excluirFn = useServerFn(adminExcluirFicha);
  const autoresFn = useServerFn(adminListAutores);
  const base = useClienteDisseBase();
  const autores = useQuery({ queryKey: ["biblioteca-autores"], queryFn: () => autoresFn({}), staleTime: 60_000 });
  const [d, setD] = useState({ ...f, o_que_fez: [...f.o_que_fez] });
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState(f.motivo_recusa ?? "");
  useEffect(() => { setD({ ...f, o_que_fez: [...f.o_que_fez] }); }, [f]);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));
  const objecoes = base.data?.objecoes ?? [];

  const salvar = useMutation({
    mutationFn: (acao: "salvar" | "publicar" | "recusar" | "despublicar") => salvarFn({ data: {
      id: f.id, acao, autor_id: d.autor_id, titulo: d.titulo, motivo_recusa: acao === "recusar" ? motivo : null,
      ficha: {
        objecao_id: d.objecao_id, objecao_rotulo: d.objecao_rotulo, ponto_parada: d.ponto_parada, plano: d.plano,
        perfil_cliente: d.perfil_cliente, onde_travou: d.onde_travou, o_que_fez: d.o_que_fez.map((x) => x.trim()).filter(Boolean),
        mensagem_chave: d.mensagem_chave, por_que_funcionou: d.por_que_funcionou, dias_ate_fechar: d.dias_ate_fechar, fechou_em: d.fechou_em,
      },
    } }),
    onSuccess: (r, acao) => {
      if (!r.ok) return toast.error(r.mensagem);
      toast.success({ salvar: "Edição salva.", publicar: "Publicada na biblioteca. Entrou em Novidades.", recusar: "Recusada. O atendente vê o motivo no ticket.", despublicar: "Voltou para as novas." }[acao]);
      setRecusando(false);
      onMudou();
      if (acao !== "salvar") onSaiu();
    },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: () => excluirFn({ data: { id: f.id } }),
    onSuccess: () => { toast.success("Ficha excluída."); onMudou(); onSaiu(); },
    onError: erro,
  });

  const ocupado = salvar.isPending || excluir.isPending;
  const overline = [`Enviada por ${f.autor_nome || "atendente"}`, f.fechou_em && `Fechou em ${dataCurta(f.fechou_em)}`, f.dias_ate_fechar != null && (f.dias_ate_fechar === 0 ? "no mesmo dia" : `${f.dias_ate_fechar} ${f.dias_ate_fechar === 1 ? "dia" : "dias"} para fechar`)].filter(Boolean).join(" · ");

  return (
    <div>
      <PanelHeader overline={overline} title={d.titulo || "Sem título"} onClose={onFechar} />
      {f.status === "publicada" && (
        <p className="-mt-2 mb-3 text-[13px] text-ink-muted">Publicada{f.publicada_em ? ` em ${dataCurta(f.publicada_em)}` : ""} · 👍 {f.uteis} · 👎 {f.nao_uteis}. Edite ou despublique abaixo.</p>
      )}
      {f.status === "recusada" && f.motivo_recusa && <p className="-mt-2 mb-3 text-[13px] text-ink-muted">Recusada: {f.motivo_recusa}</p>}

      <FieldLabel>Título</FieldLabel>
      <input className={inputCls} value={d.titulo} maxLength={160} onChange={(e) => set({ titulo: e.target.value })} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Objeção</FieldLabel>
          <select className={inputCls} value={d.objecao_id ?? ""} onChange={(e) => {
            const o = objecoes.find((x) => x.id === e.target.value);
            set(o ? { objecao_id: o.id, objecao_rotulo: o.nome } : { objecao_id: null });
          }}>
            <option value="">{d.objecao_rotulo ? `${d.objecao_rotulo} (sem vínculo)` : "Nenhuma"}</option>
            {objecoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Parou em</FieldLabel>
          <select className={inputCls} value={d.ponto_parada} onChange={(e) => set({ ponto_parada: e.target.value as Ponto })}>
            {PONTOS.map((p) => <option key={p} value={p}>{PONTO_LABEL[p]}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Plano</FieldLabel>
          <select className={inputCls} value={d.plano} onChange={(e) => set({ plano: e.target.value as PlanoFicha })}>
            {PLANOS_FICHA.map((p) => <option key={p} value={p}>{p === "outro" ? "Outro" : p}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Perfil</FieldLabel>
          <input className={inputCls} value={d.perfil_cliente} maxLength={160} onChange={(e) => set({ perfil_cliente: e.target.value })} />
        </div>
      </div>

      <FieldLabel>Onde travou</FieldLabel>
      <textarea rows={2} className={cn(inputCls, "resize-y")} value={d.onde_travou} onChange={(e) => set({ onde_travou: e.target.value })} />
      <FieldLabel>O que a vendedora fez (um passo por linha)</FieldLabel>
      <textarea rows={4} className={cn(inputCls, "resize-y")} value={d.o_que_fez.join("\n")} onChange={(e) => set({ o_que_fez: e.target.value.split("\n") })} />
      <FieldLabel>Mensagem-chave</FieldLabel>
      <textarea rows={3} className={cn(inputCls, "resize-y")} value={d.mensagem_chave} onChange={(e) => set({ mensagem_chave: e.target.value })} />
      <FieldLabel>Por que funcionou</FieldLabel>
      <textarea rows={2} className={cn(inputCls, "resize-y")} value={d.por_que_funcionou} onChange={(e) => set({ por_que_funcionou: e.target.value })} />

      <FieldLabel>Autor da ficha</FieldLabel>
      <select className={inputCls} value={d.autor_id} onChange={(e) => set({ autor_id: e.target.value })}>
        {!(autores.data ?? []).some((a) => a.id === d.autor_id) && <option value={d.autor_id}>{f.autor_nome || "Atendente"}</option>}
        {(autores.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
      </select>

      <p className="mt-3 text-[12.5px] leading-5 text-ink-muted">Checagem automática: sem telefone, CPF, e-mail ou nome de cliente na ficha. O arquivo .txt da conversa já foi descartado.</p>
      {diasLabel(d.dias_ate_fechar) && <p className="text-[12.5px] text-ink-muted">{diasLabel(d.dias_ate_fechar)} (calculado pelas datas da conversa).</p>}

      {recusando ? (
        <div className="mt-4 rounded-lg border border-line-strong p-3">
          <Overline className="mb-1 text-ink-muted">Motivo da recusa (o atendente vê no ticket)</Overline>
          <input className={inputCls} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} autoFocus />
          <div className="mt-2 flex gap-2">
            <OutlineButton className="h-9 px-3 text-[14px]" disabled={ocupado || !motivo.trim()} onClick={() => salvar.mutate("recusar")}>Recusar ficha</OutlineButton>
            <button type="button" className="text-[13.5px] text-ink-muted hover:text-ink" onClick={() => setRecusando(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {f.status !== "publicada" && <GoldButton className="h-10 px-4 text-[14px]" disabled={ocupado} onClick={() => salvar.mutate("publicar")}>Aprovar e publicar</GoldButton>}
          <OutlineButton className="h-10 px-4 text-[14px]" disabled={ocupado} onClick={() => salvar.mutate("salvar")}>Salvar edição</OutlineButton>
          {f.status === "publicada" && <OutlineButton className="h-10 px-4 text-[14px]" disabled={ocupado} onClick={() => salvar.mutate("despublicar")}>Despublicar</OutlineButton>}
          {f.status !== "recusada" && <OutlineButton className="h-10 px-4 text-[14px]" disabled={ocupado} onClick={() => setRecusando(true)}>Recusar</OutlineButton>}
          <span className="ml-auto"><DeleteLink onConfirm={() => excluir.mutate()} title="Excluir esta ficha?" description="A ficha some da biblioteca e dos relatórios. Não dá para desfazer." /></span>
        </div>
      )}
    </div>
  );
}
