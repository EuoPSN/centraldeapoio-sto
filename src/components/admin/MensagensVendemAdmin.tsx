import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminDecidirSugestao, adminMensagensVendem, adminSalvarRegrasSelo, verificarMensagensAbaixoDoEsperado,
  type MensagensVendemAdmin,
} from "@/lib/mensagens-vendem.functions";
import {
  SELO_LABEL, chaveLinha, etapaTexto, pct, pctTexto, pontoTexto, variaveisDoTexto, type LinhaDesempenho,
} from "@/lib/mensagens-vendem";
import { PONTOS_CADENCIA, PONTO_CURTO } from "@/lib/retomada";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { Overline } from "@/components/cliente-disse/shared";
import { AdminListDetail, FieldLabel, FilterPill, PanelEmpty, inputCls } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";

const KEY = ["admin-mensagens-vendem"] as const;
const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não consegui salvar agora.");

type Chip = (typeof PONTOS_CADENCIA)[number] | "fechamento";
const PERIODOS = [{ dias: 30 as number | null, label: "30 dias" }, { dias: 90, label: "90 dias" }, { dias: null, label: "Tudo" }];

/** Admin > Mensagens que vendem: cada versão das mensagens da retomada e do Fechar com este cliente,
 * com o que aconteceu depois que foi enviada, e a sugestão da IA para as que estão abaixo do esperado. */
export function MensagensVendemAdminTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminMensagensVendem);
  const verificarFn = useServerFn(verificarMensagensAbaixoDoEsperado);
  const [dias, setDias] = useState<number | null>(30);
  const [chip, setChip] = useState<Chip>("recebeu_proposta");
  const [selKey, setSelKey] = useState<string | null>(null);
  const q = useQuery({ queryKey: [...KEY, dias], queryFn: () => listFn({ data: { dias } }) });
  const d = q.data;

  // Ao abrir o Admin: a IA procura mensagens abaixo do esperado (no máximo a cada 6 horas, travado no banco).
  const verificou = useRef(false);
  useEffect(() => {
    if (verificou.current) return;
    verificou.current = true;
    verificarFn({})
      .then((r) => { if (r.novas > 0) { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ["admin-pending-counts"] }); } })
      .catch(() => undefined);
  }, [verificarFn, qc]);

  const linhasDoChip = useMemo(() => {
    if (!d) return [];
    const ordemEtapa = (e: string) => ["follow_up", "d1", "d2", "d4", "d7", "d10", "proposta", "plano", "dados", "pagamento", "link"].indexOf(e);
    return d.linhas
      .filter((l) => (chip === "fechamento" ? l.origem === "fechamento" : l.origem === "cadencia" && l.ponto_parada === chip))
      .sort((a, b) => ordemEtapa(a.etapa) - ordemEtapa(b.etapa) || b.versao - a.versao);
  }, [d, chip]);

  const sel = d?.linhas.find((l) => chaveLinha(l) === selKey) ?? null;

  return (
    <AdminListDetail
      title="Mensagens que vendem"
      subtitle="Cada versão das mensagens da retomada e do Fechar com este cliente, com o que aconteceu depois que foi enviada."
      belowHeader={d && d.pendentes > 0 ? (
        <p className="rounded-lg border border-gold px-4 py-2.5 text-[14px] text-ink" role="status">
          <strong className="font-semibold text-gold-text">{d.pendentes} {d.pendentes === 1 ? "mensagem" : "mensagens"}</strong>{" "}
          abaixo do esperado, com sugestão de nova versão.
        </p>
      ) : undefined}
      filters={(
        <>
          {PONTOS_CADENCIA.map((p) => <FilterPill key={p} active={chip === p} onClick={() => { setChip(p); setSelKey(null); }}>{PONTO_CURTO[p]}</FilterPill>)}
          <FilterPill active={chip === "fechamento"} onClick={() => { setChip("fechamento"); setSelKey(null); }}>Fechar com este cliente</FilterPill>
        </>
      )}
      panel={d && sel ? <PainelMensagem key={chaveLinha(sel)} d={d} linha={sel} /> : <PanelEmpty>Escolha uma versão na tabela.</PanelEmpty>}
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Período">
        <Overline className="mr-1 text-ink-muted">Período</Overline>
        {PERIODOS.map((p) => <FilterPill key={p.label} active={dias === p.dias} onClick={() => setDias(p.dias)}>{p.label}</FilterPill>)}
      </div>

      {q.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p>
        : q.isError || !d ? <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar agora. Se a migração das mensagens ainda não rodou, rode-a no SQL editor.</p>
        : linhasDoChip.length === 0 ? <p className="py-6 text-[14px] text-ink-muted">Nenhuma mensagem aqui ainda.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <caption className="sr-only">Desempenho por versão de mensagem</caption>
              <thead>
                <tr className="border-b border-line-strong text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">Etapa</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Versão</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Enviadas</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Responderam</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Fecharam</th>
                  <th scope="col" className="py-2 pl-3 font-semibold">Selo</th>
                </tr>
              </thead>
              <tbody>
                {linhasDoChip.map((l) => (
                  <LinhaTabela key={chaveLinha(l)} l={l} d={d} ativa={chaveLinha(l) === selKey} onClick={() => setSelKey(chaveLinha(l))} />
                ))}
              </tbody>
            </table>
          </div>
        )}

      {d && (
        <>
          <p className="mt-4 text-[12.5px] leading-5 text-ink-muted">
            Percentuais calculados sobre mensagens que o atendente copiou e marcou como enviadas. A resposta e o fechamento contam para a
            última mensagem marcada como “Enviei” antes deles. A Omnia não vê se o texto foi editado no WhatsApp. Atendentes veem só o selo.
          </p>
          <AntesDepois d={d} />
          <RegrasSelo d={d} />
        </>
      )}
    </AdminListDetail>
  );
}

