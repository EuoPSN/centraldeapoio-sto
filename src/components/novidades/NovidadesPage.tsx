import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { TopbarBreadcrumb } from "@/components/scripts/shared";
import { NOVIDADES_KEY, STATUS_MUDANCAS_KEY, useNovidades } from "@/components/novidades/hooks";
import { checarMudanca, confirmarMudanca } from "@/lib/mudancas.functions";
import { ehImportante, type NovidadeView } from "@/lib/mudancas";
import { diaMes } from "@/components/novidades/formato";
import { cn } from "@/lib/utils";

type Aba = "confirmar" | "todas" | "importantes" | "informativas";

export function NovidadesPage() {
  const q = useNovidades();
  const [aba, setAba] = useState<Aba>("confirmar");
  const lista = useMemo(() => q.data ?? [], [q.data]);
  const pendentes = lista.filter((n) => n.pendente);

  const visiveis = useMemo(() => {
    if (aba === "confirmar") return pendentes;
    if (aba === "importantes") return lista.filter((n) => ehImportante(n.tipo));
    if (aba === "informativas") return lista.filter((n) => !ehImportante(n.tipo));
    return lista;
  }, [aba, lista, pendentes]);
  const importantes = visiveis.filter((n) => ehImportante(n.tipo));
  const informativas = visiveis.filter((n) => !ehImportante(n.tipo));

  const abas: { id: Aba; label: string }[] = [
    { id: "confirmar", label: `Para confirmar (${pendentes.length})` },
    { id: "todas", label: "Todas" },
    { id: "importantes", label: "Importantes" },
    { id: "informativas", label: "Informativas" },
  ];

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <TopbarBreadcrumb items={[{ label: "Novidades" }]} />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-[28px] font-medium leading-9 text-ink">Novidades</h1>
        <p className="text-[14.5px] text-ink-muted">O que mudou na Omnia e na empresa</p>
      </div>

      <div role="tablist" aria-label="Filtrar novidades" data-tour="novidades-1" className="mt-4 flex flex-wrap gap-x-6 border-b border-line">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              aba === a.id ? "border-gold font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {q.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
        {q.isError && (
          <div className="rounded-xl border border-line bg-surface px-5 py-5">
            <p className="text-[15px] text-ink">Não consegui carregar as novidades agora.</p>
            <button type="button" onClick={() => q.refetch()} className="mt-2 text-[14px] text-gold-text underline underline-offset-2">Tentar de novo</button>
          </div>
        )}

        {q.data && aba === "confirmar" && pendentes.length === 0 && (
          <div className="rounded-xl border border-line bg-surface px-5 py-6">
            <p className="text-[16px] font-medium text-ink">Tudo em dia.</p>
            <p className="mt-1 text-[14px] text-ink-muted">Nenhuma mudança importante esperando a sua confirmação.</p>
          </div>
        )}
        {q.data && aba !== "confirmar" && visiveis.length === 0 && (
          <p className="rounded-xl border border-line bg-surface px-5 py-6 text-[14.5px] text-ink-muted">Nada por aqui ainda.</p>
        )}

        {importantes.map((n, i) =>
          i === 0 ? (
            <div key={n.id} data-tour="novidades-2"><CartaoMudanca n={n} /></div>
          ) : (
            <CartaoMudanca key={n.id} n={n} />
          ),
        )}
      </div>

      {informativas.length > 0 && aba !== "confirmar" && (
        <section aria-label="Informativas" data-tour="novidades-3" className="mt-8">
          <h2 className="type-overline text-xs text-ink-muted">Informativas</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {informativas.map((n) => (
              <li key={n.id} className="flex items-baseline justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-[15px] text-ink">{n.title}</p>
                  {n.summary && n.summary !== n.title && <p className="mt-0.5 text-[13.5px] leading-5 text-ink-muted">{n.summary}</p>}
                </div>
                <span className="shrink-0 text-[13px] text-ink-muted">{diaMes(n.publicada_em)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 text-[13px] leading-5 text-ink-muted">
        Novidades importantes pedem &quot;Li e entendi&quot;. Aqui você encontra o histórico de tudo o que mudou.
      </p>
    </div>
  );
}

function CartaoMudanca({ n }: { n: NovidadeView }) {
  const qc = useQueryClient();
  const checarFn = useServerFn(checarMudanca);
  const confirmarFn = useServerFn(confirmarMudanca);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [resultado, setResultado] = useState<{ acertou: boolean; correta_i: number; explicacao: string } | null>(null);

  const checar = useMutation({
    mutationFn: (indice: number) => checarFn({ data: { entry_id: n.id, indice } }),
    onSuccess: setResultado,
    onError: () => { setEscolhida(null); toast.error("Não consegui conferir agora. Tente de novo."); },
  });
  const confirmar = useMutation({
    mutationFn: () => confirmarFn({ data: { entry_id: n.id, indice: escolhida } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOVIDADES_KEY });
      qc.invalidateQueries({ queryKey: STATUS_MUDANCAS_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui confirmar agora. Tente de novo."),
  });

  const urgente = n.tipo === "urgente";
  const vale = n.vale_a_partir ? `Vale a partir de ${diaMes(n.vale_a_partir)} · ` : "";
  const confirmado = !!n.confirmado_em;
  const podeConfirmar = !n.pergunta || resultado !== null;

  return (
    <article className="rounded-xl border border-gold/60 bg-surface px-5 py-4">
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {urgente && (
          <span className="rounded-full bg-destructive/90 px-2.5 py-0.5 text-[12px] font-semibold text-destructive-foreground">Urgente</span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 px-2.5 py-0.5 text-[12px] font-medium text-gold-text">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" /> Importante
        </span>
        <span className="text-[13px] text-ink-muted">{vale}{n.vale_a_partir ? "publicada" : "Publicada"} em {diaMes(n.publicada_em)}</span>
        {confirmado && (
          <span className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-gold-text">
            <Check className="h-3.5 w-3.5" strokeWidth={2} /> Você confirmou em {diaMes(n.confirmado_em!)}
          </span>
        )}
      </header>

      <h2 className="mt-2 text-[18px] font-semibold leading-6 text-ink">{n.title}</h2>
      <p className="mt-1.5 whitespace-pre-line text-[15px] leading-[1.6] text-ink">{n.summary}</p>

      {!confirmado && n.pergunta && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="type-overline text-xs text-ink-muted">Pergunta rápida para confirmar</p>
          <p className="mt-1.5 text-[15px] text-ink">{n.pergunta.pergunta}</p>
          <div role="radiogroup" aria-label={n.pergunta.pergunta} className="mt-2.5 space-y-2">
            {n.pergunta.alternativas.map((a, i) => {
              const marcada = escolhida === i;
              const certa = resultado?.correta_i === i;
              const errada = resultado && marcada && !resultado.acertou;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={marcada}
                  disabled={resultado !== null || checar.isPending}
                  onClick={() => { setEscolhida(i); checar.mutate(i); }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2 text-left text-[15px] text-ink transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                    !resultado && "border-line hover:border-line-strong",
                    resultado && certa && "border-gold bg-gold/10",
                    errada && "border-destructive/70",
                    resultado && !certa && !errada && "border-line opacity-70",
                  )}
                >
                  <span>{a.texto}</span>
                  {resultado && certa && <span className="shrink-0 text-[12.5px] font-medium text-gold-text">Resposta certa</span>}
                  {errada && <span className="shrink-0 text-[12.5px] font-medium text-destructive">Sua resposta</span>}
                </button>
              );
            })}
          </div>
          {resultado && (
            <p className="mt-2.5 text-[14px] leading-[1.55] text-ink-muted">
              <span className="font-medium text-ink">{resultado.acertou ? "Isso mesmo. " : "Quase. "}</span>
              {resultado.explicacao}
            </p>
          )}
        </div>
      )}

      {!confirmado && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            disabled={!podeConfirmar || confirmar.isPending}
            onClick={() => confirmar.mutate()}
            className="inline-flex h-10 items-center rounded-lg bg-gold px-[18px] text-[15px] font-semibold text-on-gold transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            Li e entendi
          </button>
          {n.link && <VerMudou link={n.link} />}
          {n.pergunta && !resultado && <span className="text-[13px] text-ink-muted">Responda a pergunta para liberar o botão.</span>}
        </div>
      )}
      {confirmado && n.link && <div className="mt-3"><VerMudou link={n.link} /></div>}
    </article>
  );
}

function VerMudou({ link }: { link: string }) {
  return (
    <Link to={link} className="text-[14px] font-medium text-gold-text hover:underline">
      Ver o que mudou →
    </Link>
  );
}
