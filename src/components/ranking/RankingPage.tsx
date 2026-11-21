import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { TopbarBreadcrumb } from "@/components/scripts/shared";
import { garantirFechamentoDoMesAnterior, getHallRanking, getRankingPodios } from "@/lib/ranking.functions";
import {
  fmtValor, nomeDoMes, nomeDoMesAno, PODIOS, PODIO_COMO, PODIO_MEU, PODIO_SUBTITULO, PODIO_TITULO,
  type CampeaoHall, type Podio, type PodioPessoal, type RankingPodios,
} from "@/lib/ranking";
import { cn } from "@/lib/utils";

type Aba = "podios" | "hall" | "historico";
const ABAS: { id: Aba; label: string }[] = [
  { id: "podios", label: "Pódios" },
  { id: "hall", label: "Hall do mês" },
  { id: "historico", label: "Meu histórico" },
];

export function RankingPage({ abaInicial }: { abaInicial?: Aba }) {
  const [aba, setAba] = useState<Aba>(abaInicial ?? "podios");
  const fechar = useServerFn(garantirFechamentoDoMesAnterior);
  const podiosFn = useServerFn(getRankingPodios);
  const hallFn = useServerFn(getHallRanking);

  // Fecha o mês anterior (idempotente) antes de ler o Hall.
  const fechamento = useQuery({ queryKey: ["ranking-fechamento"], queryFn: () => fechar({}), staleTime: 3_600_000 });
  const podios = useQuery({ queryKey: ["ranking-podios"], queryFn: () => podiosFn({}), staleTime: 60_000 });
  const hall = useQuery({ queryKey: ["ranking-hall", fechamento.data?.mes], queryFn: () => hallFn({}), enabled: fechamento.isSuccess || fechamento.isError });

  useEffect(() => { if (abaInicial) setAba(abaInicial); }, [abaInicial]);

  const mes = podios.data?.mes;
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Treino e evolução" }, { label: "Ranking" }]} />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-[28px] font-medium leading-9 text-ink">Ranking</h1>
        <p className="text-[14.5px] text-ink-muted">
          {mes ? `${capitalizar(nomeDoMes(mes))} · ` : ""}atualizado todo dia · só os 3 primeiros aparecem
        </p>
      </div>

      <div role="tablist" aria-label="Ranking" className="mt-4 flex flex-wrap gap-x-6 border-b border-line">
        {ABAS.map((a) => (
          <button
            key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              aba === a.id ? "border-gold font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {aba === "podios" && (
          podios.isLoading ? <p className="text-sm text-ink-muted">Carregando…</p>
          : podios.isError || !podios.data ? <Erro onRetry={() => podios.refetch()} />
          : <Podios dados={podios.data} hall={hall.data ?? []} onHall={() => setAba("hall")} />
        )}
        {aba === "hall" && <Hall hall={hall.data ?? []} carregando={hall.isLoading} />}
        {aba === "historico" && <Historico />}
      </div>
    </div>
  );
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Erro({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-5">
      <p className="text-[15px] text-ink">Não consegui carregar o ranking agora.</p>
      <button type="button" onClick={onRetry} className="mt-2 text-[14px] text-gold-text underline underline-offset-2">Tentar de novo</button>
    </div>
  );
}

function Podios({ dados, hall, onHall }: { dados: RankingPodios; hall: CampeaoHall[]; onHall: () => void }) {
  const [treinoAba, setTreinoAba] = useState<"atendimento" | "problemas">("atendimento");
  const cartoes: { podio: Podio; dados: PodioPessoal; sub?: string }[] = [];
  for (const p of PODIOS) {
    if (!dados.ativos[p]) continue;
    if (p === "treino") cartoes.push({ podio: p, dados: dados.treino[treinoAba], sub: treinoAba === "atendimento" ? "Atendimento" : "Solução de problemas" });
    else cartoes.push({ podio: p, dados: dados.podios[p] });
  }
  const ultimoMes = hall[0]?.mes;
  const doUltimo = hall.filter((h) => h.mes === ultimoMes);

  if (!cartoes.length) {
    return <p className="rounded-xl border border-line bg-surface px-5 py-6 text-[14.5px] text-ink-muted">Os pódios deste mês ainda não estão ligados.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cartoes.map((c) => (
        <CartaoPodio
          key={c.podio} podio={c.podio} dados={c.dados} minimo={dados.minimo_retomadas}
          subtitulo={c.podio === "treino" ? `Pontos do mês · ${c.sub}` : PODIO_SUBTITULO[c.podio]}
          extra={c.podio === "treino" ? (
            <div role="tablist" aria-label="Tipo de treino" className="mt-2 flex gap-4">
              {(["atendimento", "problemas"] as const).map((t) => (
                <button
                  key={t} type="button" role="tab" aria-selected={treinoAba === t} onClick={() => setTreinoAba(t)}
                  className={cn("border-b-2 pb-1 text-[13px]", treinoAba === t ? "border-gold font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink")}
                >
                  {t === "atendimento" ? "Atendimento" : "Solução de problemas"}
                </button>
              ))}
            </div>
          ) : null}
        />
      ))}
      {ultimoMes && (
        <section className="rounded-xl border border-line bg-surface px-5 py-4" aria-label="Hall do mês">
          <h2 className="text-[17px] font-semibold leading-6 text-ink">Hall do mês</h2>
          <p className="text-[13px] text-ink-muted">Quem liderou cada pódio em {nomeDoMes(ultimoMes)}</p>
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {doUltimo.map((h) => (
              <li key={h.podio} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                <span className="text-ink">{PODIO_TITULO[h.podio]}</span>
                <span className="font-semibold text-ink">{h.nome}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onHall} className="mt-2 text-[13.5px] font-medium text-gold-text hover:underline">Ver meses anteriores →</button>
        </section>
      )}
    </div>
  );
}

function CartaoPodio({ podio, dados, minimo, subtitulo, extra }: { podio: Podio; dados: PodioPessoal; minimo: number; subtitulo: string; extra?: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const meu = dados.meu;
  const porcentagem = podio === "constantes" || podio === "respondidas";
  return (
    <section className="rounded-xl border border-line bg-surface px-5 py-4" aria-label={PODIO_TITULO[podio]}>
      <h2 className="text-[17px] font-semibold leading-6 text-ink">{PODIO_TITULO[podio]}</h2>
      <p className="text-[13px] text-ink-muted">{subtitulo}</p>
      {extra}

      {dados.top.length === 0 ? (
        <p className="mt-3 border-t border-line pt-3 text-[14px] text-ink-muted">
          {porcentagem ? `Ninguém chegou ao mínimo de ${minimo} retomadas ainda neste mês.` : "Ainda sem pódio neste mês."}
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-line border-t border-line">
          {dados.top.map((t) => (
            <li key={t.posicao} className="flex items-center gap-3 py-2">
              <span aria-label={`${t.posicao}º lugar`} className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-gold text-[12px] font-medium text-gold-text">{t.posicao}</span>
              <span className={cn("min-w-0 flex-1 truncate text-[15px]", t.voce ? "font-semibold text-ink" : "text-ink")}>{t.nome}</span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">{fmtValor(podio, t.valor)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-dashed border-line-strong pt-2.5 text-[13.5px] text-ink-muted">
        <p>
          <LinhaMinha podio={podio} meu={meu} anterior={dados.anterior} nivel={dados.nivel} minimo={minimo} />
        </p>
        <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="font-medium text-gold-text hover:underline">Como é calculado</button>
      </div>
      {aberto && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13.5px] leading-5 text-ink">{PODIO_COMO[podio]}</p>}
    </section>
  );
}

/** Linha da própria pessoa: só o valor e o mês passado. Nunca a posição. */
function LinhaMinha({ podio, meu, anterior, nivel, minimo }: { podio: Podio; meu: PodioPessoal["meu"]; anterior: number | null; nivel?: string; minimo: number }) {
  if (!meu || meu.valor == null) {
    const falta = (podio === "constantes" || podio === "respondidas") && meu && !meu.qualifica;
    return <>Você: ainda sem valor neste mês{falta ? ` · mínimo de ${minimo} retomadas` : ""}</>;
  }
  const forte = <strong className="font-semibold text-ink">{podio === "ensinam" ? `${Math.round(meu.valor)} ${Math.round(meu.valor) === 1 ? "contribuição" : "contribuições"}` : podio === "treino" ? `${Math.round(meu.valor)} pontos` : fmtValor(podio, meu.valor)}</strong>;
  const resto = podio === "constantes" || podio === "respondidas" ? ` ${PODIO_MEU[podio].rotulo}`
    : podio === "evoluiram" ? ` ${PODIO_MEU.evoluiram.rotulo}` : podio === "ensinam" ? " neste mês" : nivel ? ` · Nível ${nivel}` : "";
  const mesPassado = anterior != null && podio !== "ensinam" && podio !== "treino"
    ? ` · mês passado ${fmtValor(podio, anterior)}` : anterior != null && podio === "ensinam" ? ` · mês passado ${Math.round(anterior)}` : "";
  const noPodio = meu.no_podio ? " Você está no pódio." : "";
  const semMinimo = (podio === "constantes" || podio === "respondidas") && !meu.qualifica ? ` · abaixo do mínimo de ${minimo} retomadas` : "";
  return <>Você: {forte}{resto}{mesPassado}{semMinimo}.{noPodio}</>;
}

function Hall({ hall, carregando }: { hall: CampeaoHall[]; carregando: boolean }) {
  const meses = useMemo(() => [...new Set(hall.map((h) => h.mes))], [hall]);
  if (carregando) return <p className="text-sm text-ink-muted">Carregando…</p>;
  if (!meses.length) {
    return <p className="rounded-xl border border-line bg-surface px-5 py-6 text-[14.5px] text-ink-muted">O Hall do mês começa quando o primeiro mês fechar. No dia 1º os campeões de cada pódio aparecem aqui.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {meses.map((m) => (
        <section key={m} className="rounded-xl border border-line bg-surface px-5 py-4" aria-label={`Hall de ${nomeDoMesAno(m)}`}>
          <h2 className="text-[17px] font-semibold leading-6 text-ink">{capitalizar(nomeDoMesAno(m))}</h2>
          <p className="text-[13px] text-ink-muted">Quem liderou cada pódio</p>
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {PODIOS.map((p) => hall.find((h) => h.mes === m && h.podio === p)).filter(Boolean).map((h) => (
              <li key={h!.podio} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                <span className="text-ink">{PODIO_TITULO[h!.podio]}</span>
                <span className="font-semibold text-ink">{h!.nome}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Historico() {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-5">
      <h2 className="text-[17px] font-semibold text-ink">Meu desempenho e histórico</h2>
      <p className="mt-1 text-[14.5px] text-ink-muted">Suas simulações, notas e evolução continuam no Simulador IA.</p>
      <Link to="/simulador-ia" search={{ aba: "minhas" }} className="mt-3 inline-block text-[14.5px] font-medium text-gold-text hover:underline">
        Abrir meu histórico <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
