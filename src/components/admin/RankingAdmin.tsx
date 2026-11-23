import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  adminRankingLista, getRankingAdminConfig, salvarRankingAdminConfig, type RankingAdminConfig,
} from "@/lib/ranking.functions";
import { fmtValor, nomeDoMes, PODIOS, PODIO_TITULO, type Podio } from "@/lib/ranking";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { AdminListDetail, FieldLabel, FilterPill, inputCls } from "@/components/admin/AdminListDetail";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const CONFIG_KEY = ["admin-ranking-config"] as const;

/** Rótulos das colunas "valor" e "total" de cada pódio. */
const COLUNAS: Record<Podio, { valor: string; total: string; minimo: boolean }> = {
  constantes: { valor: "Retomadas no dia", total: "Retomadas no mês", minimo: true },
  respondidas: { valor: "Responderam", total: "Retomadas enviadas", minimo: true },
  evoluiram: { valor: "Evolução da nota", total: "Simulações no mês", minimo: false },
  ensinam: { valor: "Contribuições", total: "Contribuições", minimo: false },
  treino: { valor: "Pontos", total: "Simulações no mês", minimo: false },
  fechamentos: { valor: "Vendas no mês", total: "Vendas no mês", minimo: false },
};

interface Rascunho { ativos: Record<Podio, boolean>; minimo: string; ocultos: string[] }

const doBanco = (c: RankingAdminConfig): Rascunho => ({ ativos: { ...c.ativos }, minimo: String(c.minimo_retomadas), ocultos: c.ocultos.map((o) => o.user_id) });

