import { CasosParecidos } from "@/components/biblioteca/CasosParecidos";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  classificarFala, contarRespostaObjecao, enviarObjecaoParaPaulo, sugerirRespostaObjecao, type Classificacao,
} from "@/lib/cliente-disse.functions";
import {
  ANGULO_LABEL, ERRO_IA, type Angulo, type Etapa, type Leitura, type Objecao, type ObjecaoConteudo,
} from "@/lib/cliente-disse";
import { GoldButton, OutlineButton, SkeletonLine } from "@/components/scripts/shared";
import {
  CopyText, DashedTag, ErroDiscreto, GoldPill, Overline, useRegistrarUso, type ClienteDisseBase,
} from "@/components/cliente-disse/shared";
import { cn } from "@/lib/utils";

export function ObjecoesTab({
  base, falaInicial, onAbrirFechar,
}: {
  base: ClienteDisseBase | undefined;
  falaInicial?: string;
  onAbrirFechar: (etapa: Etapa, travamentoId?: string) => void;
}) {
  const classificar = useServerFn(classificarFala);
  const sugerir = useServerFn(sugerirRespostaObjecao);
  const [fala, setFala] = useState(falaInicial ?? "");
  const [enviada, setEnviada] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Classificacao | null>(null);
  const [aberto, setAberto] = useState(0);

  const sugestao = useMutation({
    mutationFn: (v: { fala: string; pendente_id: string | null }) => sugerir({ data: v }),
  });

  const mut = useMutation({
    mutationFn: (texto: string) => classificar({ data: { fala: texto } }),
    onSuccess: (r, texto) => {
      setResultado(r);
      setAberto(0);
      sugestao.reset();
      const objs = r.itens.filter((i) => i.tipo === "objecao");
      if (!objs.length && !r.nova) {
        const outro = r.itens.find((i) => i.tipo !== "objecao");
        const item = outro && base?.itens.find((x) => x.id === outro.id);
        if (item) {
          onAbrirFechar(item.etapa, item.tipo === "travamento" ? item.id : undefined);
          return;
        }
      }
      if (r.nova) sugestao.mutate({ fala: texto, pendente_id: r.pendente_id });
    },
  });

  const enviar = () => {
    const t = fala.trim();
    if (!t || mut.isPending) return;
    setEnviada(t);
    mut.mutate(t);
  };

  // Fala vinda da busca da Início: classifica sozinha uma vez.
  const autoRef = useRef(false);
  useEffect(() => {
    if (autoRef.current || !falaInicial?.trim() || !base) return;
    autoRef.current = true;
    setEnviada(falaInicial.trim());
    mut.mutate(falaInicial.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [falaInicial, base]);

  const objecoes = (resultado?.itens ?? [])
    .filter((i) => i.tipo === "objecao")
    .map((i) => ({ ...i, obj: base?.objecoes.find((o) => o.id === i.id) }))
    .filter((i): i is typeof i & { obj: Objecao } => !!i.obj);
  const extraFechar = (resultado?.itens ?? []).find((i) => i.tipo !== "objecao");
  const extraItem = extraFechar && base?.itens.find((x) => x.id === extraFechar.id);
  const atual = objecoes[aberto];

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 cursor-text flex-col rounded-lg border border-line-strong bg-surface px-4 py-2.5 transition-colors focus-within:border-gold focus-within:ring-1 focus-within:ring-gold">
          <span className="text-[12.5px] text-ink-muted">Fala do cliente</span>
          <textarea
            value={fala}
            rows={1}
            onChange={(e) => setFala(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Cole aqui a mensagem do cliente…"
            className="field-sizing-content max-h-40 min-h-6 w-full resize-none bg-transparent text-[15px] leading-6 text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
        <GoldButton onClick={enviar} disabled={!fala.trim() || mut.isPending} className="sm:self-center">
          {mut.isPending ? "Entendendo…" : "Entender"}
        </GoldButton>
      </div>

      {base && base.objecoes.length === 0 && !resultado && (
        <p className="mt-3 text-[13.5px] text-ink-muted">Nenhuma objeção publicada ainda.</p>
      )}

      <div className="mt-4" aria-live="polite">
        {mut.isPending && (
          <div className="space-y-2">
            <SkeletonLine className="h-4 w-56" />
            <SkeletonLine className="h-24 w-full" />
          </div>
        )}
        {mut.isError && <ErroDiscreto>{ERRO_IA}</ErroDiscreto>}

        {resultado && !mut.isPending && (
          <div className="space-y-6">
            {resultado.nova && (
              <ObjecaoNova
                fala={enviada ?? ""}
                pendenteId={resultado.pendente_id}
                loading={sugestao.isPending}
                erro={sugestao.isError}
                sugestao={sugestao.data ?? null}
                onRetry={() => sugestao.mutate({ fala: enviada ?? "", pendente_id: resultado.pendente_id })}
              />
            )}

            {objecoes.length > 1 && (
              <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink-muted">
                Encontrei <GoldPill>{objecoes.length} objeções</GoldPill> trate nesta ordem:
              </p>
            )}

            {atual && (
              <ObjecaoView
                objecao={atual.obj}
                numero={aberto + 1}
                mostrarNumero={objecoes.length > 1}
                outras={objecoes.map((o, idx) => ({ idx, nome: o.obj.nome })).filter((o) => o.idx !== aberto)}
                onAbrir={setAberto}
                motivo={aberto === 0 && objecoes.length > 1 ? objecoes[0].motivo_ordem ?? null : null}
                contagens={base?.contagens[atual.obj.id] ?? {}}
              />
            )}

            {!resultado.nova && objecoes.length === 0 && !extraItem && (
              <p className="text-[14px] text-ink-muted">Não encontrei objeção nessa fala.</p>
            )}

            {objecoes.length > 0 && <CasosParecidos objecaoIds={objecoes.map((o) => o.obj.id)} />}

            {extraItem && objecoes.length > 0 && (
              <p className="text-[13.5px] text-ink-muted">
                Também tem {extraItem.tipo === "sinal" ? "sinal de compra" : "travamento"} ({extraItem.titulo}).{" "}
                <button
                  type="button"
                  className="font-semibold text-gold-text hover:underline"
                  onClick={() => onAbrirFechar(extraItem.etapa, extraItem.tipo === "travamento" ? extraItem.id : undefined)}
                >
                  Abrir em Fechar com este cliente →
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Objeção aprovada
// ---------------------------------------------------------------------------

function ObjecaoView({
  objecao, numero, mostrarNumero, outras, onAbrir, motivo, contagens,
}: {
  objecao: Objecao;
  numero: number;
  mostrarNumero: boolean;
  outras: { idx: number; nome: string }[];
  onAbrir: (idx: number) => void;
  motivo: string | null;
  contagens: Record<string, number>;
}) {
  const registrar = useRegistrarUso();
  const usados = objecao.angulos.map((a) => contagens[a.tipo] ?? 0);
  const max = Math.max(0, ...usados);
  const maisUsado = max > 0 ? usados.indexOf(max) : -1;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-3">
        <h2 className="flex items-center gap-2.5 text-[20px] font-semibold leading-7 text-ink">
          {mostrarNumero && <NumeroCirculo n={numero} ativo />}
          {objecao.nome}
        </h2>
        {outras.map((o) => (
          <button
            key={o.idx}
            type="button"
            onClick={() => onAbrir(o.idx)}
            className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <NumeroCirculo n={o.idx + 1} />
            <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink-muted">{o.nome}</span>
            <span className="shrink-0 text-[12.5px] text-ink-muted">abrir →</span>
          </button>
        ))}
        <LeiturasBox leituras={objecao.leituras} />
        {objecao.evite_dizer && (
          <div className="rounded-r-lg border-l-[3px] border-ink bg-surface-2 px-4 py-3 text-[14px] leading-[22px] text-ink">
            <span className="font-semibold">Evite dizer:</span> {objecao.evite_dizer}
          </div>
        )}
        {motivo && <p className="text-[13px] leading-5 text-ink-muted">Por que esta primeiro: {motivo}</p>}
      </div>

      <div className="space-y-3">
        <AngulosGrid
          angulos={objecao.angulos}
          renderFooter={(a, i) => (
            <>
              <CopyText text={a.texto} onCopied={() => registrar({ objecao_id: objecao.id, angulo: a.tipo })} />
              <span className="text-[12px] text-ink-muted">
                usada {usados[i]}×{i === maisUsado ? " · mais usada" : ""}
              </span>
            </>
          )}
          destaque={maisUsado}
        />
        {objecao.pergunta_avancar && (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3 sm:flex-row sm:items-center">
            <Overline className="shrink-0 text-ink-muted sm:w-24">Para avançar</Overline>
            <p className="min-w-0 flex-1 text-[14px] leading-[22px] text-ink">
              Termine com: <span className="font-semibold">“{objecao.pergunta_avancar}”</span>
            </p>
            <CopyText text={objecao.pergunta_avancar} onCopied={() => registrar({ objecao_id: objecao.id, angulo: "avancar" })} />
          </div>
        )}
      </div>
    </div>
  );
}

function NumeroCirculo({ n, ativo }: { n: number; ativo?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
        ativo ? "bg-ink text-surface" : "bg-surface-2 text-ink",
      )}
    >
      {n}
    </span>
  );
}

export function LeiturasBox({ leituras }: { leituras: Leitura[] }) {
  const itens = leituras.filter((l) => l.titulo.trim() || l.pergunta.trim());
  if (!itens.length) return null;
  return (
    <div className="rounded-lg bg-sidebar px-4 py-3.5">
      <Overline>O que ele(a) pode querer dizer</Overline>
      <ul className="mt-2.5 space-y-3">
        {itens.map((l, i) => (
          <li key={i} className="text-[14px] leading-[21px]">
            <p className="font-semibold text-ink">{l.titulo}</p>
            {l.pergunta && (
              <p className="text-ink">
                Pergunte: <span className="text-gold-text">“{l.pergunta}”</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AngulosGrid({
  angulos, renderFooter, destaque = -1,
}: {
  angulos: Angulo[];
  renderFooter: (a: Angulo, i: number) => React.ReactNode;
  destaque?: number;
}) {
  const visiveis = angulos.filter((a) => a.texto.trim());
  if (!visiveis.length) return <p className="text-[13.5px] text-ink-muted">Sem respostas cadastradas para esta objeção.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {angulos.map((a, i) =>
        a.texto.trim() ? (
          <div
            key={i}
            className={cn("flex flex-col rounded-lg border p-4", i === destaque ? "border-gold" : "border-line")}
          >
            <Overline className="text-gold-text">
              {ANGULO_LABEL[a.tipo]}{a.rotulo ? ` · ${a.rotulo}` : ""}
            </Overline>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-[22px] text-ink">{a.texto}</p>
            <div className="mt-auto flex items-center justify-between gap-2 pt-4">{renderFooter(a, i)}</div>
          </div>
        ) : null,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Objeção nova (sugestão da IA, não aprovada)
// ---------------------------------------------------------------------------

function ObjecaoNova({
  fala, pendenteId, sugestao, loading, erro, onRetry,
}: {
  fala: string;
  pendenteId: string | null;
  sugestao: ObjecaoConteudo | null;
  loading: boolean;
  erro: boolean;
  onRetry: () => void;
}) {
  const enviarFn = useServerFn(enviarObjecaoParaPaulo);
  const contarFn = useServerFn(contarRespostaObjecao);
  const [contando, setContando] = useState(false);
  const [resposta, setResposta] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [contado, setContado] = useState(false);

  const enviar = useMutation({
    mutationFn: () => enviarFn({ data: { pendente_id: pendenteId! } }),
    onSuccess: () => { setEnviado(true); toast.success("Enviado para o Paulo."); },
    onError: () => toast.error("Não consegui enviar agora. Tente de novo."),
  });
  const contar = useMutation({
    mutationFn: () => contarFn({ data: { pendente_id: pendenteId!, texto: resposta } }),
    onSuccess: () => { setContado(true); setContando(false); setResposta(""); toast.success("Resposta guardada para o Paulo."); },
    onError: () => toast.error("Não consegui guardar agora. Tente de novo."),
  });

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink-muted">
        <DashedTag>Objeção nova</DashedTag>
        {pendenteId ? "nenhuma resposta aprovada parecida. Já entrou na fila do Paulo." : "nenhuma resposta aprovada parecida."}
      </p>

      <div className="rounded-2xl border border-dashed border-line-strong p-4 sm:p-5">
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-muted">
          <DashedTag>Sugestão da IA · não aprovada pelo Paulo</DashedTag>
          Confira antes de usar. Sem valores ou regras inventadas.
        </p>

        <div className="mt-4">
          {loading && (
            <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <SkeletonLine className="h-36 w-full" />
              <SkeletonLine className="h-36 w-full" />
            </div>
          )}
          {erro && !loading && (
            <p className="text-[13.5px] text-ink-muted">
              {ERRO_IA}{" "}
              <button type="button" onClick={onRetry} className="font-semibold text-gold-text hover:underline">Tentar de novo</button>
            </p>
          )}
          {sugestao && !loading && (
            <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <LeiturasBox leituras={sugestao.leituras} />
              <AngulosGrid angulos={sugestao.angulos} renderFooter={(a) => <CopyText text={a.texto} />} />
            </div>
          )}
        </div>

        {pendenteId && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <p className="min-w-0 flex-1 text-[13.5px] text-ink-muted">
                Respondeu de outro jeito? Conte o que mandou e o Paulo usa para aprovar a resposta oficial.
              </p>
              <OutlineButton className="h-9 text-[14px]" onClick={() => setContando((v) => !v)} disabled={contado}>
                {contado ? "Resposta enviada ✓" : "Contar o que respondi"}
              </OutlineButton>
              <GoldButton className="h-9 text-[14px]" onClick={() => enviar.mutate()} disabled={enviado || enviar.isPending}>
                {enviado ? "Enviado ✓" : "Enviar para o Paulo"}
              </GoldButton>
            </div>
            {contando && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  rows={3}
                  placeholder={`O que você respondeu para “${fala.slice(0, 60)}”?`}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-gold"
                />
                <div className="flex justify-end">
                  <OutlineButton className="h-9 text-[14px]" disabled={!resposta.trim() || contar.isPending} onClick={() => contar.mutate()}>
                    Guardar resposta
                  </OutlineButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
