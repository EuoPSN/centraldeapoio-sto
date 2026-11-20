import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { getBibliotecaConversas, votarFicha, type BibliotecaConversas } from "@/lib/fichas.functions";
import {
  PERFIL_TAGS, PLANOS_FICHA, RODAPE_BIBLIOTECA, dataCurta, diasLabel, perfilTags, resumoFicha, tituloFicha,
  type FichaBiblioteca, type PerfilTagId,
} from "@/lib/fichas";
import { PONTOS, PONTO_CURTO, PONTO_LABEL, type Ponto } from "@/lib/retomada";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { ChoicePill, CopyText, Overline } from "@/components/cliente-disse/shared";
import { cn } from "@/lib/utils";

export const BIBLIOTECA_CONVERSAS_KEY = ["biblioteca-conversas"] as const;

export interface FiltrosConversas {
  objecao?: string;
  ponto?: Ponto;
  plano?: string;
  perfil?: PerfilTagId;
  ficha?: string;
}

export function ConversasQueFecharam({ filtros, onFiltros }: { filtros: FiltrosConversas; onFiltros: (f: FiltrosConversas) => void }) {
  const fn = useServerFn(getBibliotecaConversas);
  const q = useQuery({ queryKey: BIBLIOTECA_CONVERSAS_KEY, queryFn: () => fn({}), staleTime: 30_000 });
  const dados = q.data;

  const lista = useMemo(() => {
    if (!dados) return [];
    return dados.fichas.filter((f) =>
      (!filtros.objecao || f.objecao_id === filtros.objecao) &&
      (!filtros.ponto || f.ponto_parada === filtros.ponto) &&
      (!filtros.plano || f.plano === filtros.plano) &&
      (!filtros.perfil || perfilTags(f.perfil_cliente).includes(filtros.perfil)));
  }, [dados, filtros]);

  const sel = lista.find((f) => f.id === filtros.ficha) ?? lista[0] ?? null;
  const set = (p: Partial<FiltrosConversas>) => onFiltros({ ...filtros, ficha: undefined, ...p });

  if (q.isLoading) {
    return <div className="mt-5 space-y-2" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-2" />)}</div>;
  }
  if (q.isError || !dados) {
    return <p className="mt-6 text-[14px] text-ink-muted">Não consegui carregar as conversas agora. Tente de novo.</p>;
  }
  if (dados.fichas.length === 0) {
    return (
      <div className="mt-8 px-1 py-8">
        <p className="text-[15px] font-medium text-ink">Ainda não há conversas publicadas.</p>
        <p className="mt-1 text-[14px] text-ink-muted">Quando você fechar uma venda, pode enviar a sua.</p>
      </div>
    );
  }

  // Só as opções que existem nas fichas publicadas.
  const objecoesComFicha = dados.objecoes.filter((o) => dados.fichas.some((f) => f.objecao_id === o.id));
  const planosComFicha = PLANOS_FICHA.filter((p) => p !== "outro" && dados.fichas.some((f) => f.plano === p));
  const pontosComFicha = PONTOS.filter((p) => dados.fichas.some((f) => f.ponto_parada === p));
  const perfisComFicha = PERFIL_TAGS.filter((t) => dados.fichas.some((f) => perfilTags(f.perfil_cliente).includes(t.id)));

  return (
    <div className="mt-4">
      <div className="space-y-2.5 border-b border-line pb-4">
        <Filtro rotulo="Objeção">
          <ChoicePill active={!filtros.objecao} onClick={() => set({ objecao: undefined })}>Todas</ChoicePill>
          {objecoesComFicha.map((o) => <ChoicePill key={o.id} active={filtros.objecao === o.id} onClick={() => set({ objecao: o.id })}>{o.nome}</ChoicePill>)}
        </Filtro>
        <Filtro rotulo="Parou em">
          <ChoicePill active={!filtros.ponto} onClick={() => set({ ponto: undefined })}>Todas</ChoicePill>
          {pontosComFicha.map((p) => <ChoicePill key={p} active={filtros.ponto === p} onClick={() => set({ ponto: p })}>{PONTO_CURTO[p]}</ChoicePill>)}
        </Filtro>
        {planosComFicha.length > 0 && (
          <Filtro rotulo="Plano">
            <ChoicePill active={!filtros.plano} onClick={() => set({ plano: undefined })}>Todos</ChoicePill>
            {planosComFicha.map((p) => <ChoicePill key={p} active={filtros.plano === p} onClick={() => set({ plano: p })}>{p}</ChoicePill>)}
          </Filtro>
        )}
        {perfisComFicha.length > 0 && (
          <Filtro rotulo="Perfil">
            <ChoicePill active={!filtros.perfil} onClick={() => set({ perfil: undefined })}>Todos</ChoicePill>
            {perfisComFicha.map((t) => <ChoicePill key={t.id} active={filtros.perfil === t.id} onClick={() => set({ perfil: t.id })}>{t.label}</ChoicePill>)}
          </Filtro>
        )}
      </div>

      {lista.length === 0 ? (
        <div className="py-8">
          <p className="text-[14.5px] text-ink">Nenhuma conversa com esses filtros.</p>
          <button type="button" className="mt-2 text-[14px] font-semibold text-gold-text hover:underline" onClick={() => onFiltros({})}>Limpar filtros</button>
        </div>
      ) : (
        <div className="grid min-h-[480px] lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
          <ul className="border-line lg:border-r" aria-label="Conversas que fecharam">
            {lista.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onFiltros({ ...filtros, ficha: f.id })}
                  aria-current={f.id === sel?.id ? "true" : undefined}
                  className={cn(
                    "block w-full border-b border-l-2 border-b-line px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                    f.id === sel?.id ? "border-l-gold bg-sidebar" : "border-l-transparent hover:bg-sidebar/60",
                  )}
                >
                  <span className="block text-[15px] font-semibold leading-6 text-ink">{tituloFicha(f)}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-muted">{resumoFicha(f)}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {[f.perfil_cliente, diasLabel(f.dias_ate_fechar), `por ${f.autor}`].filter(Boolean).map((t) => (
                      <span key={t} className="rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-ink">{t}</span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {sel && <FichaView key={sel.id} ficha={sel} dados={dados} />}
        </div>
      )}
    </div>
  );
}

