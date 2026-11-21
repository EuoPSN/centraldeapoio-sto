import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminDecidirSugestao, adminMensagensVendem, adminSalvarConfigMensagens, verificarMensagensAbaixoDoEsperado,
  type MensagensVendemAdmin,
} from "@/lib/mensagens-vendem.functions";
import {
  ETAPA_ORDEM, FILTROS_PONTO, FILTRO_PONTO_LABEL, fmtPct, pct, pontoDaLinha,
  type FiltroPonto, type LinhaDesempenho,
} from "@/lib/mensagens-vendem";
import { ETAPA_SELO, PONTO_LABEL, type EtapaRetomada, type PontoCadencia } from "@/lib/retomada";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { Overline } from "@/components/cliente-disse/shared";
import { SeloPill } from "@/components/retomada/SeloMensagem";
import { AdminListDetail, FieldLabel, FilterPill, PanelEmpty, PanelHeader, inputCls } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";

const KEY = ["admin-mensagens-vendem"] as const;
const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não consegui salvar agora.");
const PERIODOS = [{ v: null, l: "Desde o começo" }, { v: 90, l: "90 dias" }, { v: 30, l: "30 dias" }, { v: 7, l: "7 dias" }] as const;

const chaveLinha = (l: LinhaDesempenho) => `${l.origem}:${l.mensagem_id}:${l.versao ?? 0}`;
const etapaTxt = (l: LinhaDesempenho) => (l.origem === "fechamento" ? l.titulo : ETAPA_SELO[l.etapa as EtapaRetomada] ?? l.etapa);

