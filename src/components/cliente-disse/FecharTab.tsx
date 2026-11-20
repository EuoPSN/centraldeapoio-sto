import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  concluirCaso, listMeusCasos, salvarCaso,
} from "@/lib/cliente-disse.functions";
import { criarRetomadaDeCaso } from "@/lib/retomada.functions";
import { RETOMADA_BASE_KEY, RETOMADA_CONTAGEM_KEY } from "@/components/retomada/hooks";
import {
  ETAPA_LABEL, PLANOS, PLANO_LABEL, SUBETAPAS, brl, calcularEconomia, preencherTemplate, textoEconomia, usoLabel,
  type Caso, type CasoEtapa, type CasoUso, type Etapa, type FechamentoItem, type ItemAmor,
} from "@/lib/cliente-disse";
import { GoldButton, OutlineButton, normalize } from "@/components/scripts/shared";
import { ChoicePill, CopyText, Overline, useRegistrarUso, type ClienteDisseBase } from "@/components/cliente-disse/shared";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const CASOS_KEY = ["cliente-disse-casos"] as const;

type CasoDraft = Omit<Caso, "id" | "created_at" | "updated_at" | "retomar_em"> & { id?: string; retomar_em: string | null };

const casoVazio = (etapa: CasoEtapa = "proposta"): CasoDraft => ({
  primeiro_nome: "", dependentes: 0, plano: null, usos: [], etapa, retomar_em: null,
});