function Filtro({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Overline className="mr-1.5 w-20 shrink-0 text-ink-muted">{rotulo}</Overline>
      {children}
    </div>
  );
}

function FichaView({ ficha: f, dados }: { ficha: FichaBiblioteca; dados: BibliotecaConversas }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const votarFn = useServerFn(votarFicha);
  const [voto, setVoto] = useState<boolean | null>(f.meu_voto);
  const [perguntando, setPerguntando] = useState(false);
  const [motivo, setMotivo] = useState("");
  useEffect(() => setVoto(f.meu_voto), [f.meu_voto]);

  const votar = useMutation({
    mutationFn: (v: { util: boolean; motivo?: string }) => votarFn({ data: { ficha_id: f.id, util: v.util, motivo: v.motivo ?? null } }),
    onSuccess: (_r, v) => {
      setVoto(v.util);
      setPerguntando(false);
      qc.setQueryData<BibliotecaConversas>(BIBLIOTECA_CONVERSAS_KEY, (old) => old && { ...old, fichas: old.fichas.map((x) => (x.id === f.id ? { ...x, meu_voto: v.util } : x)) });
      toast.success(v.util ? "Que bom que ajudou." : "Obrigado pelo aviso.");
    },
    onError: () => toast.error("Não consegui registrar agora."),
  });

  const objecao = dados.objecoes.find((o) => o.id === f.objecao_id);
  const sobre = [f.objecao_rotulo ? `Objeção: ${f.objecao_rotulo.toLowerCase()}` : "", `Parou em: ${PONTO_LABEL[f.ponto_parada]}`, f.plano !== "outro" ? `Plano: ${f.plano}` : ""].filter(Boolean);
  const tags = [f.perfil_cliente, f.dias_ate_fechar != null ? `Fechou ${f.dias_ate_fechar === 0 ? "no mesmo dia" : `em ${diasLabel(f.dias_ate_fechar)}`}` : ""].filter(Boolean);

  return (
    <article className="min-w-0 px-0 py-5 lg:px-7" aria-label={tituloFicha(f)}>
      <Overline>Conversa que fechou · por {f.autor}{f.publicada_em ? ` · aprovada em ${dataCurta(f.publicada_em)}` : ""}</Overline>
      <h2 className="mt-2 text-[24px] font-medium leading-8 text-ink">{tituloFicha(f)}</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {[...sobre, ...tags].map((t) => <span key={t} className="rounded-full border border-line-strong px-3 py-1 text-[13px] text-ink">{t}</span>)}
      </div>

      <Bloco titulo="Onde travou"><p className="text-[15px] leading-6 text-ink">{f.onde_travou}</p></Bloco>

      <Bloco titulo="O que fez">
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-6 text-ink marker:text-ink">
          {f.o_que_fez.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      </Bloco>

      <div className="mt-4 rounded-xl bg-surface-2 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <Overline>Mensagem-chave</Overline>
          <CopyText text={f.mensagem_chave} variant="link" />
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[15.5px] leading-[1.55] text-ink [overflow-wrap:anywhere]">{f.mensagem_chave}</p>
      </div>

      {f.por_que_funcionou && <Bloco titulo="Por que funcionou"><p className="text-[15px] leading-6 text-ink">{f.por_que_funcionou}</p></Bloco>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <OutlineButton type="button" className={cn("h-9 gap-1.5 text-[14px]", voto === true && "border-gold bg-surface-2")} aria-pressed={voto === true} disabled={votar.isPending} onClick={() => votar.mutate({ util: true })}>
          <ThumbsUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Isso ajudou
        </OutlineButton>
        <OutlineButton type="button" className={cn("h-9 gap-1.5 text-[14px]", voto === false && "border-gold bg-surface-2")} aria-pressed={voto === false} disabled={votar.isPending} onClick={() => setPerguntando(true)}>
          <ThumbsDown className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Não ajudou
        </OutlineButton>
        {objecao && (
          <OutlineButton type="button" className="ml-auto h-9 text-[14px]" onClick={() => navigate({ to: "/scripts/cliente-disse", search: { aba: "objecoes", objecao: objecao.id } })}>
            Abrir “O cliente disse…” com esta objeção
          </OutlineButton>
        )}
      </div>

      {perguntando && (
        <div className="mt-3 rounded-lg border border-line-strong p-3">
          <label htmlFor="motivo-voto" className="text-[13.5px] text-ink">O que faltou? (opcional)</label>
          <input id="motivo-voto" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-gold" />
          <div className="mt-2 flex gap-2">
            <GoldButton type="button" className="h-9 text-[14px]" disabled={votar.isPending} onClick={() => votar.mutate({ util: false, motivo: motivo.trim() })}>Enviar</GoldButton>
            <OutlineButton type="button" className="h-9 text-[14px]" onClick={() => votar.mutate({ util: false })}>Pular</OutlineButton>
          </div>
        </div>
      )}

      <p className="mt-4 text-[12.5px] leading-5 text-ink-muted">{RODAPE_BIBLIOTECA}</p>
    </article>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 border-l-[3px] border-gold pl-4">
      <Overline className="mb-1.5">{titulo}</Overline>
      {children}
    </section>
  );
}