function LinhaTabela({ l, d, ativa, onClick }: { l: LinhaDesempenho; d: MensagensVendemAdmin; ativa: boolean; onClick: () => void }) {
  const poucos = l.enviadas < d.config.min_envios;
  const baixo = l.selo === "vale_testar";
  const sugestao = d.sugestoes.some((s) => s.mensagem_id === l.mensagem_id && s.versao_base === l.versao && s.status === "pendente");
  const rotulo = l.origem === "fechamento" ? `${etapaTexto(l)} · ${d.mensagens[l.mensagem_id]?.titulo ?? ""}` : etapaTexto(l);
  return (
    <tr className={cn("border-b border-l-2 border-b-line", ativa ? "border-l-gold bg-sidebar" : "border-l-transparent hover:bg-sidebar/60")}>
      <td className="py-2.5 pr-3">
        <button type="button" onClick={onClick} aria-current={ativa ? "true" : undefined} className="text-left font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {rotulo}
        </button>
      </td>
      <td className="px-2 py-2.5 text-ink">{l.origem === "fechamento" ? "–" : `v${l.versao}`}</td>
      <td className="px-2 py-2.5 text-right tabular-nums text-ink">{l.enviadas}</td>
      <td className={cn("px-2 py-2.5 text-right tabular-nums", baixo ? "font-semibold text-destructive" : "text-ink")}>
        {poucos || l.origem === "fechamento" ? "–" : pctTexto(pct(l.responderam, l.enviadas))}
      </td>
      <td className={cn("px-2 py-2.5 text-right tabular-nums", baixo ? "font-semibold text-destructive" : "text-ink")}>
        {poucos ? "–" : pctTexto(pct(l.fecharam, l.enviadas))}
      </td>
      <td className="py-2.5 pl-3">
        {poucos ? <span className="text-[13px] text-ink-muted">Poucos envios</span> : l.selo ? (
          <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", l.selo === "funciona_bem" ? "border-gold text-gold-text" : "border-dashed border-ink-muted text-ink")}>
            {l.selo === "funciona_bem" && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />}
            {SELO_LABEL[l.selo]}{sugestao ? " ·  sugestão" : ""}
          </span>
        ) : <span className="text-[13px] text-ink-muted">–</span>}
      </td>
    </tr>
  );
}

