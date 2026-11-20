import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  acaoRetomada, registrarCopiouRetomada, registrarRecomendada, type AcaoInputT, type RetomadaBase,
} from "@/lib/retomada.functions";
import {
  ETAPA_LABEL, ETAPA_SELO, PONTOS, PONTO_LABEL, PONTO_LISTA, REGUA, STATUS_LABEL,
  dataPorExtenso, diaBR, fmtDiaMes, fmtHora, followUpVencido, grupoDe, montarMensagem, semTexto,
  type CadenciaMensagem, type Grupo, type Ponto, type Retomada,
} from "@/lib/retomada";
import { ETAPA_LABEL as FECH_ETAPA, PLANO_LABEL } from "@/lib/cliente-disse";
import { TopbarBreadcrumb, GoldButton, OutlineButton } from "@/components/scripts/shared";
import { ChoicePill, CopyText, Overline } from "@/components/cliente-disse/shared";
import { AdicionarRetomada } from "@/components/retomada/AdicionarRetomada";
import { AudioExemplo } from "@/components/retomada/AudioExemplo";
import { BaixarRelatorioButton } from "@/components/retomada/BaixarRelatorio";
import { RETOMADA_BASE_KEY, RETOMADA_CONTAGEM_KEY, useRetomadaBase } from "@/components/retomada/hooks";
import { useAvisosPermissao } from "@/components/retomada/Avisos";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Visao = "hoje" | "fila" | "respondidos" | "encerrados";
const VISAO_LABEL: Record<Visao, string> = { hoje: "Hoje", fila: "Na fila", respondidos: "Respondidos", encerrados: "Encerrados" };

const porProxima = (a: Retomada, b: Retomada) => (a.proxima_em ?? "").localeCompare(b.proxima_em ?? "");