function hojeISO(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function FecharTab({
  base, etapaInicial, travamentoInicial,
}: {
  base: ClienteDisseBase | undefined;
  etapaInicial?: Etapa;
  travamentoInicial?: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMeusCasos);
  const salvarFn = useServerFn(salvarCaso);
  const concluirFn = useServerFn(concluirCaso);
  const retomarFn = useServerFn(criarRetomadaDeCaso);
  const casosQ = useQuery({ queryKey: CASOS_KEY, queryFn: () => listFn({}) });
  const casos = casosQ.data ?? [];

  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CasoDraft>(casoVazio(etapaInicial));
  const [travamento, setTravamento] = useState<string | null>(travamentoInicial ?? null);
  const [comEconomia, setComEconomia] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const dirty = useRef(false);

  // Primeira carga: abre o caso mais recente (e aplica a etapa vinda da classificação).
  const iniciou = useRef(false);
  useEffect(() => {
    if (iniciou.current || !casosQ.data) return;
    iniciou.current = true;
    const primeiro = casosQ.data[0];
    if (primeiro) {
      if (etapaInicial && etapaInicial !== primeiro.etapa) dirty.current = true;
      setSelId(primeiro.id);
      setDraft({ ...primeiro, etapa: etapaInicial ?? primeiro.etapa });
    }
  }, [casosQ.data, etapaInicial]);

  // Travamento vindo da aba Objeções: muda a etapa e abre o travamento.
  useEffect(() => {
    if (etapaInicial) setDraft((d) => ({ ...d, etapa: etapaInicial }));
    setTravamento(travamentoInicial ?? null);
  }, [etapaInicial, travamentoInicial]);

  const salvar = useMutation({
    mutationFn: (d: CasoDraft) => salvarFn({
      data: { id: d.id, primeiro_nome: d.primeiro_nome, dependentes: d.dependentes, plano: d.plano, usos: d.usos, etapa: d.etapa },
    }),
    onSuccess: (c) => {
      qc.setQueryData<Caso[]>(CASOS_KEY, (old) => {
        const rest = (old ?? []).filter((x) => x.id !== c.id);
        return [c, ...rest];
      });
    },
    onError: () => toast.error("Não consegui salvar o caso agora."),
  });

  // Tudo salva sozinho (com uma pequena espera depois da última mudança).
  useEffect(() => {
    if (!dirty.current || !draft.id) return;
    const t = setTimeout(() => { dirty.current = false; salvar.mutate(draft); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const mudar = (patch: Partial<CasoDraft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  };

  const novoCaso = useMutation({
    mutationFn: () => salvarFn({ data: { primeiro_nome: "", dependentes: 0, plano: null, usos: [], etapa: draft.id ? "proposta" : draft.etapa } }),
    onSuccess: (c) => {
      qc.setQueryData<Caso[]>(CASOS_KEY, (old) => [c, ...(old ?? [])]);
      setSelId(c.id);
      setDraft({ ...c });
      setTravamento(null);
    },
    onError: () => toast.error("Não consegui criar o caso agora."),
  });

  const concluir = useMutation({
    mutationFn: (id: string) => concluirFn({ data: { id } }),
    onSuccess: (_r, id) => {
      const resto = (qc.getQueryData<Caso[]>(CASOS_KEY) ?? []).filter((c) => c.id !== id);
      qc.setQueryData<Caso[]>(CASOS_KEY, resto);
      toast.success("Venda concluída. O caso foi apagado.");
      const prox = resto[0];
      setSelId(prox?.id ?? null);
      setDraft(prox ? { ...prox } : casoVazio());
    },
    onError: () => toast.error("Não consegui encerrar o caso agora."),
  });

  const retomar = useMutation({
    // Cria um ticket em "Retomar hoje" (origem fechamento, travou no fechamento, D+1 amanhã).
    mutationFn: (id: string) => retomarFn({ data: { caso_id: id } }),
    onSuccess: () => {
      setDraft((d) => ({ ...d, retomar_em: hojeISO(1) }));
      qc.invalidateQueries({ queryKey: CASOS_KEY });
      qc.invalidateQueries({ queryKey: RETOMADA_BASE_KEY });
      qc.invalidateQueries({ queryKey: RETOMADA_CONTAGEM_KEY });
      toast.success("Guardado em “Retomar hoje” para amanhã.");
    },
    onError: () => toast.error("Não consegui guardar agora."),
  });

  const escolher = (c: Caso) => {
    if (dirty.current && draft.id) { dirty.current = false; salvar.mutate(draft); }
    setSelId(c.id);
    setDraft({ ...c });
    setTravamento(null);
  };

  const etapa: Etapa = draft.etapa === "venda_concluida" ? "link" : draft.etapa;
  const itens = base?.itens ?? [];
  const mensagemEtapa = itens.find((i) => i.tipo === "mensagem_etapa" && i.etapa === etapa && i.mensagem?.trim());
  const travamentos = itens.filter((i) => i.tipo === "travamento" && i.etapa === etapa);
  const sinais = itens.filter((i) => i.tipo === "sinal");
  const travSel = travamentos.find((t) => t.id === travamento) ?? null;

  const economia = useMemo(
    () => calcularEconomia(draft.usos, base?.itensAmor ?? [], draft.plano, base?.mensalidades ?? {}),
    [draft.usos, draft.plano, base?.itensAmor, base?.mensalidades],
  );
  const blocoEconomia = textoEconomia(economia, draft.plano);
  const mensagem = mensagemEtapa?.mensagem ? preencherTemplate(mensagemEtapa.mensagem, draft, economia) : "";
  const mensagemCompleta = [mensagem, comEconomia ? blocoEconomia : ""].filter(Boolean).join("\n\n");
  const registrar = useRegistrarUso();
  const hoje = hojeISO();

  return (
    <div className="mt-5 space-y-5">
      <Funil etapa={draft.etapa} onEtapa={(e) => mudar({ etapa: e })} />

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[14px] text-ink hover:bg-surface-2">
            Meus casos em aberto{casos.length ? ` (${casos.length})` : ""}
            <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[60vh] min-w-[260px] overflow-y-auto">
            {casos.length === 0 && <p className="px-2 py-1.5 text-sm text-ink-muted">Nenhum caso em aberto.</p>}
            {casos.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => escolher(c)} className={cn("flex justify-between gap-3", c.id === selId && "font-semibold")}>
                <span className="truncate">
                  {c.primeiro_nome || "Sem nome"} · {c.etapa === "venda_concluida" ? "Venda concluída" : ETAPA_LABEL[c.etapa]}
                </span>
                {c.retomar_em && c.retomar_em <= hoje && (
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-gold-text">retomar hoje</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <OutlineButton className="h-9 text-[14px]" onClick={() => novoCaso.mutate()} disabled={novoCaso.isPending}>
          <Plus className="h-4 w-4" strokeWidth={1.5} /> Novo caso
        </OutlineButton>
        {salvar.isPending && <span className="text-[12.5px] text-ink-muted">Salvando…</span>}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
        {/* Cliente e etapa */}
        <div className="rounded-2xl border border-line p-4">
          {!draft.id ? (
            <div className="py-6 text-center">
              <p className="text-[14px] text-ink-muted">Nenhum caso em aberto.</p>
              <GoldButton className="mt-3 h-9 text-[14px]" onClick={() => novoCaso.mutate()} disabled={novoCaso.isPending}>
                Novo caso
              </GoldButton>
            </div>
          ) : (
            <>
              <Overline className="text-ink">Cliente</Overline>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <label className="block">
                  <Overline>Primeiro nome</Overline>
                  <input
                    value={draft.primeiro_nome}
                    onChange={(e) => mudar({ primeiro_nome: e.target.value.replace(/\s.*/, "").slice(0, 40) })}
                    autoComplete="off"
                    className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[14px] text-ink outline-none focus:border-gold"
                  />
                </label>
                <label className="block">
                  <Overline>Dependentes</Overline>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={draft.dependentes}
                    onChange={(e) => mudar({ dependentes: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
                    className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[14px] text-ink outline-none focus:border-gold"
                  />
                </label>
              </div>

              <Overline className="mt-4">Plano</Overline>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PLANOS.map((p) => (
                  <ChoicePill key={p} active={draft.plano === p} onClick={() => mudar({ plano: draft.plano === p ? null : p })}>
                    {PLANO_LABEL[p]}
                  </ChoicePill>
                ))}
              </div>

              <Overline className="mt-4">Vai usar primeiro</Overline>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {draft.usos.map((u, i) => (
                  <span key={i} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink bg-surface-2 px-3 text-[13.5px] font-semibold text-ink">
                    {usoLabel(u)}
                    <button type="button" aria-label={`Remover ${u.nome}`} onClick={() => mudar({ usos: draft.usos.filter((_, j) => j !== i) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {draft.usos.length < 12 && (
                  <AdicionarUso itens={base?.itensAmor ?? []} onAdd={(u) => mudar({ usos: [...draft.usos, u] })} />
                )}
              </div>

              <Overline className="mt-5">Etapa do fechamento</Overline>
              <ol className="mt-2 border-l border-line pl-3">
                {SUBETAPAS.map((s, idx) => {
                  const atualIdx = SUBETAPAS.indexOf(etapa);
                  const feito = draft.etapa === "venda_concluida" || (atualIdx >= 0 && idx < atualIdx);
                  const atual = draft.etapa !== "venda_concluida" && idx === atualIdx;
                  return (
                    <li key={s} className="border-b border-line last:border-b-0">
                      <button type="button" onClick={() => mudar({ etapa: s })} className="flex w-full items-center gap-3 py-2.5 text-left">
                        {feito ? (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-gold text-on-gold"><Check className="h-3 w-3" strokeWidth={2.5} /></span>
                        ) : (
                          <span className={cn("grid h-5 w-5 place-items-center rounded-full border text-[11px]", atual ? "border-gold font-semibold text-ink ring-2 ring-gold/30" : "border-line-strong text-ink-muted")}>
                            {idx + 1}
                          </span>
                        )}
                        <span className={cn("flex-1 text-[14.5px]", atual ? "font-semibold text-ink" : "text-ink")}>{ETAPA_LABEL[s]}</span>
                        {atual && <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-text">Está aqui</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>

              <GoldButton className="mt-4 h-9 w-full text-[14px]" onClick={() => setConfirmar(true)}>Venda concluída</GoldButton>
            </>
          )}
          <p className="mt-3 text-[12px] leading-[18px] text-ink-muted">
            Nada aqui é salvo com CPF ou telefone. O caso some quando a venda é concluída ou em 30 dias.
          </p>
        </div>

        {/* Mensagens */}
        <div className="min-w-0 space-y-5">
          {etapa === "proposta" && (
            <div>
              <Overline>Sinais de compra</Overline>
              {sinais.length === 0 ? (
                <p className="mt-2 text-[13.5px] text-ink-muted">Nenhum sinal de compra publicado ainda.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                  {sinais.map((s) => (
                    <li key={s.id} className="px-3 py-2.5">
                      <p className="text-[14px] font-semibold text-ink">{s.titulo}</p>
                      {s.exemplos_de_fala.length > 0 && (
                        <p className="text-[13px] text-ink-muted">{s.exemplos_de_fala.map((e) => `“${e}”`).join(" · ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => mudar({ etapa: "plano" })} className="mt-2 text-[13.5px] font-semibold text-gold-text hover:underline">
                O cliente deu sinal → ir para o Fechamento
              </button>
            </div>
          )}

          <div className="rounded-xl bg-surface-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <Overline>Próxima mensagem · {ETAPA_LABEL[etapa]}</Overline>
              {mensagem && (
                <CopyText
                  variant="link"
                  text={mensagemCompleta}
                  onCopied={() => mensagemEtapa && registrar({ fechamento_item_id: mensagemEtapa.id })}
                />
              )}
            </div>
            {mensagem ? (
              <p className="mt-2 whitespace-pre-line text-[15px] leading-[25px] text-ink">{mensagem}</p>
            ) : (
              <p className="mt-2 text-[14px] text-ink-muted">Nenhuma mensagem publicada para esta etapa ainda.</p>
            )}
          </div>

          {draft.usos.length > 0 && (
            <EconomiaBox
              economia={economia}
              plano={draft.plano}
              incluida={comEconomia}
              onToggle={() => setComEconomia((v) => !v)}
            />
          )}

          {travamentos.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] text-ink-muted">Travou {etapa === "pagamento" ? "no pagamento" : `em ${ETAPA_LABEL[etapa]}`}?</span>
                {travamentos.map((t) => (
                  <ChoicePill key={t.id} active={t.id === travamento} onClick={() => setTravamento(t.id === travamento ? null : t.id)}>
                    {t.titulo}
                  </ChoicePill>
                ))}
              </div>
              {travSel && <TravamentoBox item={travSel} caso={draft} economia={economia} onCopied={() => registrar({ fechamento_item_id: travSel.id })} />}
            </div>
          )}

          {draft.id && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3 sm:flex-row sm:items-center">
              <span className="text-[14px] text-ink">O cliente sumiu nesta etapa?</span>
              {draft.retomar_em ? (
                <span className="text-[13.5px] font-semibold text-gold-text">
                  {draft.retomar_em <= hoje ? "Retomar hoje" : draft.retomar_em === hojeISO(1) ? "Guardado para retomar amanhã" : `Guardado para retomar em ${draft.retomar_em.split("-").reverse().slice(0, 2).join("/")}`}
                </span>
              ) : (
                <>
                  <OutlineButton className="h-9 text-[14px]" onClick={() => retomar.mutate(draft.id!)} disabled={retomar.isPending}>
                    Retomar depois
                  </OutlineButton>
                  <span className="text-[13px] text-ink-muted">vira um cliente em “Retomar hoje” para amanhã</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Venda concluída?</AlertDialogTitle>
            <AlertDialogDescription>O caso {draft.primeiro_nome ? `de ${draft.primeiro_nome} ` : ""}é encerrado e apagado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => draft.id && concluir.mutate(draft.id)}>Concluir e apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

const FUNIL = [
  { id: "novo", label: "Novo lead" },
  { id: "qualificado", label: "Lead qualificado" },
  { id: "proposta", label: "Proposta enviada" },
  { id: "fechamento", label: "Fechamento" },
  { id: "venda", label: "Venda concluída" },
] as const;

function Funil({ etapa, onEtapa }: { etapa: CasoEtapa; onEtapa: (e: CasoEtapa) => void }) {
  const naProposta = etapa === "proposta";
  const subIdx = SUBETAPAS.indexOf(etapa as Etapa);
  const pctFechamento = etapa === "venda_concluida" ? 100 : subIdx >= 0 ? Math.max(15, ((subIdx + 0.5) / SUBETAPAS.length) * 100) : 0;
  const fill = (id: string) => {
    if (id === "novo" || id === "qualificado") return 100;
    if (id === "proposta") return naProposta ? 50 : 100;
    if (id === "fechamento") return pctFechamento;
    return etapa === "venda_concluida" ? 100 : 0;
  };
  const atual = naProposta ? "proposta" : etapa === "venda_concluida" ? "venda" : "fechamento";
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Funil do CRM">
      {FUNIL.map((f) => {
        const clicavel = f.id === "proposta" || f.id === "fechamento";
        const content = (
          <>
            <span className="block h-[3px] overflow-hidden rounded-full bg-line">
              <span className={cn("block h-full bg-gold", (f.id === "novo" || f.id === "qualificado") && "opacity-50")} style={{ width: `${fill(f.id)}%` }} />
            </span>
            <span
              className={cn(
                "mt-1.5 block truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] sm:text-[11.5px]",
                f.id === atual ? "text-ink" : f.id === "novo" || f.id === "qualificado" ? "text-ink-muted/70" : "text-ink-muted",
              )}
            >
              {f.label}
            </span>
          </>
        );
        return (
          <li key={f.id} aria-current={f.id === atual ? "step" : undefined}>
            {clicavel ? (
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => onEtapa(f.id === "proposta" ? "proposta" : naProposta ? "plano" : etapa)}
              >
                {content}
              </button>
            ) : content}
          </li>
        );
      })}
    </ol>
  );
}

function AdicionarUso({ itens, onAdd }: { itens: ItemAmor[]; onAdd: (u: CasoUso) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [escolhido, setEscolhido] = useState<{ tipo: CasoUso["item_tipo"]; id: string | null; nome: string } | null>(null);
  const [rotulo, setRotulo] = useState("");

  const lista = useMemo(() => {
    const n = normalize(q.trim());
    if (!n) return itens.slice(0, 8);
    return itens.filter((i) => normalize(i.nome).includes(n)).slice(0, 8);
  }, [q, itens]);

  const reset = () => { setQ(""); setEscolhido(null); setRotulo(""); };
  const adicionar = () => {
    if (!escolhido) return;
    onAdd({ item_tipo: escolhido.tipo, item_id: escolhido.id, nome: escolhido.nome.slice(0, 120), rotulo: rotulo.trim().slice(0, 60) });
    reset();
    setOpen(false);
  };
  const tipoLabel = { consulta: "Consulta", exame: "Exame", odontologia: "Odontologia" } as const;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverTrigger className="inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-[13.5px] text-ink hover:bg-surface-2">
        + adicionar
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-3">
        {!escolhido ? (
          <>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar consulta, exame…"
              className="h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[14px] outline-none focus:border-gold"
            />
            <ul className="mt-2 max-h-56 overflow-y-auto">
              {lista.map((i) => (
                <li key={`${i.tipo}-${i.id}`}>
                  <button
                    type="button"
                    onClick={() => setEscolhido({ tipo: i.tipo, id: i.id, nome: i.nome })}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[13.5px] hover:bg-surface-2"
                  >
                    <span className="truncate">{i.nome}</span>
                    <span className="shrink-0 text-[11.5px] text-ink-muted">{tipoLabel[i.tipo]}</span>
                  </button>
                </li>
              ))}
              {q.trim() && (
                <li>
                  <button
                    type="button"
                    onClick={() => setEscolhido({ tipo: "livre", id: null, nome: q.trim() })}
                    className="w-full rounded px-2 py-1.5 text-left text-[13.5px] text-gold-text hover:bg-surface-2"
                  >
                    Usar “{q.trim()}”
                  </button>
                </li>
              )}
            </ul>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[14px] font-semibold text-ink">{escolhido.nome}</p>
            <label className="block">
              <span className="text-[12.5px] text-ink-muted">Para quem? (opcional, ex.: mãe)</span>
              <input
                autoFocus
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
                className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[14px] outline-none focus:border-gold"
              />
            </label>
            <div className="flex justify-between">
              <button type="button" className="text-[13px] text-ink-muted hover:text-ink" onClick={() => setEscolhido(null)}>← voltar</button>
              <GoldButton className="h-8 px-3 text-[13.5px]" onClick={adicionar}>Adicionar</GoldButton>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function EconomiaBox({
  economia, plano, incluida, onToggle,
}: {
  economia: ReturnType<typeof calcularEconomia>;
  plano: Caso["plano"];
  incluida: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <Overline>O que você leva (vai junto na mensagem)</Overline>
      <div className={cn("mt-2 rounded-lg bg-sidebar px-3 py-2.5 text-[14px] leading-[22px]", !incluida && "opacity-60")}>
        {economia.linhas.map((l, i) => (
          <div key={i} className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-ink">{usoLabel(l.uso)} particular → com o cartão</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{brl(l.particular)} → {brl(l.cartao)}</span>
          </div>
        ))}
        {economia.linhas.length > 0 && plano && (
          <div className="flex justify-between gap-3 border-b border-line-strong pb-1">
            <span className="text-ink">Mensalidade do {PLANO_LABEL[plano]}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {economia.mensalidade != null ? `– ${brl(economia.mensalidade)}` : "não cadastrada"}
            </span>
          </div>
        )}
        {economia.total != null && (
          <div className="flex justify-between gap-3 pt-1 font-semibold text-ink">
            <span>Economia já no primeiro uso</span>
            <span className="tabular-nums">{brl(economia.total)}</span>
          </div>
        )}
        {economia.linhas.length > 0 && !plano && <p className="text-[13px] text-ink-muted">Escolha o plano para calcular a economia.</p>}
        {economia.semPreco.map((u, i) => (
          <p key={i} className="text-[13px] text-ink-muted">{usoLabel(u)}: sem preço particular cadastrado</p>
        ))}
      </div>
      <p className="mt-1.5 text-[12.5px] text-ink-muted">
        Preços médios da Amor Saúde cadastrados na Omnia
        {economia.linhas.length > 0 && (
          <>
            {" · "}
            <button type="button" onClick={onToggle} className="font-semibold text-gold-text hover:underline">
              {incluida ? "Tirar da mensagem" : "Pôr de volta na mensagem"}
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function TravamentoBox({
  item, caso, economia, onCopied,
}: {
  item: FechamentoItem;
  caso: CasoDraft;
  economia: ReturnType<typeof calcularEconomia>;
  onCopied: () => void;
}) {
  const msg = item.mensagem ? preencherTemplate(item.mensagem, caso, economia) : "";
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-line p-4">
      {msg && (
        <div>
          <div className="flex items-start justify-between gap-3">
            <Overline>Mensagem</Overline>
            <CopyText variant="link" text={msg} onCopied={onCopied} />
          </div>
          <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-[23px] text-ink">{msg}</p>
        </div>
      )}
      {item.passos.length > 0 && (
        <div>
          <Overline>Passos</Overline>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[14px] text-ink">
            {item.passos.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        </div>
      )}
      {item.evite && (
        <div className="rounded-r-lg border-l-[3px] border-ink bg-surface-2 px-3 py-2 text-[14px] text-ink">
          <span className="font-semibold">Evite:</span> {item.evite}
        </div>
      )}
      {!msg && !item.passos.length && !item.evite && <p className="text-[13.5px] text-ink-muted">Sem orientação cadastrada para este travamento.</p>}
    </div>
  );
}