function Numero({ valor, legenda }: { valor: string; legenda: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <p className="text-[22px] font-medium leading-7 text-ink">{valor}</p>
      <p className="text-[12.5px] text-ink-muted">{legenda}</p>
    </div>
  );
}

function PainelMensagem({ d, linha: l }: { d: MensagensVendemAdmin; linha: LinhaDesempenho }) {
  const qc = useQueryClient();
  const decidirFn = useServerFn(adminDecidirSugestao);
  const info = d.mensagens[l.mensagem_id];
  const sug = d.sugestoes.find((s) => s.mensagem_id === l.mensagem_id && s.versao_base === l.versao && s.status === "pendente") ?? null;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(sug?.texto_sugerido ?? "");
  const atual = l.versao === info?.versao;
  const poucos = l.enviadas < d.config.min_envios;

  const decidir = useMutation({
    mutationFn: (v: { acao: "aprovar"; texto: string } | { acao: "ignorar" }) => decidirFn({ data: { id: sug!.id, ...v } }),
    onSuccess: (r, v) => {
      if (!r.ok) { toast.error(r.mensagem); return; }
      toast.success(v.acao === "aprovar" ? `Aprovada como v${r.versao}. A Omnia compara quando ela tiver ${d.config.min_envios} envios.` : "Sugestão ignorada.");
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["cadencia"] });
      qc.invalidateQueries({ queryKey: ["admin-cadencia"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
    },
    onError: erro,
  });

  const rotulo = l.origem === "fechamento" ? `${etapaTexto(l)} · ${info?.titulo ?? ""}` : `${pontoTexto(l.ponto_parada)} · ${etapaTexto(l)}`;
  const media = l.media_taxa > 0 ? `${Math.round(l.media_taxa * 100)}%` : "–";

  return (
    <div>
      <p className="type-overline text-ink-muted">{sug ? "Sugestão da IA" : "Mensagem"} · {rotulo}</p>
      <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink">{sug ? `Nova versão (v${l.versao + 1})` : l.origem === "fechamento" ? "Mensagem do Fechar com este cliente" : `Versão ${l.versao}`}</h3>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Numero
          valor={poucos ? "–" : l.origem === "fechamento" ? pctTexto(pct(l.fecharam, l.enviadas)) : pctTexto(pct(l.responderam, l.enviadas))}
          legenda={l.origem === "fechamento" ? "fecharam" : `responderam (v${l.versao})`}
        />
        <Numero valor={media} legenda="média da etapa" />
        <Numero valor={String(l.enviadas)} legenda={l.origem === "fechamento" ? "casos com a mensagem" : `envios da v${l.versao}`} />
      </div>
      {poucos && <p className="mt-2 text-[13px] text-ink-muted">Menos de {d.config.min_envios} envios: ainda sem selo nem percentuais.</p>}

      {sug && info ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-surface-2 p-3">
              <Overline>Atual · v{l.versao}</Overline>
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[22px] text-ink [overflow-wrap:anywhere]">{info.texto}</p>
            </div>
            <div className="rounded-lg border border-gold bg-surface-2 p-3">
              <Overline>Sugerida · v{l.versao + 1}</Overline>
              {editando ? (
                <>
                  <FieldLabel htmlFor="sug-texto">Texto da nova versão</FieldLabel>
                  <textarea id="sug-texto" className={cn(inputCls, "mt-1 min-h-[140px]")} rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
                </>
              ) : (
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[22px] text-ink [overflow-wrap:anywhere]">{texto}</p>
              )}
            </div>
          </div>
          {sug.por_que_mudar && <p className="mt-3 text-[13.5px] leading-5 text-ink-muted"><span className="font-semibold text-ink">Por que mudar:</span> {sug.por_que_mudar}</p>}
          <p className="mt-2 text-[13px] leading-5 text-ink-muted">
            A IA usou o Cérebro e o Padrão de escrita. Variáveis: {variaveisDoTexto(texto).map((v) => `{${v}}`).join(" ") || "nenhuma"}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <GoldButton type="button" className="h-10" disabled={decidir.isPending || !atual || !texto.trim()} onClick={() => decidir.mutate({ acao: "aprovar", texto })}>
              Aprovar como v{l.versao + 1}
            </GoldButton>
            <OutlineButton type="button" className="h-10" onClick={() => setEditando((e) => !e)}>{editando ? "Pronto" : "Editar"}</OutlineButton>
            <OutlineButton type="button" className="h-10" disabled={decidir.isPending} onClick={() => decidir.mutate({ acao: "ignorar" })}>Ignorar</OutlineButton>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-muted">Depois de aprovada, a Omnia compara a v{l.versao + 1} com a v{l.versao} e mostra o resultado aqui.</p>
        </>
      ) : (
        info && l.origem === "cadencia" && (
          <div className="mt-4 rounded-lg bg-surface-2 p-3">
            <Overline>{atual ? `Texto atual · v${info.versao}` : `Versão ${l.versao} (substituída)`}</Overline>
            {atual && <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[22px] text-ink [overflow-wrap:anywhere]">{info.texto}</p>}
            {!atual && <p className="mt-1.5 text-[13.5px] text-ink-muted">O texto desta versão fica no histórico da Cadência de retomada.</p>}
          </div>
        )
      )}
      {l.origem === "fechamento" && info?.texto && (
        <div className="mt-4 rounded-lg bg-surface-2 p-3">
          <Overline>Texto atual</Overline>
          <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[22px] text-ink [overflow-wrap:anywhere]">{info.texto}</p>
        </div>
      )}
    </div>
  );
}

function AntesDepois({ d }: { d: MensagensVendemAdmin }) {
  if (!d.antesDepois.length) return null;
  return (
    <section className="mt-6" aria-label="Antes e depois das versões aprovadas">
      <Overline>Antes e depois das versões aprovadas</Overline>
      <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
        {d.antesDepois.map((a) => (
          <li key={a.mensagem_id} className="px-3 py-2.5 text-[14px] text-ink">
            <span className="font-semibold">{a.rotulo}</span> · v{a.de.versao} → v{a.para.versao}
            <span className="block text-[13.5px] text-ink-muted">
              Resposta {pctTexto(a.de.resposta)} → {pctTexto(a.para.resposta)} · Fechamento {pctTexto(a.de.fechamento)} → {pctTexto(a.para.fechamento)} ({a.para.enviadas} envios da v{a.para.versao})
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RegrasSelo({ d }: { d: MensagensVendemAdmin }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(adminSalvarRegrasSelo);
  const [aberto, setAberto] = useState(false);
  const [min, setMin] = useState(String(d.config.min_envios));
  const [baixo, setBaixo] = useState(String(Math.round(d.config.limite_baixo * 100)));
  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { min_envios: Math.max(1, Math.round(Number(min) || 10)), limite_baixo: Math.min(1, Math.max(0.05, (Number(baixo) || 70) / 100)) } }),
    onSuccess: () => { toast.success("Regras do selo salvas."); setAberto(false); qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ["mensagens-selo"] }); },
    onError: erro,
  });
  return (
    <div className="mt-4">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="text-[14px] font-semibold text-gold-text hover:underline">Ajustar regras do selo</button>
      {aberto && (
        <div className="mt-3 max-w-md space-y-3 rounded-lg border border-line-strong p-4">
          <div>
            <FieldLabel htmlFor="regra-min">Envios mínimos para ter selo</FieldLabel>
            <input id="regra-min" inputMode="numeric" className={inputCls} value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="regra-baixo">“Vale testar outra” abaixo de (% da média da etapa)</FieldLabel>
            <input id="regra-baixo" inputMode="numeric" className={inputCls} value={baixo} onChange={(e) => setBaixo(e.target.value)} />
          </div>
          <p className="text-[13px] leading-5 text-ink-muted">“Funciona bem”: taxa igual ou maior que a média da etapa. Sem selo no meio.</p>
          <GoldButton type="button" className="h-9 text-[14px]" disabled={salvar.isPending} onClick={() => salvar.mutate()}>Salvar regras</GoldButton>
        </div>
      )}
    </div>
  );
}
