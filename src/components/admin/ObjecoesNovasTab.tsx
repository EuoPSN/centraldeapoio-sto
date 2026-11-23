import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListPendentes, aprovarPendente, recusarPendente, salvarRascunhoPendente, sugerirRespostaObjecao, type PendenteAdmin } from "@/lib/cliente-disse.functions";
import { objecaoVazia, type ObjecaoConteudo } from "@/lib/cliente-disse";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { BASE_KEY } from "@/components/cliente-disse/shared";
import { AdminListDetail, DeleteLink, ListRow, PanelEmpty, fmtDia } from "@/components/admin/AdminListDetail";
import { erro, ObjecaoForm } from "@/components/admin/cliente-disse-shared";


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
