import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import {
  concluirAquecimento, iniciarAquecimento, responderMultipla, responderTexto,
} from "@/lib/aquecimento.functions";
import {
  CARTAO_ROTULO, MSG_SEM_CORRECAO, NIVEL_LABEL, type Cartao, type ResultadoCartao, type ResumoSessao, type SessaoAquecimento,
} from "@/lib/aquecimento";
import { GoldButton, OutlineButton, TopbarBreadcrumb } from "@/components/scripts/shared";
import { Overline, ErroDiscreto } from "@/components/cliente-disse/shared";
import { MarcianaEye } from "@/components/marciana/MarcianaEye";
import { STATUS_AQUECIMENTO_KEY, AvisosAquecimentoToggle } from "@/components/aquecimento/hooks";
import { cn } from "@/lib/utils";

const PRIMEIRA_KEY = "omnia-aquecimento-aviso-visto";
const lerVisto = () => { try { return localStorage.getItem(PRIMEIRA_KEY) === "1"; } catch { return false; } };
const gravarVisto = () => { try { localStorage.setItem(PRIMEIRA_KEY, "1"); } catch { /* sem armazenamento */ } };

type Estado = { resultado: ResultadoCartao | null; pulado: boolean };

export function AquecimentoPage({ temaId }: { temaId?: string }) {
  const qc = useQueryClient();
  const iniciarFn = useServerFn(iniciarAquecimento);
  const concluirFn = useServerFn(concluirAquecimento);
  const [sessao, setSessao] = useState<SessaoAquecimento | null>(null);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [atual, setAtual] = useState(0);
  const [limite, setLimite] = useState<{ usado: number; limite: number | null }>({ usado: 0, limite: null });
  const [resumo, setResumo] = useState<(ResumoSessao & { concluida: boolean }) | null>(null);
  const [aviso, setAviso] = useState(() => !lerVisto());
  const iniciou = useRef(false);

  const inicio = useMutation({
    mutationFn: () => iniciarFn({ data: { tema_id: temaId ?? null } }),
    onSuccess: (s) => {
      setSessao(s);
      setLimite(s.limite);
      const e: Record<string, Estado> = {};
      s.cartoes.forEach((c) => { if (c.resultado) e[c.exercicio_id] = { resultado: c.resultado, pulado: false }; });
      setEstados(e);
      const primeiroPendente = s.cartoes.findIndex((c) => !c.resultado);
      setAtual(primeiroPendente < 0 ? s.cartoes.length : primeiroPendente);
      if (s.concluida || (s.cartoes.length > 0 && primeiroPendente < 0)) void finalizar(s.sessao_id);
    },
  });

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    inicio.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finalizar(id: string) {
    try {
      const r = await concluirFn({ data: { sessao_id: id } });
      setResumo(r);
      qc.invalidateQueries({ queryKey: STATUS_AQUECIMENTO_KEY });
      qc.invalidateQueries({ queryKey: ["meu-mapa"] });
    } catch { /* a tela de resultado mostra o que já tem */ }
  }

  const cartoes = sessao?.cartoes ?? [];
  const terminou = !!sessao && (sessao.concluida || atual >= cartoes.length);

  function avancar() {
    if (!sessao) return;
    const prox = atual + 1;
    setAtual(prox);
    if (prox >= cartoes.length) void finalizar(sessao.sessao_id);
  }

  const titulo = temaId ? "Treino por tema" : "Aquecimento";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Treino e evolução" }, { label: "Aquecimento" }]} />

      {inicio.isPending && <ErroDiscreto>Montando o seu aquecimento…</ErroDiscreto>}
      {inicio.isError && (
        <div className="space-y-3">
          <h1 className="text-2xl font-medium text-ink">{titulo}</h1>
          <ErroDiscreto>Não consegui montar o aquecimento agora. Tente de novo.</ErroDiscreto>
          <OutlineButton onClick={() => inicio.mutate()}>Tentar de novo</OutlineButton>
        </div>
      )}

      {sessao && cartoes.length === 0 && !sessao.concluida && (
        <div className="space-y-2">
          <h1 className="text-2xl font-medium text-ink">{titulo}</h1>
          <p className="text-[14.5px] text-ink-muted">Ainda não há exercícios aprovados para montar o seu aquecimento. Volte mais tarde.</p>
        </div>
      )}

      {sessao && sessao.concluida && cartoes.length === 0 && !resumo && <ErroDiscreto>Carregando o resultado…</ErroDiscreto>}

      {sessao && cartoes.length > 0 && !terminou && (
        <>
          {aviso && !temaId && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
              <p className="text-[14px] text-ink">O Paulo vê a sua adesão e o seu nível por tema, não o que você escreve.</p>
              <OutlineButton className="h-9" onClick={() => { gravarVisto(); setAviso(false); }}>Entendi</OutlineButton>
            </div>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h1 className="text-2xl font-medium leading-8 text-ink">{titulo}</h1>
              <p className="text-[14px] text-ink-muted">Cartão {atual + 1} de {cartoes.length} · {CARTAO_ROTULO[cartoes[atual].tipo]}</p>
            </div>
            {limite.limite != null && <p className="text-[13px] text-ink-muted">Correções de hoje: {Math.min(limite.usado, limite.limite)} de {limite.limite}</p>}
          </div>
          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${cartoes.length}, minmax(0, 1fr))` }} aria-hidden>
            {cartoes.map((c, i) => <span key={c.exercicio_id} className={cn("h-1 rounded-full", i <= atual ? "bg-gold" : "bg-line")} />)}
          </div>

          <div className="mt-7">
            <CartaoView
              key={cartoes[atual].exercicio_id}
              sessaoId={sessao.sessao_id}
              cartao={cartoes[atual]}
              estado={estados[cartoes[atual].exercicio_id] ?? null}
              onResposta={(r, lim) => {
                setEstados((e) => ({ ...e, [cartoes[atual].exercicio_id]: { resultado: r, pulado: false } }));
                if (lim) setLimite(lim);
              }}
              onPular={() => { setEstados((e) => ({ ...e, [cartoes[atual].exercicio_id]: { resultado: null, pulado: true } })); avancar(); }}
              onProximo={avancar}
              ultimo={atual === cartoes.length - 1}
            />
          </div>
        </>
      )}

      {sessao && terminou && cartoes.length > 0 && (
        <Resultado cartoes={cartoes} estados={estados} resumo={resumo} temaId={temaId} />
      )}

      {sessao && <div className="mt-10"><AvisosAquecimentoToggle /></div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Um cartão
// ---------------------------------------------------------------------------

function CartaoView({
  sessaoId, cartao, estado, onResposta, onPular, onProximo, ultimo,
}: {
  sessaoId: string;
  cartao: Cartao;
  estado: Estado | null;
  onResposta: (r: ResultadoCartao, limite?: { usado: number; limite: number | null }) => void;
  onPular: () => void;
  onProximo: () => void;
  ultimo: boolean;
}) {
  const multiplaFn = useServerFn(responderMultipla);
  const textoFn = useServerFn(responderTexto);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const resultado = estado?.resultado ?? null;

  const multipla = useMutation({
    mutationFn: (indice: number) => multiplaFn({ data: { sessao_id: sessaoId, exercicio_id: cartao.exercicio_id, indice } }),
    onSuccess: (r) => onResposta(r),
    onError: (e) => { setEscolhida(null); setErro(e instanceof Error ? e.message : "Não consegui registrar agora."); },
  });
  const enviar = useMutation({
    mutationFn: () => textoFn({ data: { sessao_id: sessaoId, exercicio_id: cartao.exercicio_id, texto } }),
    onSuccess: (r) => { setErro(null); onResposta(r, r.limite); },
    // O texto digitado fica no campo: erro da IA ou limite não apagam o que a pessoa escreveu.
    onError: (e) => setErro(e instanceof Error && e.message ? e.message : MSG_SEM_CORRECAO),
  });

  const pensando = enviar.isPending;

  return (
    <div className="max-w-[720px]">
      {cartao.tipo === "multipla_escolha" && (
        <>
          <Overline>{cartao.tema_nome}</Overline>
          <p className="mt-2 text-[17px] leading-7 text-ink">{cartao.pergunta}</p>
          <ul className="mt-5 space-y-2">
            {cartao.alternativas.map((a) => {
              const mostrou = !!resultado;
              const certa = mostrou && resultado.correta_i === a.i;
              const errada = mostrou && escolhida === a.i && !certa;
              return (
                <li key={a.i}>
                  <button
                    type="button"
                    disabled={mostrou || multipla.isPending}
                    onClick={() => { setErro(null); setEscolhida(a.i); multipla.mutate(a.i); }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-[15px] text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default",
                      certa ? "border-gold bg-surface-2 font-medium" : errada ? "border-dashed border-ink" : "border-line-strong hover:bg-surface-2",
                    )}
                  >
                    <span>{a.texto}</span>
                    {certa && <Check className="h-4 w-4 shrink-0 text-gold" strokeWidth={2} aria-label="Resposta certa" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {resultado && (
            <div className="mt-5 rounded-lg bg-surface-2 px-4 py-3">
              <p className="text-[14.5px] font-semibold text-ink">{resultado.acertou ? "Você acertou." : "Não foi dessa vez."}</p>
              {resultado.explicacao && <p className="mt-1 text-[14.5px] leading-6 text-ink">{resultado.explicacao}</p>}
              {resultado.fonte && <p className="mt-1 text-[12.5px] text-ink-muted">Fonte: {resultado.fonte}</p>}
            </div>
          )}
        </>
      )}

      {cartao.tipo !== "multipla_escolha" && (
        <>
          {cartao.contexto && (
            <>
              <Overline>{cartao.tipo === "escrita" ? "O cliente disse" : "Mensagem para melhorar"}</Overline>
              <blockquote className="mt-2 border-l-2 border-gold pl-4 text-[17px] leading-7 text-ink">"{cartao.contexto}"</blockquote>
            </>
          )}
          <p className={cn("text-[14.5px] text-ink", cartao.contexto && "mt-5")}>{cartao.pergunta}</p>
          <div className="mt-5"><Overline>Sua resposta no WhatsApp</Overline></div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={!!resultado || pensando}
            rows={5}
            maxLength={1500}
            aria-label="Sua resposta no WhatsApp"
            className="mt-2 w-full rounded-lg border border-line-strong bg-surface px-4 py-3 text-[15px] leading-6 text-ink outline-none focus:border-gold disabled:opacity-70"
          />
          <p className="mt-2 text-[13px] text-ink-muted">Escreva como responderia ao cliente. Uma pergunta só por mensagem. Não escreva dados reais de clientes.</p>

          {!resultado && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <GoldButton disabled={!texto.trim() || pensando} onClick={() => { setErro(null); enviar.mutate(); }}>Enviar para nota</GoldButton>
              <OutlineButton className="h-[34px] px-3.5 text-[14px]" disabled={pensando} onClick={onPular}>Pular este cartão</OutlineButton>
              {pensando && (
                <span className="flex items-center gap-2 text-[13.5px] text-ink-muted" role="status">
                  <MarcianaEye size={26} state="thinking" /> Corrigindo…
                </span>
              )}
            </div>
          )}

          {resultado && (
            <div className="mt-5 rounded-lg border border-line bg-surface px-4 py-4">
              <div className="flex items-baseline gap-3">
                {resultado.nota != null && <span className="text-[34px] font-normal leading-none tabular-nums text-ink">{resultado.nota}</span>}
                <p className="text-[15px] font-semibold text-ink">
                  {resultado.nota != null ? `Nota ${resultado.nota}/10` : resultado.acertou ? "Você acertou." : "Quase lá."}
                </p>
              </div>
              {resultado.texto && <p className="mt-2 text-[14.5px] leading-6 text-ink">{resultado.texto}</p>}
              {resultado.resposta_aprovada && (
                <div className="mt-3 rounded-lg bg-surface-2 px-4 py-3">
                  <Overline>Resposta aprovada</Overline>
                  <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-6 text-ink">{resultado.resposta_aprovada}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {erro && <p role="alert" className="mt-3 text-[13.5px] text-ink">{erro}</p>}

      {resultado && (
        <div className="mt-5">
          <GoldButton onClick={onProximo}>{ultimo ? "Ver resultado" : "Próximo cartão"}</GoldButton>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

function Resultado({
  cartoes, estados, resumo, temaId,
}: { cartoes: Cartao[]; estados: Record<string, Estado>; resumo: (ResumoSessao & { concluida: boolean }) | null; temaId?: string }) {
  const respondidos = useMemo(() => cartoes.filter((c) => estados[c.exercicio_id]?.resultado), [cartoes, estados]);
  const [recusou, setRecusou] = useState(false);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-0">
      <div className="min-w-0 lg:pr-8">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-2xl font-medium leading-8 text-ink">{temaId ? "Treino concluído" : "Aquecimento concluído"}</h1>
          {resumo && (
            <p className="text-[14px] text-ink-muted">
              {resumo.minutos} {resumo.minutos === 1 ? "minuto" : "minutos"}
              {!temaId && ` · ${resumo.dias_semana} ${resumo.dias_semana === 1 ? "dia" : "dias"} nesta semana`}
            </p>
          )}
        </div>

        {respondidos.length === 0 ? (
          <p className="mt-5 text-[14.5px] text-ink-muted">Você pulou todos os cartões. Volte quando quiser: eles não contam como erro.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {respondidos.map((c) => {
              const r = estados[c.exercicio_id]!.resultado!;
              return (
                <li key={c.exercicio_id} className="rounded-xl border border-line bg-surface px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      {r.nota != null ? (
                        <span className="text-[30px] font-normal leading-none tabular-nums text-ink">{r.nota}</span>
                      ) : (
                        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", r.acertou ? "bg-gold text-on-gold" : "border border-dashed border-ink")}>
                          {r.acertou && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-ink">
                          {c.tipo === "escrita" ? "Objeção" : c.tema_nome}{c.titulo ? ` · ${c.titulo}` : ""}
                        </p>
                        {(r.texto || r.explicacao) && <p className="mt-0.5 text-[14px] leading-6 text-ink-muted">{r.texto ?? r.explicacao}</p>}
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold", r.nota != null && !r.acertou ? "border border-gold text-ink" : r.acertou ? "bg-gold text-on-gold" : "border border-dashed border-ink text-ink")}>
                      {r.nota != null ? `Nota ${r.nota}/10` : r.acertou ? "Acertou" : "Errou"}
                    </span>
                  </div>
                  {c.tipo === "escrita" && r.resposta_aprovada && (
                    <div className="mt-3 rounded-lg bg-surface-2 px-4 py-3">
                      <Overline>Resposta aprovada</Overline>
                      <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-6 text-ink">{r.resposta_aprovada}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside className="min-w-0 border-line lg:border-l lg:pl-8">
        {resumo?.simulador && !recusou && (
          <section aria-label="Treinar no Simulador">
            <Overline>Você foi mal em "{resumo.simulador.objecao}"</Overline>
            <h2 className="mt-2 text-xl font-medium leading-7 text-ink">Quer treinar 10 minutos no Simulador?</h2>
            {resumo.simulador.perfil && (
              <p className="mt-2 text-[14px] leading-6 text-ink-muted">
                Já escolhi o cliente mais parecido: {resumo.simulador.perfil.nome}{resumo.simulador.perfil.descricao ? `, ${resumo.simulador.perfil.descricao.toLowerCase()}` : ""}.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/simulador-ia"
                search={resumo.simulador.perfil ? { perfil: resumo.simulador.perfil.id } : {}}
                className="inline-flex h-10 items-center rounded-lg bg-gold px-[18px] text-[15px] font-semibold text-on-gold hover:brightness-105"
              >
                Treinar agora
              </Link>
              <OutlineButton className="h-[34px] self-center px-3.5 text-[14px]" onClick={() => setRecusou(true)}>Agora não</OutlineButton>
            </div>
          </section>
        )}
        {resumo && (
          <section className={cn(resumo.simulador && !recusou && "mt-8")} aria-label="Seu mapa">
            <Overline>Seu mapa</Overline>
            <p className="mt-2 text-[14px] leading-6 text-ink-muted">
              {resumo.mudancas.length > 0
                ? <>{resumo.mudancas.map((m) => `${m.tema_nome} subiu para "${NIVEL_LABEL[m.para]}"`).join(". ")}. </>
                : "Nenhum tema mudou de nível desta vez. "}
              <Link to="/meu-mapa" className="text-ink underline underline-offset-2 hover:text-gold">Ver Meu mapa →</Link>
            </p>
          </section>
        )}
        {!resumo && <ErroDiscreto>Carregando…</ErroDiscreto>}
      </aside>
    </div>
  );
}
