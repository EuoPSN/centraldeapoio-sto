import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MarcianaEye } from "@/components/marciana/MarcianaEye";
import { TopbarBreadcrumb } from "@/components/scripts/shared";
import { CopyText, DashedTag, ErroDiscreto, GoldPill, Overline } from "@/components/cliente-disse/shared";
import { CasosParecidos } from "@/components/biblioteca/CasosParecidos";
import { AdicionarRetomada } from "@/components/retomada/AdicionarRetomada";
import { apagarImagens, ConversaCard, useConversa } from "@/components/copiloto/ConversaCard";
import { UsoAviso, UsoContador } from "@/components/copiloto/UsoContador";
import { BaixarInteligenciaLink } from "@/components/copiloto/BaixarInteligencia";
import { analisarConversaCopiloto, getCopiloto } from "@/lib/copiloto.functions";
import { ERRO_ANALISE, ETAPA_FUNIL_NOME, type UsoStatus } from "@/lib/cerebro";
import { PONTO_LISTA } from "@/lib/retomada";
import type { CopilotoResultado } from "@/lib/cerebro.server";

export const COPILOTO_BASE_KEY = ["copiloto-base"] as const;

export function CopilotoPage() {
  const baseFn = useServerFn(getCopiloto);
  const analisarFn = useServerFn(analisarConversaCopiloto);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const base = useQuery({ queryKey: [...COPILOTO_BASE_KEY, "copiloto"], queryFn: () => baseFn({ data: { ferramenta: "copiloto" } }), staleTime: 30_000 });
  const conversa = useConversa(base.data?.atendente ?? "");
  const [resultado, setResultado] = useState<CopilotoResultado | null>(null);
  const [erro, setErro] = useState(false);
  const uso = base.data?.uso;

  const setUso = (u: UsoStatus) => qc.setQueryData([...COPILOTO_BASE_KEY, "copiloto"], (old: typeof base.data) => (old ? { ...old, uso: u } : old));

  const analisar = useMutation({
    mutationFn: async () => {
      let caminhos: string[] = [];
      try {
        caminhos = await conversa.subirImagens();
        return await analisarFn({ data: {
          texto: conversa.txt?.preparada.texto ?? "",
          ultima_mensagem: conversa.txt?.preparada.ultimaMensagem ?? null,
          caminhos,
          primeiro_nome_cliente: conversa.txt?.preparada.primeiroNomeCliente ?? null,
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
    // Mantém o que foi colado: só mostra o aviso.
    onError: () => setErro(true),
  });

  const r = resultado;
  const nomeCliente = r?.primeiro_nome_cliente || conversa.txt?.preparada.primeiroNomeCliente || null;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Inteligência" }, { label: "Copiloto" }]} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
          <h1 className="text-2xl font-medium leading-8 text-ink">Copiloto</h1>
          <p className="text-[14px] text-ink-muted">Cole o print ou anexe a conversa exportada. Ele sugere a próxima mensagem.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <BaixarInteligenciaLink />
          <UsoContador uso={uso} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div>
          <ConversaCard dataTour="copiloto-1" conversa={conversa} onAnalisar={() => analisar.mutate()} analisando={analisar.isPending} uso={uso}>
            {erro && <div className="mt-2"><ErroDiscreto>{ERRO_ANALISE}</ErroDiscreto></div>}
          </ConversaCard>
          <UsoAviso uso={uso} />
        </div>

        <div className="min-w-0 space-y-4" aria-live="polite">
          {analisar.isPending && (
            <div className="flex items-center gap-3 rounded-xl border border-line p-4 text-gold">
              <MarcianaEye size={26} state="thinking" />
              <p className="text-[14.5px] text-ink">Lendo a conversa…</p>
            </div>
          )}

          {!analisar.isPending && r && (
            <>
              <section className="flex flex-wrap items-center gap-4 rounded-xl border border-line p-4">
                <MarcianaEye size={26} state="done" className="shrink-0 text-gold" />
                <div className="min-w-0 flex-1">
                  <Overline>Onde está a conversa</Overline>
                  <p className="mt-0.5 text-[15px] leading-6 text-ink">
                    <strong className="font-semibold">{ETAPA_FUNIL_NOME[r.etapa]}</strong> · {r.resumo_onde_esta}
                  </p>
                </div>
                {r.objecoes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.objecoes.map((o, i) => (i === 0 ? <GoldPill key={o.id}>{o.nome}</GoldPill> : <DashedTag key={o.id}>{o.nome}</DashedTag>))}
                  </div>
                )}
              </section>

              <div data-tour="copiloto-2" className="grid gap-4 md:grid-cols-2">
                <Opcao titulo="Direta · puxa o próximo passo" texto={r.opcao_direta.texto} porque={r.opcao_direta.porque} />
                <Opcao titulo="Consultiva · aprofunda" texto={r.opcao_consultiva.texto} porque={r.opcao_consultiva.porque} />
              </div>

              <CasosParecidos dataTour="copiloto-3" compacto objecaoIds={r.objecoes.map((o) => o.id)} ponto={r.ponto_parada_sugerido} />

              <div className="grid gap-4 md:grid-cols-2">
                {r.objecoes.length > 0 ? (
                  <div data-tour="copiloto-4" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-line px-4 py-3">
                    <p className="text-[14px] text-ink"><span className="font-semibold">Objeção encontrada:</span> {r.objecoes[0].nome}</p>
                    <button
                      type="button" className="text-[14px] font-semibold text-gold-text hover:underline"
                      onClick={() => navigate({ to: "/scripts/cliente-disse", search: { aba: "objecoes", fala: r.objecoes[0].nome } })}
                    >
                      Ver em O cliente disse →
                    </button>
                  </div>
                ) : <span />}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-line px-4 py-3">
                  <p className="text-[14px] text-ink">
                    <span className="font-semibold">{nomeCliente ?? "Cliente"}</span>
                    {r.ponto_parada_sugerido && <> · {PONTO_LISTA[r.ponto_parada_sugerido]}</>}
                  </p>
                  <AdicionarRetomada
                    inicial={{ nome: nomeCliente, ponto: r.ponto_parada_sugerido }}
                    trigger={<button type="button" data-tour="copiloto-5" className="text-[14px] font-semibold text-gold-text hover:underline">Adicionar à retomada →</button>}
                  />
                </div>
              </div>
            </>
          )}

          {!analisar.isPending && !r && (
            <p className="rounded-xl border border-dashed border-line-strong p-6 text-[14px] leading-6 text-ink-muted">
              A sugestão aparece aqui. Ela lê a conversa, diz em que etapa do funil ela está e propõe duas mensagens: uma direta e uma consultiva.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Opcao({ titulo, texto, porque }: { titulo: string; texto: string; porque: string }) {
  return (
    <article className="flex flex-col rounded-xl border border-line p-4">
      <Overline className="text-gold-text">{titulo}</Overline>
      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-ink">{texto}</p>
      <div className="mt-3 border-t border-line pt-3">
        {porque && <p className="text-[13.5px] leading-5 text-ink-muted">Porque {porque.charAt(0).toLowerCase()}{porque.slice(1)}</p>}
        <div className="mt-3"><CopyText text={texto} /></div>
      </div>
    </article>
  );
}