export function MensagensVendemAdminTab() {
  const fn = useServerFn(adminMensagensVendem);
  const verificarFn = useServerFn(verificarMensagensAbaixoDoEsperado);
  const decidirFn = useServerFn(adminDecidirSugestao);
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<number | null>(null);
  const [ponto, setPonto] = useState<FiltroPonto>("recebeu_proposta");
  const [selKey, setSelKey] = useState<string | null>(null);
  const [regras, setRegras] = useState(false);
  const q = useQuery({ queryKey: [...KEY, periodo], queryFn: () => fn({ data: { periodo_dias: periodo } }) });
  const d = q.data;

  // Ao abrir o Admin: verifica as mensagens abaixo do esperado (o servidor limita a 1 vez a cada 6 horas).
  const verificou = useRef(false);
  useEffect(() => {
    if (verificou.current) return;
    verificou.current = true;
    verificarFn({}).then((r) => { if (r.criadas > 0) qc.invalidateQueries({ queryKey: KEY }); }).catch(() => undefined);
  }, [verificarFn, qc]);

  const pendentes = (d?.sugestoes ?? []).filter((s) => s.status === "pendente");
  const minEnvios = d?.config.min_envios ?? 10;

  const linhas = useMemo(
    () => (d?.linhas ?? [])
      .filter((l) => pontoDaLinha(l) === ponto)
      .sort((a, b) => ETAPA_ORDEM.indexOf(a.etapa) - ETAPA_ORDEM.indexOf(b.etapa) || a.titulo.localeCompare(b.titulo) || (b.versao ?? 0) - (a.versao ?? 0)),
    [d, ponto],
  );
  const sel = linhas.find((l) => chaveLinha(l) === selKey) ?? null;

  const decidir = useMutation({
    mutationFn: (v: { id: string; acao: "aprovar" | "ignorar"; texto?: string }) => decidirFn({ data: v }),
    onSuccess: (r, v) => {
      if (!r.ok) return toast.error(r.mensagem);
      toast.success(v.acao === "aprovar" ? `Aprovada como v${r.versao}.` : "Sugestão ignorada.");
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
    },
    onError: erro,
  });

  return (
    <AdminListDetail
      title="Mensagens que vendem"
      subtitle="Cada versão das mensagens da retomada e do Fechar com este cliente, com o que aconteceu depois que foi enviada."
      actions={
        <select aria-label="Período" className={cn(inputCls, "h-9 w-auto py-0")} value={periodo ?? ""} onChange={(e) => { setPeriodo(e.target.value ? Number(e.target.value) : null); setSelKey(null); }}>
          {PERIODOS.map((p) => <option key={p.l} value={p.v ?? ""}>{p.l}</option>)}
        </select>
      }
      belowHeader={pendentes.length > 0 ? (
        <p className="rounded-lg border border-gold px-3.5 py-2.5 text-[14px] text-ink">
          <strong className="font-semibold text-gold-text">{pendentes.length} {pendentes.length === 1 ? "mensagem" : "mensagens"}</strong>{" "}
          abaixo do esperado, com sugestão de nova versão.
        </p>
      ) : undefined}
      filters={FILTROS_PONTO.map((p) => (
        <FilterPill key={p} active={ponto === p} onClick={() => { setPonto(p); setSelKey(null); }}>{FILTRO_PONTO_LABEL[p]}</FilterPill>
      ))}
      panel={sel && d ? (
        <Painel key={chaveLinha(sel)} l={sel} d={d} minEnvios={minEnvios} decidindo={decidir.isPending}
          onDecidir={(v) => decidir.mutate(v)} onFechar={() => setSelKey(null)} />
      ) : <PanelEmpty>Escolha uma mensagem para ver os números.</PanelEmpty>}
    >
      {q.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : q.isError ? (
        <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar os números agora. Confira se as migrações da Fase B foram aplicadas.</p>
      ) : linhas.length === 0 ? (
        <p className="py-6 text-[14px] text-ink-muted">Ainda não há envios registrados para {FILTRO_PONTO_LABEL[ponto].toLowerCase()}.</p>
      ) : (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead className="text-[11.5px] uppercase tracking-[0.1em] text-ink-muted">
              <tr>{["Etapa", "Versão", "Enviadas", "Responderam", "Fecharam", "Selo"].map((h, i) => (
                <th key={h} scope="col" className={cn("border-b border-line px-3 py-2.5 font-semibold", i >= 2 && i <= 4 && "text-right")}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const poucos = l.enviadas < minEnvios;
                const taxaResp = pct(l.responderam, l.enviadas);
                const taxaFech = pct(l.fecharam, l.enviadas);
                const baixoResp = !poucos && l.selo === "vale_testar_outra" && l.origem === "cadencia";
                const baixoFech = !poucos && l.selo === "vale_testar_outra" && l.origem === "fechamento";
                const ativo = chaveLinha(l) === selKey;
                return (
                  <tr key={chaveLinha(l)} onClick={() => setSelKey(chaveLinha(l))} className={cn("cursor-pointer border-b border-l-2 border-b-line", ativo ? "border-l-gold bg-sidebar" : "border-l-transparent hover:bg-sidebar/60")}>
                    <td className="px-3 py-2.5 text-ink">
                      <button type="button" className="text-left focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setSelKey(chaveLinha(l))}>{etapaTxt(l)}</button>
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{l.versao != null ? `v${l.versao}` : "–"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{l.enviadas}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", baixoResp ? "font-semibold text-destructive" : "text-ink")}>{poucos ? "–" : fmtPct(taxaResp)}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", baixoFech ? "font-semibold text-destructive" : "text-ink")}>{poucos ? "–" : fmtPct(taxaFech)}</td>
                    <td className="px-3 py-2.5">{l.selo ? <SeloPill selo={l.selo} /> : poucos ? <span className="text-[13px] text-ink-muted">Poucos envios</span> : <span className="text-ink-muted">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[12.5px] leading-5 text-ink-muted">
        Percentuais calculados sobre mensagens que o atendente copiou e marcou como enviadas. A Omnia não vê se o texto foi editado no WhatsApp. Atendentes veem só o selo.
        No Fechar com este cliente, “fecharam” conta os casos que chegaram em venda concluída e não existe “responderam”.
      </p>
      <button type="button" onClick={() => setRegras((v) => !v)} aria-expanded={regras} className="mt-2 text-[14px] font-semibold text-gold-text hover:underline">
        Ajustar regras do selo <span aria-hidden>→</span>
      </button>
      {regras && d && <RegrasSelo config={d.config} onSalvo={() => qc.invalidateQueries({ queryKey: KEY })} />}
    </AdminListDetail>
  );
}

function RegrasSelo({ config, onSalvo }: { config: { min_envios: number; limite_baixo: number }; onSalvo: () => void }) {
  const salvarFn = useServerFn(adminSalvarConfigMensagens);
  const [min, setMin] = useState(String(config.min_envios));
  const [limite, setLimite] = useState(String(Math.round(config.limite_baixo * 100)));
  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { min_envios: Math.max(1, Math.round(Number(min) || 10)), limite_baixo: Math.min(1, Math.max(0.1, (Number(limite) || 70) / 100)) } }),
    onSuccess: () => { toast.success("Regras do selo salvas."); onSalvo(); },
    onError: erro,
  });
  return (
    <div className="mt-3 max-w-[520px] rounded-xl border border-line-strong p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <Overline className="mb-1 text-ink-muted">Mínimo de envios para ter selo</Overline>
          <input className={inputCls} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="block">
          <Overline className="mb-1 text-ink-muted">“Vale testar outra” abaixo de (% da média)</Overline>
          <input className={inputCls} inputMode="numeric" value={limite} onChange={(e) => setLimite(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <p className="mt-2 text-[12.5px] leading-5 text-ink-muted">
        “Funciona bem”: a taxa de resposta é igual ou maior que a média da etapa (todas as versões do mesmo ponto de parada e etapa). Sem selo no meio.
      </p>
      <GoldButton className="mt-3 h-9 px-4 text-[14px]" onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar regras</GoldButton>
    </div>
  );
}

function Painel({ l, d, minEnvios, decidindo, onDecidir, onFechar }: {
  l: LinhaDesempenho;
  d: MensagensVendemAdmin;
  minEnvios: number; decidindo: boolean;
  onDecidir: (v: { id: string; acao: "aprovar" | "ignorar"; texto?: string }) => void; onFechar: () => void;
}) {
  const textoDe = (id: string, v: number | null) => d.textos.find((t) => t.mensagem_id === id && t.versao === v)?.texto ?? "";
  const ehCadencia = l.origem === "cadencia";
  const sug = ehCadencia ? d.sugestoes.find((s) => s.mensagem_id === l.mensagem_id && s.versao_base === l.versao) ?? null : null;
  const pendente = sug?.status === "pendente" ? sug : null;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(pendente?.texto_sugerido ?? "");

  const poucos = l.enviadas < minEnvios;
  const taxaResp = pct(l.responderam, l.enviadas);
  const taxaFech = pct(l.fecharam, l.enviadas);
  const proxima = l.versao != null ? l.versao + 1 : null;

  // Antes e depois: versão criada por uma sugestão aprovada que já tem envios suficientes.
  const aprovadaDaBase = ehCadencia ? d.sugestoes.find((s) => s.mensagem_id === l.mensagem_id && s.status === "aprovada" && (s.versao_base === l.versao || s.versao_criada === l.versao)) : null;
  const achar = (v: number | null) => d.linhasTotais.find((x) => x.origem === "cadencia" && x.mensagem_id === l.mensagem_id && x.versao === v) ?? null;
  const antes = aprovadaDaBase ? achar(aprovadaDaBase.versao_base) : null;
  const depois = aprovadaDaBase?.versao_criada != null ? achar(aprovadaDaBase.versao_criada) : null;

  const overline = ehCadencia
    ? `${pendente ? "Sugestão da IA" : "Mensagem"} · ${etapaTxt(l)} · ${PONTO_LABEL[l.ponto as PontoCadencia] ?? l.ponto}`
    : `Fechar com este cliente · ${l.titulo}`;

  return (
    <div>
      <PanelHeader overline={overline} title={pendente && proxima ? `Nova versão (v${proxima})` : ehCadencia ? `Versão ${l.versao}` : l.titulo} onClose={onFechar} />

      <div className="grid grid-cols-3 gap-2.5">
        <Numero n={ehCadencia ? (poucos ? "–" : fmtPct(taxaResp)) : (poucos ? "–" : fmtPct(taxaFech))} l={ehCadencia ? `responderam${l.versao != null ? ` (v${l.versao})` : ""}` : "levaram ao fechamento"} />
        <Numero n={fmtPct(ehCadencia ? l.media_resposta : l.media_fechamento)} l="média da etapa" />
        <Numero n={String(l.enviadas)} l={ehCadencia ? `envios${l.versao != null ? ` da v${l.versao}` : ""}` : "vezes copiada"} />
      </div>
      {l.selo && <p className="mt-3 flex items-center gap-2 text-[13.5px] text-ink-muted"><SeloPill selo={l.selo} /> Selo que o atendente vê.</p>}
      {!l.selo && poucos && <p className="mt-3 text-[13.5px] text-ink-muted">Poucos envios: o selo aparece a partir de {minEnvios}.</p>}

      {pendente ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-2 p-3.5">
              <Overline>Atual · v{l.versao}</Overline>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-ink">{textoDe(l.mensagem_id, l.versao)}</p>
            </div>
            <div className="rounded-xl border border-gold bg-surface-2 p-3.5">
              <Overline>Sugerida · v{proxima}</Overline>
              {editando ? (
                <textarea rows={8} className={cn(inputCls, "mt-2 resize-y leading-6")} value={texto} onChange={(e) => setTexto(e.target.value)} />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-ink">{pendente.texto_sugerido}</p>
              )}
            </div>
          </div>
          {pendente.por_que_mudar && <p className="mt-3 text-[13.5px] leading-5 text-ink"><strong className="font-semibold">Por que mudar:</strong> {pendente.por_que_mudar}</p>}
          <p className="mt-1.5 text-[12.5px] leading-5 text-ink-muted">A IA usou o Cérebro e o Padrão de escrita. Variáveis mantidas: {(pendente.texto_sugerido.match(/\{[a-z_]+\}/gi) ?? []).join(" ") || "nenhuma"}.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <GoldButton className="h-10 px-4 text-[14px]" disabled={decidindo} onClick={() => onDecidir({ id: pendente.id, acao: "aprovar", texto: editando ? texto : undefined })}>
              Aprovar como v{proxima}
            </GoldButton>
            {!editando
              ? <OutlineButton className="h-10 px-4 text-[14px]" disabled={decidindo} onClick={() => { setTexto(pendente.texto_sugerido); setEditando(true); }}>Editar</OutlineButton>
              : <OutlineButton className="h-10 px-4 text-[14px]" disabled={decidindo} onClick={() => setEditando(false)}>Desfazer edição</OutlineButton>}
            <OutlineButton className="h-10 px-4 text-[14px]" disabled={decidindo} onClick={() => onDecidir({ id: pendente.id, acao: "ignorar" })}>Ignorar</OutlineButton>
          </div>
          <p className="mt-2 text-[12.5px] leading-5 text-ink-muted">Depois de aprovada, a Omnia compara a v{proxima} com a v{l.versao} e mostra o resultado aqui.</p>
        </>
      ) : ehCadencia ? (
        <>
          <FieldLabel>Texto da v{l.versao}</FieldLabel>
          <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3.5 text-[14px] leading-6 text-ink">{textoDe(l.mensagem_id, l.versao) || "Texto não encontrado."}</p>
          {sug?.status === "ignorada" && <p className="mt-3 text-[13px] text-ink-muted">Sugestão ignorada. A Omnia não sugere de novo para esta versão.</p>}
          {l.selo === "vale_testar_outra" && !sug && <p className="mt-3 text-[13px] text-ink-muted">Abaixo do esperado. A sugestão de nova versão chega na próxima verificação (a cada 6 horas, ao abrir o Admin).</p>}
        </>
      ) : null}

      {antes && depois && (
        <div className="mt-5 border-t border-line pt-4">
          <Overline>Antes e depois · v{antes.versao} → v{depois.versao}</Overline>
          {depois.enviadas >= minEnvios ? (
            <table className="mt-2 w-full text-left text-[13.5px]">
              <thead className="text-[11.5px] uppercase tracking-[0.1em] text-ink-muted">
                <tr><th className="py-1.5 font-semibold">Versão</th><th className="py-1.5 text-right font-semibold">Envios</th><th className="py-1.5 text-right font-semibold">Responderam</th><th className="py-1.5 text-right font-semibold">Fecharam</th></tr>
              </thead>
              <tbody>
                {[antes, depois].map((x) => (
                  <tr key={x.versao} className="border-t border-line">
                    <td className="py-1.5 text-ink">v{x.versao}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink">{x.enviadas}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink">{fmtPct(pct(x.responderam, x.enviadas))}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink">{fmtPct(pct(x.fecharam, x.enviadas))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-[13.5px] text-ink-muted">A v{depois.versao} tem {depois.enviadas} {depois.enviadas === 1 ? "envio" : "envios"}. A comparação aparece com {minEnvios}.</p>
          )}
        </div>
      )}
      {antes && !depois && aprovadaDaBase?.versao_criada != null && (
        <p className="mt-5 border-t border-line pt-4 text-[13.5px] text-ink-muted">A v{aprovadaDaBase.versao_criada} ainda não teve envios. A comparação com a v{antes.versao} aparece com {minEnvios}.</p>
      )}
    </div>
  );
}

function Numero({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-xl border border-line-strong p-3">
      <p className="text-[24px] font-medium leading-8 text-ink">{n}</p>
      <p className="mt-0.5 text-[12.5px] leading-4 text-ink-muted">{l}</p>
    </div>
  );
}