export function RetomadaPage() {
  const q = useRetomadaBase();
  const base = q.data;
  const qc = useQueryClient();
  const [visao, setVisao] = useState<Visao>("hoje");
  const [selId, setSelId] = useState<string | null>(null);

  const agora = new Date();
  const hoje = diaBR(agora);

  const grupos = useMemo(() => {
    const g: Record<Grupo, Retomada[]> = { followup: [], hoje: [], atrasados: [], feitos: [] };
    if (!base) return g;
    for (const r of base.retomadas) {
      const gr = grupoDe(r);
      if (gr) g[gr].push(r);
    }
    const feitosIds = new Set(base.enviadosHoje.map((e) => e.retomada_id));
    g.feitos = base.retomadas.filter((r) => feitosIds.has(r.id) && !g.followup.includes(r) && !g.hoje.includes(r) && !g.atrasados.includes(r));
    (["followup", "hoje", "atrasados"] as const).forEach((k) => g[k].sort(porProxima));
    return g;
  }, [base]);

  const outras = useMemo(() => {
    if (!base) return [];
    const f = {
      hoje: () => [] as Retomada[],
      fila: () => base.retomadas.filter((r) => r.status === "fila"),
      respondidos: () => base.retomadas.filter((r) => r.status === "respondeu"),
      encerrados: () => base.retomadas.filter((r) => ["fechou", "perdido", "esfriou"].includes(r.status)),
    }[visao]();
    return f.sort((a, b) => (visao === "fila" ? porProxima(a, b) : b.updated_at.localeCompare(a.updated_at)));
  }, [base, visao]);

  const contagem = {
    followup: grupos.followup.filter((r) => followUpVencido(r, agora)).length,
    retrabalhos: grupos.hoje.length,
    atrasados: grupos.atrasados.length,
    feitos: grupos.feitos.length,
  };

  const visiveis = visao === "hoje" ? [...grupos.followup, ...grupos.hoje, ...grupos.atrasados, ...grupos.feitos] : outras;
  const sel = base?.retomadas.find((r) => r.id === selId) ?? null;

  // Seleciona o primeiro da lista quando não há seleção válida.
  useEffect(() => {
    if (!base) return;
    if (sel && visiveis.some((r) => r.id === sel.id)) return;
    setSelId(visiveis[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, visao, visiveis.length]);

  const atualizar = (r: Retomada) => {
    qc.setQueryData<RetomadaBase>(RETOMADA_BASE_KEY, (old) => old && { ...old, retomadas: old.retomadas.map((x) => (x.id === r.id ? r : x)) });
    qc.invalidateQueries({ queryKey: RETOMADA_BASE_KEY });
    qc.invalidateQueries({ queryKey: RETOMADA_CONTAGEM_KEY });
  };

  const avisos = useAvisosPermissao();

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Atendimento" }, { label: "Retomar hoje" }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
            <h1 className="text-2xl font-medium leading-8 text-ink">Retomar hoje</h1>
            <p className="text-[14px] text-ink-muted">{dataPorExtenso(agora)}</p>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-ink-muted">
            <Resumo n={contagem.followup} um="follow-up" varios="follow-up" />
            <Resumo n={contagem.retrabalhos} um="retrabalho" varios="retrabalhos" />
            <Resumo n={contagem.atrasados} um="atrasado" varios="atrasados" />
            <Resumo n={contagem.feitos} um="feito" varios="feitos" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {avisos.podePedir && (
            <OutlineButton className="h-11 gap-2" onClick={avisos.pedir}>
              <Bell className="h-4 w-4" strokeWidth={1.5} /> Ativar avisos
            </OutlineButton>
          )}
          <AdicionarRetomada onCriada={(r) => { setVisao("hoje"); setSelId(r.id); }} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-b border-line pb-3">
        <VisaoMenu visao={visao} onChange={setVisao} base={base} />
        <BaixarRelatorioButton />
      </div>

      {q.isError && <p className="mt-4 text-[13.5px] text-ink-muted">Não consegui carregar as retomadas agora. Tente de novo.</p>}

      <div className="grid min-h-[520px] lg:grid-cols-[minmax(0,470px)_minmax(0,1fr)]">
        <div className="border-line lg:border-r">
          {q.isLoading ? (
            <div className="space-y-2 py-4" aria-hidden>{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />)}</div>
          ) : visao === "hoje" ? (
            visiveis.length === 0 ? <VazioHoje /> : (
              <>
                <GrupoLista titulo="Follow-up · na hora" itens={grupos.followup} selId={selId} onSel={setSelId} tipo="followup" />
                <GrupoLista titulo="Retrabalho de hoje" itens={grupos.hoje} selId={selId} onSel={setSelId} tipo="hoje" />
                <GrupoLista titulo="Atrasados" itens={grupos.atrasados} selId={selId} onSel={setSelId} tipo="atrasados" hoje={hoje} />
                <GrupoLista titulo="Feitos hoje" itens={grupos.feitos} selId={selId} onSel={setSelId} tipo="feitos" base={base} />
              </>
            )
          ) : outras.length === 0 ? (
            <p className="px-4 py-8 text-[14px] text-ink-muted">Nenhum cliente em “{VISAO_LABEL[visao]}”.</p>
          ) : (
            <ul>{outras.map((r) => <LinhaRetomada key={r.id} r={r} active={r.id === selId} onClick={() => setSelId(r.id)} tipo="outra" />)}</ul>
          )}
        </div>

        <div className="min-w-0 border-t border-line lg:border-t-0">
          {base && sel ? (
            <Detalhe key={sel.id} r={sel} base={base} onAtualizada={atualizar} onProximo={(id) => setSelId(id)} lista={visiveis} />
          ) : (
            !q.isLoading && visiveis.length === 0 && visao === "hoje" ? null : (
              <p className="px-6 py-10 text-[14px] text-ink-muted">Escolha um cliente na lista.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Resumo({ n, um, varios }: { n: number; um: string; varios: string }) {
  return <span><strong className="font-semibold text-ink">{n}</strong> {n === 1 ? um : varios}</span>;
}

function VazioHoje() {
  return (
    <div className="px-4 py-12">
      <p className="text-[15px] font-medium text-ink">Nada para retomar hoje.</p>
      <p className="mt-1 text-[14px] text-ink-muted">Quem pedir para falar depois entra aqui na hora certa.</p>
      <div className="mt-4"><AdicionarRetomada /></div>
    </div>
  );
}

function VisaoMenu({ visao, onChange, base }: { visao: Visao; onChange: (v: Visao) => void; base?: RetomadaBase }) {
  const n = (v: Visao) => (!base ? 0 : v === "fila" ? base.retomadas.filter((r) => r.status === "fila").length : v === "respondidos" ? base.retomadas.filter((r) => r.status === "respondeu").length : v === "encerrados" ? base.retomadas.filter((r) => ["fechou", "perdido", "esfriou"].includes(r.status)).length : 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[14px] font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {visao === "hoje" ? "Meus clientes" : `Meus clientes · ${VISAO_LABEL[visao]}`}
        <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {(Object.keys(VISAO_LABEL) as Visao[]).map((v) => (
          <DropdownMenuItem key={v} onSelect={() => onChange(v)} className={cn("justify-between", v === visao && "font-semibold")}>
            {VISAO_LABEL[v]}
            {v !== "hoje" && <span className="text-ink-muted">{n(v)}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

function GrupoLista({ titulo, itens, selId, onSel, tipo, hoje, base }: {
  titulo: string; itens: Retomada[]; selId: string | null; onSel: (id: string) => void;
  tipo: "followup" | "hoje" | "atrasados" | "feitos"; hoje?: string; base?: RetomadaBase;
}) {
  if (itens.length === 0) return null;
  return (
    <section aria-label={titulo}>
      <Overline className="border-b border-line px-4 pb-2 pt-4 text-ink-muted">{titulo}</Overline>
      <ul>
        {itens.map((r) => (
          <LinhaRetomada key={r.id} r={r} active={r.id === selId} onClick={() => onSel(r.id)} tipo={tipo} hoje={hoje} base={base} />
        ))}
      </ul>
    </section>
  );
}

function detalheLinha(r: Retomada): string {
  const ponto = PONTO_LISTA[r.ponto_parada];
  if (r.ponto_parada === "travou_fechamento" && r.subetapa_fechamento && r.subetapa_fechamento in FECH_ETAPA) {
    return `${ponto} · ${FECH_ETAPA[r.subetapa_fechamento as keyof typeof FECH_ETAPA].toLowerCase()}`;
  }
  return ponto;
}

function LinhaRetomada({ r, active, onClick, tipo, hoje, base }: {
  r: Retomada; active: boolean; onClick: () => void;
  tipo: "followup" | "hoje" | "atrasados" | "feitos" | "outra"; hoje?: string; base?: RetomadaBase;
}) {
  const feito = tipo === "feitos";
  let sub = detalheLinha(r);
  if (tipo === "followup" && r.proxima_em && !followUpVencido(r)) sub += ` · às ${fmtHora(r.proxima_em)}`;
  if (tipo === "atrasados" && r.proxima_em) {
    sub += hoje && diaBR(r.proxima_em) === diaBR(new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 86400_000)) ? " · era ontem" : ` · era ${fmtDiaMes(r.proxima_em)}`;
  }
  if (feito) {
    const env = base?.enviadosHoje.find((e) => e.retomada_id === r.id);
    sub = r.status === "fila" && r.proxima_em
      ? `Enviei · próximo ${ETAPA_LABEL[r.etapa_atual]} em ${fmtDiaMes(r.proxima_em)}`
      : r.d10_enviado_em ? "Enviei · D+10, aguardando resposta"
      : `${env ? "Enviei · " : ""}${STATUS_LABEL[r.status]}`;
  }
  if (tipo === "outra") sub = `${STATUS_LABEL[r.status]} · ${detalheLinha(r)}${r.status === "fila" && r.proxima_em ? ` · ${ETAPA_LABEL[r.etapa_atual]} em ${fmtDiaMes(r.proxima_em)}` : ""}`;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex min-h-[52px] w-full items-center gap-3 border-b border-l-2 border-b-line px-4 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          active ? "border-l-gold bg-sidebar" : "border-l-transparent hover:bg-sidebar/60",
          feito && !active && "opacity-60",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{r.primeiro_nome || "Sem nome"}</span>
          <span className="block truncate text-[13px] text-ink-muted">{sub}</span>
        </span>
        {!feito && tipo !== "outra" && <Selo r={r} tracejado={tipo === "atrasados"} />}
      </button>
    </li>
  );
}

function Selo({ r, tracejado }: { r: Retomada; tracejado?: boolean }) {
  if (r.etapa_atual === "follow_up") {
    return <span className="shrink-0 rounded-full bg-gold px-2.5 py-0.5 text-[12px] font-semibold text-on-gold">Follow-up</span>;
  }
  return (
    <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold text-ink", tracejado ? "border-dashed border-ink" : "border-ink")}>
      {ETAPA_SELO[r.etapa_atual]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

function achaMensagem(base: RetomadaBase, r: Retomada): CadenciaMensagem | null {
  const ponto = r.etapa_atual === "follow_up" ? "follow_up" : r.ponto_parada;
  return base.mensagens.find((m) => m.ponto_parada === ponto && m.etapa === r.etapa_atual) ?? null;
}

function Detalhe({ r, base, onAtualizada, onProximo, lista }: {
  r: Retomada; base: RetomadaBase; onAtualizada: (r: Retomada) => void; onProximo: (id: string | null) => void; lista: Retomada[];
}) {
  const navigate = useNavigate();
  const acaoFn = useServerFn(acaoRetomada);
  const copiouFn = useServerFn(registrarCopiouRetomada);
  const recomendadaFn = useServerFn(registrarRecomendada);
  const caso = r.fechamento_caso_id ? base.casos[r.fechamento_caso_id] ?? null : null;
  const msg = achaMensagem(base, r);
  const naFila = r.status === "fila";
  const [perdendo, setPerdendo] = useState(false);
  const [voltando, setVoltando] = useState(false);
  const [novoPonto, setNovoPonto] = useState<Ponto>(r.ponto_parada);

  // Registra "recomendada" uma vez por etapa ao abrir o ticket.
  const jaRegistrou = useRef<string>("");
  useEffect(() => {
    const k = `${r.id}:${r.etapa_atual}`;
    if (!naFila || jaRegistrou.current === k) return;
    jaRegistrou.current = k;
    recomendadaFn({ data: { id: r.id } }).catch(() => undefined);
  }, [r.id, r.etapa_atual, naFila, recomendadaFn]);

  const texto = msg && !semTexto(msg.texto)
    ? montarMensagem(msg.texto, { nome: r.primeiro_nome, atendente: base.atendente, caso, observacao: r.observacao })
    : "";
  const etapaTxt = ETAPA_LABEL[r.etapa_atual];

  const passarAdiante = (id: string) => {
    const i = lista.findIndex((x) => x.id === id);
    onProximo(lista[i + 1]?.id ?? lista[i - 1]?.id ?? null);
  };

  const acao = useMutation({
    mutationFn: (d: AcaoInputT) => acaoFn({ data: d }),
    onSuccess: (novo, d) => {
      onAtualizada(novo);
      if (d.acao === "enviei") {
        toast.success(novo.proxima_em ? `Enviei registrado. Próximo ${ETAPA_LABEL[novo.etapa_atual]} em ${fmtDiaMes(novo.proxima_em)}.` : "Enviei registrado. Sem resposta em 2 dias, o cliente esfria.");
        passarAdiante(r.id);
      } else if (d.acao === "respondeu") { toast.success("Respondeu. Saiu da lista do dia."); passarAdiante(r.id); }
      else if (d.acao === "fechou") { toast.success("Fechou!"); passarAdiante(r.id); }
      else if (d.acao === "perdido") { toast.success("Marcado como perdido."); setPerdendo(false); passarAdiante(r.id); }
      else { toast.success("Voltou para a fila. Recomeça no D+1, amanhã."); setVoltando(false); }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui registrar agora."),
  });

  const copiou = () => { copiouFn({ data: { id: r.id } }).catch(() => undefined); };

  const pills: string[] = [];
  if (caso?.plano) pills.push(`${PLANO_LABEL[caso.plano]}${caso.dependentes ? ` · ${caso.dependentes} ${caso.dependentes === 1 ? "dependente" : "dependentes"}` : ""}`);
  else if (caso && caso.dependentes) pills.push(`${caso.dependentes} ${caso.dependentes === 1 ? "dependente" : "dependentes"}`);
  if (caso && caso.usos.length) pills.push(`Vai usar: ${caso.usos.map((u) => u.nome).join(", ")}`);
  pills.push(`Entrou em ${fmtDiaMes(r.created_at)}`);

  const tituloOver = r.etapa_atual === "follow_up" ? "FOLLOW-UP" : `RETRABALHO · ${etapaTxt}`;

  return (
    <article className="px-0 py-5 lg:px-7" aria-label={`Retomada de ${r.primeiro_nome}`}>
      <Overline>{tituloOver} · {PONTO_LABEL[r.ponto_parada]}</Overline>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[26px] font-medium leading-8 text-ink">{r.primeiro_nome}</h2>
        {r.telefone && <span className="text-[15px] text-ink-muted">{formatarTel(r.telefone)}</span>}
        {r.telefone && <span className="ml-auto"><CopyText text={r.telefone} label="Copiar número" className="h-9" /></span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pills.map((p) => <span key={p} className="rounded-full border border-line-strong px-3 py-1 text-[13px] text-ink">{p}</span>)}
        {r.vezes_voltou > 0 && <span className="rounded-full border border-dashed border-line-strong px-3 py-1 text-[13px] text-ink">Voltou {r.vezes_voltou}×</span>}
      </div>

      {r.observacao && (
        <p className="mt-4 rounded-lg bg-sidebar px-4 py-3 text-[14px] leading-6 text-ink">Observação: {r.observacao}</p>
      )}

      {naFila && r.etapa_atual !== "follow_up" && (
        <ol className="mt-4 grid grid-cols-5 gap-2" aria-label="Régua da cadência">
          {REGUA.map((e) => {
            const i = REGUA.indexOf(e), cur = REGUA.indexOf(r.etapa_atual as (typeof REGUA)[number]);
            const feita = i < cur || (r.etapa_atual === "d10" && !!r.d10_enviado_em && e === "d10");
            return (
              <li
                key={e}
                aria-current={i === cur ? "step" : undefined}
                className={cn(
                  "truncate rounded-lg border px-2 py-2 text-center text-[13px] font-medium",
                  i === cur ? "border-gold text-gold-text" : feita ? "border-transparent bg-surface-2 text-ink" : "border-line-strong text-ink",
                )}
              >
                {e === "d7" ? "D+7 · áudio" : ETAPA_LABEL[e]}
              </li>
            );
          })}
        </ol>
      )}

      {naFila ? (
        <>
          <div className="mt-4 rounded-xl bg-surface-2 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <Overline>{msg?.canal === "audio" ? `Roteiro do áudio (até 30 s) · ${etapaTxt}` : `Mensagem do ${etapaTxt}`}</Overline>
              {texto && <CopyText text={texto} variant="link" onCopied={copiou} />}
            </div>
            {texto ? (
              <p className="mt-2 whitespace-pre-wrap text-[15.5px] leading-[1.55] text-ink [overflow-wrap:anywhere]">{texto}</p>
            ) : (
              <p className="mt-2 text-[14px] text-ink-muted">Esta mensagem ainda não foi publicada. Fale com o administrador para escrever a cadência.</p>
            )}
          </div>

          {msg?.canal === "audio" && (
            <div className="mt-3 space-y-2">
              {msg.audio_exemplo_url && <AudioExemplo path={msg.audio_exemplo_url} />}
              <p className="text-[13.5px] text-ink-muted">Grave com a sua voz no WhatsApp.</p>
            </div>
          )}

          {msg?.por_que && <p className="mt-3 text-[13.5px] leading-5 text-ink-muted">Por que esta mensagem: {msg.por_que}</p>}

          {!perdendo ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <GoldButton className="h-11 px-6" onClick={() => acao.mutate({ acao: "enviei", id: r.id })} disabled={acao.isPending}>Enviei</GoldButton>
              <OutlineButton className="h-10" onClick={() => acao.mutate({ acao: "respondeu", id: r.id })} disabled={acao.isPending}>Respondeu</OutlineButton>
              <OutlineButton className="h-10" onClick={() => acao.mutate({ acao: "fechou", id: r.id })} disabled={acao.isPending}>Fechou</OutlineButton>
              <OutlineButton className="h-10" onClick={() => setPerdendo(true)} disabled={acao.isPending}>Perdido</OutlineButton>
              {caso && (
                <button type="button" onClick={() => navigate({ to: "/scripts/cliente-disse", search: { aba: "fechar" } })} className="ml-auto text-[14px] font-semibold text-gold-text hover:underline">
                  Abrir em “Fechar com este cliente” →
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-line-strong p-4">
              <Overline>Por que perdeu?</Overline>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {base.motivos.map((m) => (
                  <ChoicePill key={m.id} onClick={() => acao.mutate({ acao: "perdido", id: r.id, motivo: m.nome })}>{m.nome}</ChoicePill>
                ))}
              </div>
              <button type="button" onClick={() => setPerdendo(false)} className="mt-3 text-[13.5px] text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-5 rounded-lg border border-line-strong p-4">
          <p className="text-[14.5px] text-ink">
            {STATUS_LABEL[r.status]}
            {r.status === "perdido" && r.motivo_perda ? ` · ${r.motivo_perda}` : ""}
          </p>
          {!voltando ? (
            <OutlineButton className="mt-3 h-9" onClick={() => setVoltando(true)}>Voltar para a fila</OutlineButton>
          ) : (
            <div className="mt-3">
              <Overline>Onde parou agora?</Overline>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PONTOS.map((p) => <ChoicePill key={p} active={p === novoPonto} onClick={() => setNovoPonto(p)}>{PONTO_LABEL[p]}</ChoicePill>)}
              </div>
              <div className="mt-3 flex gap-2">
                <GoldButton className="h-9 text-[14px]" onClick={() => acao.mutate({ acao: "voltar_fila", id: r.id, ponto_parada: novoPonto })} disabled={acao.isPending}>Voltar para a fila</GoldButton>
                <OutlineButton className="h-9 text-[14px]" onClick={() => setVoltando(false)}>Cancelar</OutlineButton>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-[12.5px] text-ink-muted">O número some quando o cliente sai da fila ou em 30 dias. Só você vê o número.</p>
    </article>
  );
}

function formatarTel(t: string): string {
  const d = t.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}
