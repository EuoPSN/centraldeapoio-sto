import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getExtensaoAdmin, salvarExtensaoConfig } from "@/lib/extensao-admin.functions";
import {
  DIAS_SEMANA, PERIODOS_EXTENSAO, descreverHorario, fmtMinSeg, horaValida,
  type ConfigExtensao, type Horario, type PeriodoExtensao,
} from "@/lib/extensao-admin";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { AdminListDetail, FieldLabel, FilterPill, inputCls } from "@/components/admin/AdminListDetail";
import { BaixarInteligenciaAdmin } from "@/components/copiloto/BaixarInteligencia";

const DADOS_KEY = ["admin-extensao"] as const;

interface Rascunho { meta: string; nova: string; horario: Horario }
const doBanco = (c: ConfigExtensao): Rascunho => ({ meta: String(c.meta_minutos), nova: String(c.nova_conversa_horas), horario: JSON.parse(JSON.stringify(c.horario)) });

/** Admin > Extensão do WhatsApp. Números por atendente (nunca conteúdo, nome nem telefone de cliente). */
export function ExtensaoAdminTab() {
  const qc = useQueryClient();
  const dadosFn = useServerFn(getExtensaoAdmin);
  const salvarFn = useServerFn(salvarExtensaoConfig);
  const [periodo, setPeriodo] = useState<PeriodoExtensao>("semana");
  const q = useQuery({ queryKey: [...DADOS_KEY, periodo], queryFn: () => dadosFn({ data: { periodo } }) });
  const dados = q.data;

  const [draft, setDraft] = useState<Rascunho | null>(null);
  useEffect(() => { if (dados) setDraft((d) => d ?? doBanco(dados.config)); }, [dados]);

  const salvar = useMutation({
    mutationFn: (d: Rascunho) => salvarFn({
      data: {
        meta_minutos: Math.max(1, Math.min(240, Math.round(Number(d.meta) || 5))),
        nova_conversa_horas: Math.max(1, Math.min(168, Math.round(Number(d.nova) || 12))),
        horario: d.horario,
      },
    }),
    onSuccess: () => {
      toast.success("Configurações salvas. A extensão usa os novos valores em alguns minutos.");
      setDraft(null);
      qc.invalidateQueries({ queryKey: DADOS_KEY });
      qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui salvar."),
  });

  const setFaixa = (chave: string, campo: "de" | "ate", valor: string) => {
    if (!draft) return;
    const atual = draft.horario[chave]?.[0] ?? { de: "08:00", ate: "18:00" };
    setDraft({ ...draft, horario: { ...draft.horario, [chave]: [{ ...atual, [campo]: valor }] } });
  };
  const alternarDia = (chave: string, aberto: boolean) => {
    if (!draft) return;
    setDraft({ ...draft, horario: { ...draft.horario, [chave]: aberto ? [{ de: "08:00", ate: "18:00" }] : [] } });
  };

  const horarioOk = !!draft && Object.values(draft.horario).every((fs) => fs.every((f) => horaValida(f.de) && horaValida(f.ate) && f.ate > f.de));

  const painel = !draft || !dados ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : (
    <div>
      <p className="type-overline text-ink-muted">Configurações</p>
      <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink">Tempo de resposta</h3>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="ext-meta">Meta de 1ª resposta (min)</FieldLabel>
          <input id="ext-meta" type="number" min={1} max={240} className={inputCls} value={draft.meta} onChange={(e) => setDraft({ ...draft, meta: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="ext-nova">Conversa nova após (horas)</FieldLabel>
          <input id="ext-nova" type="number" min={1} max={168} className={inputCls} value={draft.nova} onChange={(e) => setDraft({ ...draft, nova: e.target.value })} />
        </div>
      </div>

      <FieldLabel>Horário de atendimento</FieldLabel>
      <ul className="space-y-1.5">
        {DIAS_SEMANA.map((d) => {
          const faixa = draft.horario[d.chave]?.[0];
          return (
            <li key={d.chave} className="grid grid-cols-[88px_1fr_1fr] items-center gap-2 text-[14px]">
              <label className="flex items-center gap-2 text-ink">
                <input type="checkbox" checked={!!faixa} onChange={(e) => alternarDia(d.chave, e.target.checked)} /> {d.nome}
              </label>
              {faixa ? (
                <>
                  <input type="time" aria-label={`${d.nome}: início`} className={inputCls} value={faixa.de} onChange={(e) => setFaixa(d.chave, "de", e.target.value)} />
                  <input type="time" aria-label={`${d.nome}: fim`} className={inputCls} value={faixa.ate} onChange={(e) => setFaixa(d.chave, "ate", e.target.value)} />
                </>
              ) : <span className="col-span-2 text-ink-muted">Fechado</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12.5px] text-ink-muted">{descreverHorario(draft.horario)} · fuso de Brasília. Só o tempo dentro do horário conta.</p>
      {!horarioOk && <p className="mt-1 text-[12.5px] text-ink">Confira os horários: o fim precisa vir depois do início.</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <GoldButton className="h-9 text-[14px]" onClick={() => salvar.mutate(draft)} disabled={salvar.isPending || !horarioOk}>Salvar</GoldButton>
        <OutlineButton className="h-9 text-[14px]" onClick={() => setDraft(doBanco(dados.config))}>Cancelar</OutlineButton>
      </div>
    </div>
  );

  const linhas = dados?.linhas ?? [];
  const equipe = dados?.equipe;
  const meta = dados?.config.meta_minutos ?? 5;

  return (
    <AdminListDetail
      title="Extensão do WhatsApp"
      subtitle="Números por atendente. Nunca mostra conversa, nome nem telefone de cliente."
      filters={PERIODOS_EXTENSAO.map((p) => <FilterPill key={p.id} active={periodo === p.id} onClick={() => setPeriodo(p.id)}>{p.rotulo}</FilterPill>)}
      panel={painel}
    >
      {q.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : q.isError ? (
        <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar os números agora. Se as migrações da extensão ainda não rodaram, rode-as no SQL editor.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-t border-line text-[14px]">
              <thead>
                <tr className="text-left text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  <th scope="col" className="py-2.5 pr-2">Atendente</th>
                  <th scope="col" className="py-2.5 pr-2 text-right">Tickets criados</th>
                  <th scope="col" className="py-2.5 pr-2 text-right">Atualizados</th>
                  <th scope="col" className="py-2.5 pr-2 text-right">1ª resposta (média)</th>
                  <th scope="col" className="py-2.5 pr-2 text-right">Ignorados</th>
                  <th scope="col" className="py-2.5 text-right">Pausou</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 && <tr><td colSpan={6} className="py-6 text-ink-muted">Nenhum atendente para mostrar.</td></tr>}
                {linhas.map((l) => (
                  <tr key={l.user_id} className="border-t border-line">
                    <td className="py-2.5 pr-2 text-ink">{l.nome}</td>
                    {l.instalou ? (
                      <>
                        <td className="py-2.5 pr-2 text-right tabular-nums text-ink">{l.tickets_criados}</td>
                        <td className="py-2.5 pr-2 text-right tabular-nums text-ink">{l.atualizados}</td>
                        <td className={`py-2.5 pr-2 text-right tabular-nums ${l.resposta_media != null && l.resposta_media > meta ? "font-semibold text-gold-text" : "text-ink"}`}>{fmtMinSeg(l.resposta_media)}</td>
                        <td className="py-2.5 pr-2 text-right tabular-nums text-ink">{l.ignorados}</td>
                        <td className="py-2.5 text-right tabular-nums text-ink">{l.pausas > 0 ? `${l.pausas}×` : "—"}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 pr-2 text-right text-ink-muted">—</td><td className="py-2.5 pr-2 text-right text-ink-muted">—</td>
                        <td className="py-2.5 pr-2 text-right text-ink-muted">—</td><td className="py-2.5 pr-2 text-right text-ink-muted">—</td>
                        <td className="py-2.5 text-right text-ink-muted">Não instalou</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {equipe && (
            <p className="mt-3 text-[13px] leading-5 text-ink-muted">
              Equipe: 1ª resposta média {fmtMinSeg(equipe.media_minutos)}, meta {meta} min · {equipe.ativos} de {equipe.total} pessoas com a extensão ativa.
            </p>
          )}
          <div className="mt-4"><BaixarInteligenciaAdmin /></div>
        </>
      )}
    </AdminListDetail>
  );
}
