import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { votarFicha } from "@/lib/biblioteca.functions";
import { PLANOS_FICHA, RODAPE_BIBLIOTECA, dataCurta, diasLabel, resumoFicha, type FichaPublica } from "@/lib/biblioteca";
import { PONTOS, PONTO_LABEL, type Ponto } from "@/lib/retomada";
import { ChoicePill, CopyText, Overline } from "@/components/cliente-disse/shared";
import { OutlineButton } from "@/components/scripts/shared";
import { BIBLIOTECA_CONVERSAS_KEY, useBibliotecaConversas } from "@/components/biblioteca/hooks";
import { inputCls } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";

// Biblioteca > "Conversas que fecharam": só fichas publicadas (a conversa original não existe aqui).

export interface FiltrosConversas { objecao?: string; ponto?: Ponto; plano?: string }

export function ConversasQueFecharam({ filtrosIniciais }: { filtrosIniciais?: FiltrosConversas }) {
  const q = useBibliotecaConversas();
  const [objecao, setObjecao] = useState<string | null>(filtrosIniciais?.objecao ?? null);
  const [ponto, setPonto] = useState<Ponto | null>(filtrosIniciais?.ponto ?? null);
  const [plano, setPlano] = useState<string | null>(filtrosIniciais?.plano ?? null);
  const [perfil, setPerfil] = useState("");
  const [selId, setSelId] = useState<string | null>(null);

  // Filtro vindo do link "Ver todos os casos na Biblioteca →".
  useEffect(() => {
    setObjecao(filtrosIniciais?.objecao ?? null);
    setPonto(filtrosIniciais?.ponto ?? null);
    setPlano(filtrosIniciais?.plano ?? null);
  }, [filtrosIniciais?.objecao, filtrosIniciais?.ponto, filtrosIniciais?.plano]);

  const fichas = q.data?.fichas ?? [];
  const chaveObj = (f: FichaPublica) => f.objecao_id ?? `rotulo:${f.objecao_rotulo.trim().toLowerCase()}`;
  const visiveis = useMemo(() => {
    const p = perfil.trim().toLowerCase();
    return fichas.filter((f) =>
      (!objecao || chaveObj(f) === objecao) &&
      (!ponto || f.ponto_parada === ponto) &&
      (!plano || f.plano === plano) &&
      (!p || f.perfil_cliente.toLowerCase().includes(p)));
  }, [fichas, objecao, ponto, plano, perfil]);

  const sel = visiveis.find((f) => f.id === selId) ?? visiveis[0] ?? null;
  const planosPresentes = PLANOS_FICHA.filter((p) => fichas.some((f) => f.plano === p));

  return (
    <div className="mt-4">
      {q.isError && <p className="py-4 text-[14px] text-ink-muted">Não consegui carregar as conversas agora. Tente de novo.</p>}

      {!q.isLoading && !q.isError && fichas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-[14.5px] leading-6 text-ink-muted">
          Ainda não há conversas publicadas. Quando você fechar uma venda, pode enviar a sua.
        </p>
      ) : (
        <>
          <div className="space-y-2 border-b border-line pb-3">
            <FiltroLinha rotulo="Objeção">
              <ChoicePill active={!objecao} onClick={() => setObjecao(null)}>Todas</ChoicePill>
              {(q.data?.objecoes ?? []).map((o) => {
                const k = o.id ?? `rotulo:${o.nome.toLowerCase()}`;
                return <ChoicePill key={k} active={objecao === k} onClick={() => setObjecao(objecao === k ? null : k)}>{o.nome}</ChoicePill>;
              })}
            </FiltroLinha>
            <FiltroLinha rotulo="Parou em">
              <ChoicePill active={!ponto} onClick={() => setPonto(null)}>Todas</ChoicePill>
              {PONTOS.map((p) => <ChoicePill key={p} active={ponto === p} onClick={() => setPonto(ponto === p ? null : p)}>{PONTO_LABEL[p]}</ChoicePill>)}
            </FiltroLinha>
            <FiltroLinha rotulo="Plano">
              <ChoicePill active={!plano} onClick={() => setPlano(null)}>Todos</ChoicePill>
              {planosPresentes.map((p) => <ChoicePill key={p} active={plano === p} onClick={() => setPlano(plano === p ? null : p)}>{p === "outro" ? "Outro" : p}</ChoicePill>)}
            </FiltroLinha>
            <FiltroLinha rotulo="Perfil">
              <input
                className={cn(inputCls, "h-8 max-w-[260px] rounded-full px-3 py-0 text-[13.5px]")}
                placeholder="Ex.: família, idoso…" value={perfil} onChange={(e) => setPerfil(e.target.value)} aria-label="Filtrar por perfil"
              />
            </FiltroLinha>
          </div>

          <div className="grid min-h-[480px] lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
            <ul className="border-line lg:border-r" aria-label="Conversas que fecharam">
              {q.isLoading && [0, 1, 2].map((i) => <li key={i} className="h-20 animate-pulse border-b border-line bg-surface-2/50" aria-hidden />)}
              {!q.isLoading && visiveis.length === 0 && <li className="px-4 py-8 text-[14px] text-ink-muted">Nenhuma conversa com esses filtros.</li>}
              {visiveis.map((f) => (
                <li key={f.id}>
                  <button
                    type="button" onClick={() => setSelId(f.id)} aria-current={sel?.id === f.id ? "true" : undefined}
                    className={cn(
                      "block w-full border-b border-l-2 border-b-line px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                      sel?.id === f.id ? "border-l-gold bg-sidebar" : "border-l-transparent hover:bg-sidebar/60",
                    )}
                  >
                    <span className="block text-[15px] font-semibold leading-5 text-ink">{f.titulo}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-muted">
                      {[f.objecao_rotulo && `Objeção: ${f.objecao_rotulo.toLowerCase()}`, PONTO_LABEL[f.ponto_parada], f.plano !== "outro" && f.plano].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {f.perfil_cliente && <Tag>{f.perfil_cliente}</Tag>}
                      {f.dias_ate_fechar != null && <Tag>{f.dias_ate_fechar === 0 ? "no mesmo dia" : `${f.dias_ate_fechar} ${f.dias_ate_fechar === 1 ? "dia" : "dias"}`}</Tag>}
                      {f.autor_nome && <Tag>por {f.autor_nome}</Tag>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="min-w-0 border-t border-line lg:border-t-0">
              {sel ? <FichaDetalhe key={sel.id} f={sel} /> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FiltroLinha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Overline className="w-[78px] shrink-0 text-ink-muted">{rotulo}</Overline>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-ink">{children}</span>;
}

function FichaDetalhe({ f }: { f: FichaPublica }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const votarFn = useServerFn(votarFicha);
  const [voto, setVoto] = useState<boolean | null>(f.meu_voto);
  const [motivo, setMotivo] = useState("");
  const [perguntando, setPerguntando] = useState(false);

  const votar = useMutation({
    mutationFn: (d: { util: boolean; motivo?: string }) => votarFn({ data: { ficha_id: f.id, ...d } }),
    onSuccess: (_, d) => {
      setVoto(d.util);
      setPerguntando(false);
      toast.success(d.util ? "Que bom que ajudou!" : "Obrigada pelo aviso.");
      qc.invalidateQueries({ queryKey: BIBLIOTECA_CONVERSAS_KEY });
    },
    onError: () => toast.error("Não consegui registrar agora. Tente de novo."),
  });

  const tags = [
    f.objecao_rotulo && `Objeção: ${f.objecao_rotulo.toLowerCase()}`,
    `Parou em: ${PONTO_LABEL[f.ponto_parada]}`,
    f.plano !== "outro" && `Plano: ${f.plano}`,
    f.perfil_cliente,
    diasLabel(f.dias_ate_fechar),
  ].filter(Boolean) as string[];

  return (
    <article className="px-0 py-5 lg:px-7" aria-label={f.titulo}>
      <Overline>Conversa que fechou{f.autor_nome ? ` · por ${f.autor_nome}` : ""}{f.publicada_em ? ` · publicada em ${dataCurta(f.publicada_em)}` : ""}</Overline>
      <h2 className="mt-2 text-[24px] font-medium leading-8 text-ink">{f.titulo}</h2>
      <div className="mt-3 flex flex-wrap gap-2">{tags.map((t) => <span key={t} className="rounded-full border border-line-strong px-3 py-1 text-[13px] text-ink">{t}</span>)}</div>

      <Secao titulo="Onde travou"><p className="text-[15px] leading-6 text-ink">{f.onde_travou}</p></Secao>
      <Secao titulo="O que a vendedora fez">
        <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-6 text-ink marker:text-ink-muted">{f.o_que_fez.map((p, i) => <li key={i}>{p}</li>)}</ol>
      </Secao>

      <div className="mt-4 rounded-xl bg-surface-2 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <Overline>Mensagem-chave</Overline>
          <CopyText text={f.mensagem_chave} variant="link" />
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[15.5px] leading-[1.55] text-ink [overflow-wrap:anywhere]">{f.mensagem_chave}</p>
      </div>

      {f.por_que_funcionou && <Secao titulo="Por que funcionou"><p className="text-[15px] leading-6 text-ink">{f.por_que_funcionou}</p></Secao>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <OutlineButton className={cn("h-9 gap-1.5 px-3 text-[14px]", voto === true && "border-ink bg-surface-2 font-semibold")} aria-pressed={voto === true} disabled={votar.isPending} onClick={() => votar.mutate({ util: true })}>
          <ThumbsUp className="h-4 w-4" strokeWidth={1.5} /> Isso ajudou
        </OutlineButton>
        <OutlineButton className={cn("h-9 gap-1.5 px-3 text-[14px]", voto === false && "border-ink bg-surface-2 font-semibold")} aria-pressed={voto === false} disabled={votar.isPending} onClick={() => setPerguntando(true)}>
          <ThumbsDown className="h-4 w-4" strokeWidth={1.5} /> Não ajudou
        </OutlineButton>
        {(f.objecao_id || f.objecao_rotulo) && (
          <OutlineButton className="ml-auto h-9 px-3 text-[14px]" onClick={() => navigate({ to: "/scripts/cliente-disse", search: { aba: "objecoes", fala: f.objecao_rotulo } })}>
            Abrir “O cliente disse…” com esta objeção
          </OutlineButton>
        )}
      </div>

      {perguntando && (
        <div className="mt-3 rounded-lg border border-line-strong p-3">
          <label className="block">
            <Overline className="mb-1 text-ink-muted">O que faltou? (opcional)</Overline>
            <input className={inputCls} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <div className="mt-2 flex gap-2">
            <OutlineButton className="h-8 px-3 text-[13.5px]" disabled={votar.isPending} onClick={() => votar.mutate({ util: false, motivo })}>Enviar</OutlineButton>
            <button type="button" className="text-[13.5px] text-ink-muted hover:text-ink" onClick={() => setPerguntando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <p className="mt-4 text-[12.5px] text-ink-muted">{RODAPE_BIBLIOTECA}</p>
      <span className="sr-only">{resumoFicha(f)}</span>
    </article>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 border-l-2 border-gold pl-4">
      <Overline>{titulo}</Overline>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