export function RankingAdminTab() {
  const qc = useQueryClient();
  const cfgFn = useServerFn(getRankingAdminConfig);
  const listaFn = useServerFn(adminRankingLista);
  const salvarFn = useServerFn(salvarRankingAdminConfig);
  const cfgQ = useQuery({ queryKey: CONFIG_KEY, queryFn: () => cfgFn({}) });
  const [podio, setPodio] = useState<Podio>("constantes");
  const listaQ = useQuery({ queryKey: ["admin-ranking-lista", podio], queryFn: () => listaFn({ data: { podio } }) });

  const [draft, setDraft] = useState<Rascunho | null>(null);
  const cfg = cfgQ.data;
  useEffect(() => { if (cfg) setDraft(doBanco(cfg)); }, [cfg]);

  const salvar = useMutation({
    mutationFn: (d: Rascunho) => salvarFn({
      data: { ativos: d.ativos, minimo_retomadas: Math.max(1, Math.min(500, Math.round(Number(d.minimo) || 15))), ocultar: d.ocultos },
    }),
    onSuccess: () => {
      toast.success("Ranking salvo. Os pódios já usam as novas regras.");
      qc.invalidateQueries({ queryKey: CONFIG_KEY });
      qc.invalidateQueries({ queryKey: ["admin-ranking-lista"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui salvar."),
  });

  const col = COLUNAS[podio];
  const linhas = listaQ.data?.linhas ?? [];
  const minimo = cfg?.minimo_retomadas ?? 15;

  const painel = !draft || !cfg ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : (
    <div>
      <p className="type-overline text-ink-muted">Configurações</p>
      <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink">Pódios do mês</h3>

      <ul className="mt-4 space-y-2.5">
        {PODIOS.map((p) => (
          <li key={p}>
            <label className="flex items-center gap-2.5 text-[14.5px] text-ink">
              <Switch checked={draft.ativos[p]} onCheckedChange={(v) => setDraft({ ...draft, ativos: { ...draft.ativos, [p]: v } })} />
              {PODIO_TITULO[p]}
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="rk-min">Mínimo de retomadas</FieldLabel>
          <input id="rk-min" type="number" min={1} max={500} className={inputCls} value={draft.minimo} onChange={(e) => setDraft({ ...draft, minimo: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="rk-periodo">Período</FieldLabel>
          <select id="rk-periodo" className={inputCls} value="mensal" onChange={() => undefined}>
            <option value="mensal">Mensal</option>
          </select>
        </div>
      </div>

      <FieldLabel>Ocultar do mês</FieldLabel>
      <p className="text-[13.5px] text-ink-muted">Folga, afastamento ou escala reduzida: a pessoa some dos pódios deste mês, sem apagar os dados.</p>
      {draft.ocultos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {draft.ocultos.map((id) => (
            <li key={id} className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] text-ink">
              {cfg.atendentes.find((a) => a.id === id)?.nome ?? "Sem nome"}
              <button type="button" aria-label="Voltar a mostrar" onClick={() => setDraft({ ...draft, ocultos: draft.ocultos.filter((x) => x !== id) })}><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <select
        aria-label="Ocultar uma pessoa neste mês" className={cn(inputCls, "mt-2")} value=""
        onChange={(e) => { if (e.target.value) setDraft({ ...draft, ocultos: [...draft.ocultos, e.target.value] }); }}
      >
        <option value="">+ Ocultar uma pessoa</option>
        {cfg.atendentes.filter((a) => !draft.ocultos.includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
      </select>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <GoldButton className="h-9 text-[14px]" onClick={() => salvar.mutate(draft)} disabled={salvar.isPending}>Salvar</GoldButton>
        <OutlineButton className="h-9 text-[14px]" onClick={() => setDraft(doBanco(cfg))}>Cancelar</OutlineButton>
      </div>
      <p className="mt-3 text-[12.5px] text-ink-muted">Cada atendente vê só os 3 primeiros e a própria porcentagem, sem número de posição.</p>
    </div>
  );

  return (
    <AdminListDetail
      title="Ranking"
      subtitle={`Lista completa de ${cfg ? nomeDoMes(cfg.mes) : "este mês"}. Só você vê todas as posições.`}
      filters={PODIOS.map((p) => <FilterPill key={p} active={podio === p} onClick={() => setPodio(p)}>{p === "treino" ? "Treino" : PODIO_TITULO[p]}</FilterPill>)}
      panel={painel}
    >
      {listaQ.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : listaQ.isError ? (
        <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar o ranking agora.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-t border-line text-[14px]">
              <thead>
                <tr className="text-left text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  <th scope="col" className="w-10 py-2.5 pr-2">#</th>
                  <th scope="col" className="py-2.5 pr-2">Atendente</th>
                  <th scope="col" className="py-2.5 pr-2 text-right">{col.valor}</th>
                  <th scope="col" className="py-2.5 pr-2 text-right">{col.total}</th>
                  <th scope="col" className="py-2.5">Entra no pódio</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 && <tr><td colSpan={5} className="py-6 text-ink-muted">Nenhum atendente para mostrar.</td></tr>}
                {linhas.map((l) => (
                  <tr key={l.user_id} className="border-t border-line">
                    <td className="py-2.5 pr-2 text-ink-muted">{l.posicao ?? ""}</td>
                    <td className="py-2.5 pr-2 text-ink">{l.nome}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-ink">{l.valor == null ? "—" : podio === "ensinam" || podio === "fechamentos" ? Math.round(l.valor) : fmtValor(podio, l.valor)}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-ink">{l.total}</td>
                    <td className="py-2.5">
                      {l.entra_no_podio
                        ? <span className="text-ink">Sim</span>
                        : <span className="rounded-full border border-line-strong px-2 py-0.5 text-[12px] text-ink-muted">{col.minimo ? "Abaixo do mínimo" : "Fora do pódio"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] leading-5 text-ink-muted">
            {col.minimo ? `Para entrar nos pódios de porcentagem: mínimo de ${minimo} retomadas no mês. ` : ""}
            O ranking zera sozinho no dia 1º; os campeões vão para o Hall do mês.
          </p>
        </>
      )}
    </AdminListDetail>
  );
}
