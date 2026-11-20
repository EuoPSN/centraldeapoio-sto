import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MarcianaEye } from "@/components/marciana/MarcianaEye";
import { GoldButton, TopbarBreadcrumb } from "@/components/scripts/shared";
import { CopyText, ErroDiscreto, Overline } from "@/components/cliente-disse/shared";
import { apagarImagens, ConversaCard, useConversa } from "@/components/copiloto/ConversaCard";
import { UsoAviso, UsoContador } from "@/components/copiloto/UsoContador";
import { BaixarInteligenciaLink } from "@/components/copiloto/BaixarInteligencia";
import { COPILOTO_BASE_KEY } from "@/components/copiloto/CopilotoPage";
import { fazerRaiox, getCopiloto, getRetomadaParaRaiox } from "@/lib/copiloto.functions";
import { ERRO_ANALISE, type RaioxResposta, type UsoStatus } from "@/lib/cerebro";
import { fmtDiaMes } from "@/lib/retomada";

function fmtMin(n: number) {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60), m = n % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function RaioxPage({ retomadaId }: { retomadaId?: string }) {
  const baseFn = useServerFn(getCopiloto);
  const raioxFn = useServerFn(fazerRaiox);
  const retFn = useServerFn(getRetomadaParaRaiox);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const base = useQuery({ queryKey: [...COPILOTO_BASE_KEY, "raiox"], queryFn: () => baseFn({ data: { ferramenta: "raiox" } }), staleTime: 30_000 });
  const ret = useQuery({ queryKey: ["raiox-retomada", retomadaId], enabled: !!retomadaId, queryFn: () => retFn({ data: { id: retomadaId! } }) });
  const conversa = useConversa(base.data?.atendente ?? "");
  const [resultado, setResultado] = useState<RaioxResposta | null>(null);
  const [erro, setErro] = useState(false);
  const uso = base.data?.uso;

  const setUso = (u: UsoStatus) => qc.setQueryData([...COPILOTO_BASE_KEY, "raiox"], (old: typeof base.data) => (old ? { ...old, uso: u } : old));

  const analisar = useMutation({
    mutationFn: async () => {
      let caminhos: string[] = [];
      try {
        caminhos = await conversa.subirImagens();
        return await raioxFn({ data: {
          texto: conversa.txt?.preparada.texto ?? "",
          ultima_mensagem: conversa.txt?.preparada.ultimaMensagem ?? null,
          caminhos,
          primeiro_nome_cliente: conversa.txt?.preparada.primeiroNomeCliente ?? ret.data?.primeiro_nome ?? null,
          tempo_resposta: conversa.txt?.preparada.tempoResposta ?? null,
          retomada_id: ret.data?.id ?? null,
        } });
      } finally {
        void apagarImagens(caminhos);
      }
    },
    onMutate: () => setErro(false),
    onSuccess: (r) => {
      setUso(r.uso);
      if (r.ok) setResultado(r.resultado);
    },
    onError: () => setErro(true),
  });

  const r = resultado;
  const subtitulo = ret.data
    ? `Venda perdida · ${ret.data.primeiro_nome} · ${ret.data.ponto_label} · ${fmtDiaMes(ret.data.data)}`
    : "Cole o print ou anexe a conversa exportada de uma venda que não fechou.";

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Inteligência" }, { label: "Raio-X" }]} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
          <h1 className="text-2xl font-medium leading-8 text-ink">Raio-X da venda</h1>
          <p className="text-[14px] text-ink-muted">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <BaixarInteligenciaLink />
          <UsoContador uso={uso} />
        </div>
      </div>

      {!r && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div>
            <ConversaCard conversa={conversa} onAnalisar={() => analisar.mutate()} analisando={analisar.isPending} rotuloBotao="Fazer Raio-X" uso={uso}>
              {erro && <div className="mt-2"><ErroDiscreto>{ERRO_ANALISE}</ErroDiscreto></div>}
            </ConversaCard>
            <UsoAviso uso={uso} />
          </div>
          <div className="min-w-0" aria-live="polite">
            {analisar.isPending ? (
              <div className="flex items-center gap-3 rounded-xl border border-line p-4 text-gold">
                <MarcianaEye size={26} state="thinking" />
                <p className="text-[14.5px] text-ink">Lendo a conversa…</p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line-strong p-6 text-[14px] leading-6 text-ink-muted">
                O Raio-X mostra onde a venda se perdeu, o que faltou de técnica, como você poderia ter respondido e um hábito para treinar.
              </p>
            )}
          </div>
        </div>
      )}

      {r && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            <section>
              <Overline>Onde perdeu</Overline>
              <div className="mt-2 rounded-r-lg border-l-[3px] border-gold bg-surface-2 p-4">
                <p className="text-[15px] leading-6 text-ink">{r.onde_perdeu.descricao}</p>
                {(r.onde_perdeu.fala_cliente || r.onde_perdeu.fala_atendente) && (
                  <p className="mt-2 text-[14px] leading-6 text-ink-muted">
                    {r.onde_perdeu.fala_cliente && <>Ele: <strong className="font-semibold text-ink">“{r.onde_perdeu.fala_cliente}”</strong></>}
                    {r.onde_perdeu.fala_cliente && r.onde_perdeu.fala_atendente && " · "}
                    {r.onde_perdeu.fala_atendente && <>Você: <strong className="font-semibold text-ink">“{r.onde_perdeu.fala_atendente}”</strong></>}
                  </p>
                )}
                {r.tempo_resposta && (
                  <p className="mt-2 text-[13.5px] text-ink-muted">Tempo de resposta: média {fmtMin(r.tempo_resposta.mediaMin)} · maior espera {fmtMin(r.tempo_resposta.maiorMin)}</p>
                )}
              </div>
            </section>

            {r.faltou.length > 0 && (
              <section>
                <Overline>O que faltou</Overline>
                <ul className="mt-2">
                  {r.faltou.map((f, i) => (
                    <li key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-line py-3 first:pt-1">
                      <span className="inline-flex shrink-0 items-center rounded-full border border-ink px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink">{f.tecnica}</span>
                      <span className="min-w-0 flex-1 text-[14.5px] leading-6 text-ink">{f.explicacao}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <Overline>Como eu responderia</Overline>
              <div className="mt-2 rounded-xl border border-line p-4">
                {r.reescrita.original && <p className="text-[14px] leading-6 text-ink-muted line-through">{r.reescrita.original}</p>}
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-ink">{r.reescrita.sugerida}</p>
                <div className="mt-3"><CopyText text={r.reescrita.sugerida} /></div>
              </div>
            </section>

            {r.escrita.length > 0 && (
              <section>
                <Overline>Qualidade da escrita</Overline>
                <ul className="mt-2">
                  {r.escrita.map((e, i) => (
                    <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line py-2 text-[14.5px]">
                      <span className="text-ink-muted line-through">{e.errado}</span>
                      <span aria-hidden className="text-[12px] text-ink-muted">→</span>
                      <span className="text-ink">{e.certo}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border border-line p-4">
              <Overline>Hábito para treinar</Overline>
              <h2 className="mt-2 text-[18px] font-medium leading-6 text-ink">{r.habito.titulo}</h2>
              {r.habito.descricao && <p className="mt-2 text-[14px] leading-5 text-ink-muted">{r.habito.descricao}</p>}
              <GoldButton
                className="mt-4 w-full"
                onClick={() => navigate({ to: "/simulador-ia", search: r.perfil_id ? { perfil: r.perfil_id } : {} })}
              >
                Treinar no Simulador
              </GoldButton>
            </div>
            <p className="rounded-xl border border-dashed border-line-strong p-3 text-[13px] leading-5 text-ink-muted">
              O Paulo vê o resumo dos seus Raio-X (técnicas e trechos, sem dados do cliente) para te ajudar a evoluir. A conversa completa não fica guardada.
            </p>
            <button
              type="button" className="text-[14px] font-semibold text-gold-text hover:underline"
              onClick={() => { setResultado(null); conversa.limpar(); }}
            >
              Fazer outro Raio-X
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
