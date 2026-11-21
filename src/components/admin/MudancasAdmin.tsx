import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  deleteChangelogEntry, getMudancasAdmin, lembrarQuemFalta, marcarMudancaIncorporada, upsertChangelogEntry,
  type MudancaAdmin,
} from "@/lib/changelog.functions";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { ADMIN_ASSISTANT_MODEL } from "@/lib/ai-models";
import { ehImportante, TIPOS_MUDANCA, TIPO_MUDANCA_LABEL, type PerguntaChecagem, type TipoMudanca } from "@/lib/mudancas";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import {
  AdminListDetail, DeleteLink, FieldLabel, FilterPill, ListRow, PanelEmpty, PanelHeader, StatusTag, fmtDia, inputCls,
} from "@/components/admin/AdminListDetail";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const MUDANCAS_KEY = ["admin-mudancas"] as const;
const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar.");

interface Rascunho {
  id: string | null;
  title: string; summary: string; published: boolean; tipo: TipoMudanca;
  vale_a_partir: string; validade: string; link: string;
  comPergunta: boolean; pergunta: PerguntaChecagem;
  usar_na_ia: boolean;
}

const perguntaVazia = (tema: string): PerguntaChecagem => ({
  tema_id: tema, pergunta: "", explicacao: "",
  alternativas: [{ texto: "", correta: true }, { texto: "", correta: false }, { texto: "", correta: false }],
});

const novo = (tema: string): Rascunho => ({
  id: null, title: "", summary: "", published: false, tipo: "importante", vale_a_partir: "", validade: "", link: "",
  comPergunta: false, pergunta: perguntaVazia(tema), usar_na_ia: true,
});

const doBanco = (m: MudancaAdmin, tema: string): Rascunho => ({
  id: m.id, title: m.title, summary: m.summary, published: m.published, tipo: m.tipo,
  vale_a_partir: m.vale_a_partir ?? "", validade: m.validade ?? "", link: m.link ?? "",
  comPergunta: !!m.pergunta_checagem, pergunta: m.pergunta_checagem ?? perguntaVazia(tema),
  usar_na_ia: m.usar_na_ia,
});

type Filtro = "todas" | TipoMudanca;

export function MudancasAdminTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(getMudancasAdmin);
  const salvarFn = useServerFn(upsertChangelogEntry);
  const lembrarFn = useServerFn(lembrarQuemFalta);
  const incorporarFn = useServerFn(marcarMudancaIncorporada);
  const excluirFn = useServerFn(deleteChangelogEntry);
  const q = useQuery({ queryKey: MUDANCAS_KEY, queryFn: () => listFn({}) });
  const mudancas = q.data?.mudancas ?? [];
  const temas = q.data?.temas ?? [];
  const tema0 = temas[0]?.id ?? "";

  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Rascunho | null>(null);

  const lista = useMemo(() => mudancas.filter((m) => filtro === "todas" || m.tipo === filtro), [mudancas, filtro]);
  const sel = mudancas.find((m) => m.id === selId) ?? null;
  const refrescar = () => qc.invalidateQueries({ queryKey: MUDANCAS_KEY });

  // Sem tema escolhido ainda (lista carregou depois do "nova mudança"): usa o primeiro.
  useEffect(() => {
    if (draft && draft.comPergunta && !draft.pergunta.tema_id && tema0) setDraft({ ...draft, pergunta: { ...draft.pergunta, tema_id: tema0 } });
  }, [draft, tema0]);

  const abrir = (m: MudancaAdmin) => { setSelId(m.id); setDraft(doBanco(m, tema0)); };
  const criar = () => { setSelId(null); setDraft(novo(tema0)); };
  const fechar = () => { setSelId(null); setDraft(null); };

  const salvar = useMutation({
    mutationFn: (d: Rascunho) => salvarFn({
      data: {
        id: d.id ?? undefined, title: d.title, summary: d.summary, published: d.published, tipo: d.tipo,
        vale_a_partir: d.vale_a_partir || null, validade: d.validade || null, link: d.link || null,
        pergunta_checagem: ehImportante(d.tipo) && d.comPergunta ? d.pergunta : null,
        usar_na_ia: ehImportante(d.tipo) && d.usar_na_ia,
      },
    }),
    onSuccess: (r) => {
      toast.success(r.published ? "Mudança salva e publicada." : "Rascunho salvo.");
      refrescar();
      qc.invalidateQueries({ queryKey: ["admin-aquecimento"] });
      setSelId(r.id);
      setDraft((d) => (d ? { ...d, id: r.id } : d));
    },
    onError: erro,
  });
  const lembrar = useMutation({
    mutationFn: (id: string) => lembrarFn({ data: { id } }),
    onSuccess: () => { toast.success("Lembrete ligado: a faixa e a notificação aparecem de novo para quem falta."); refrescar(); },
    onError: erro,
  });
  const incorporar = useMutation({
    mutationFn: (v: { id: string; incorporada: boolean }) => incorporarFn({ data: v }),
    onSuccess: (_r, v) => { toast.success(v.incorporada ? "Marcada como incorporada ao Playbook." : "Voltou para o bloco Mudanças recentes."); refrescar(); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => { toast.success("Mudança excluída."); fechar(); refrescar(); },
    onError: erro,
  });

  const painel = draft ? (
    <Painel
      draft={draft} onChange={setDraft} sel={sel} temas={temas}
      salvando={salvar.isPending} onSalvar={() => salvar.mutate(draft)} onFechar={fechar}
      onLembrar={() => sel && lembrar.mutate(sel.id)} lembrando={lembrar.isPending}
      onIncorporar={() => sel && incorporar.mutate({ id: sel.id, incorporada: !sel.incorporada })}
      onExcluir={() => sel && excluir.mutate(sel.id)}
    />
  ) : <PanelEmpty>Escolha uma mudança na lista ou crie uma nova.</PanelEmpty>;

  return (
    <AdminListDetail
      title="Mudanças"
      subtitle="Avisos importantes que a equipe precisa confirmar."
      actions={<GoldButton className="h-9 text-[14px]" onClick={criar}>+ Nova mudança</GoldButton>}
      filters={(
        <>
          <FilterPill active={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas</FilterPill>
          {TIPOS_MUDANCA.map((t) => <FilterPill key={t} active={filtro === t} onClick={() => setFiltro(t)}>{TIPO_MUDANCA_LABEL[t]}</FilterPill>)}
        </>
      )}
      panel={painel}
    >
      {q.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : q.isError ? (
        <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar as mudanças agora.</p>
      ) : (
        <div className="border-t border-line">
          {lista.length === 0 && <p className="px-3 py-6 text-[14px] text-ink-muted">Nenhuma mudança por aqui.</p>}
          {lista.map((m) => (
            <ListRow key={m.id} active={m.id === selId} onClick={() => abrir(m)}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink [overflow-wrap:anywhere]">{m.title}</span>
                <span className="block truncate text-[13px] text-ink-muted">
                  {TIPO_MUDANCA_LABEL[m.tipo]}
                  {ehImportante(m.tipo) && m.published && ` · ${m.confirmadas} de ${m.total}`}
                  {m.origem === "auto" && " · automática"}
                  {m.incorporada && " · no Playbook"}
                </span>
              </span>
              <StatusTag status={m.published ? "publicada" : "rascunho"} />
            </ListRow>
          ))}
        </div>
      )}
      <GeradorIA onPublicado={refrescar} />
    </AdminListDetail>
  );
}

function Painel({ draft, onChange, sel, temas, salvando, onSalvar, onFechar, onLembrar, lembrando, onIncorporar, onExcluir }: {
  draft: Rascunho; onChange: (d: Rascunho) => void; sel: MudancaAdmin | null; temas: { id: string; nome: string }[];
  salvando: boolean; onSalvar: () => void; onFechar: () => void; onLembrar: () => void; lembrando: boolean;
  onIncorporar: () => void; onExcluir: () => void;
}) {
  const importante = ehImportante(draft.tipo);
  const set = (p: Partial<Rascunho>) => onChange({ ...draft, ...p });
  const setP = (p: Partial<PerguntaChecagem>) => onChange({ ...draft, pergunta: { ...draft.pergunta, ...p } });
  const valida = draft.title.trim() && draft.summary.trim()
    && (!importante || !draft.comPergunta || (
      draft.pergunta.tema_id && draft.pergunta.pergunta.trim().length >= 3 && draft.pergunta.explicacao.trim()
      && draft.pergunta.alternativas.every((a) => a.texto.trim())));
  const pct = sel && sel.total > 0 ? Math.round((sel.confirmadas / sel.total) * 100) : 0;
  const acerto = sel && sel.com_checagem > 0 ? Math.round((sel.acertos / sel.com_checagem) * 100) : null;

  return (
    <div>
      <PanelHeader
        overline={[TIPO_MUDANCA_LABEL[draft.tipo], draft.vale_a_partir && `vale a partir de ${draft.vale_a_partir.split("-").reverse().join("/")}`].filter(Boolean).join(" · ")}
        title={draft.title || "Nova mudança"} onClose={onFechar}
      />

      <FieldLabel htmlFor="mud-titulo">Título</FieldLabel>
      <input id="mud-titulo" className={inputCls} maxLength={200} value={draft.title} onChange={(e) => set({ title: e.target.value })} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="mud-tipo">Tipo</FieldLabel>
          <select id="mud-tipo" className={inputCls} value={draft.tipo} onChange={(e) => set({ tipo: e.target.value as TipoMudanca })}>
            {TIPOS_MUDANCA.map((t) => <option key={t} value={t}>{TIPO_MUDANCA_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="mud-vale">Vale a partir de</FieldLabel>
          <input id="mud-vale" type="date" className={inputCls} value={draft.vale_a_partir} onChange={(e) => set({ vale_a_partir: e.target.value })} />
        </div>
      </div>

      {importante && (
        <>
          <FieldLabel htmlFor="mud-validade">Validade (opcional)</FieldLabel>
          <input id="mud-validade" type="date" className={inputCls} value={draft.validade} onChange={(e) => set({ validade: e.target.value })} />
          <p className="mt-1 text-[12.5px] text-ink-muted">Depois da validade ela sai de &quot;Para confirmar&quot;, mas fica no histórico.</p>
        </>
      )}

      <FieldLabel htmlFor="mud-texto">O que mudou</FieldLabel>
      <textarea id="mud-texto" className={cn(inputCls, "min-h-[110px] leading-6")} rows={5} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />

      <FieldLabel htmlFor="mud-link">Link para &quot;Ver o que mudou&quot; (rota interna, opcional)</FieldLabel>
      <input id="mud-link" className={inputCls} placeholder="/scripts" maxLength={200} value={draft.link} onChange={(e) => set({ link: e.target.value.trim() })} />
      {draft.link && !draft.link.startsWith("/") && <p className="mt-1 text-[12.5px] text-destructive">Use uma rota da Omnia, começando com /.</p>}

      {importante && (
        <>
          <label className="mt-4 flex items-center gap-2 text-[14px] text-ink">
            <Switch checked={draft.comPergunta} onCheckedChange={(v) => set({ comPergunta: v })} /> Pergunta de checagem (vira cartão do aquecimento amanhã)
          </label>
          {draft.comPergunta && (
            <div className="mt-3 space-y-2 rounded-xl border border-dashed border-line-strong p-3">
              <FieldLabel htmlFor="mud-tema">Tema</FieldLabel>
              <select id="mud-tema" className={inputCls} value={draft.pergunta.tema_id} onChange={(e) => setP({ tema_id: e.target.value })}>
                {temas.length === 0 && <option value="">Sem temas ativos</option>}
                {temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <FieldLabel htmlFor="mud-pergunta">Pergunta</FieldLabel>
              <input id="mud-pergunta" className={inputCls} maxLength={400} value={draft.pergunta.pergunta} onChange={(e) => setP({ pergunta: e.target.value })} />
              <FieldLabel>Alternativas (marque a certa)</FieldLabel>
              {draft.pergunta.alternativas.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio" name="mud-correta" aria-label={`Alternativa ${i + 1} é a correta`} checked={a.correta}
                    onChange={() => setP({ alternativas: draft.pergunta.alternativas.map((x, j) => ({ ...x, correta: j === i })) })}
                    className="h-4 w-4 accent-[var(--gold,#B8872E)]"
                  />
                  <input
                    className={inputCls} maxLength={200} placeholder={`Alternativa ${i + 1}`} aria-label={`Texto da alternativa ${i + 1}`} value={a.texto}
                    onChange={(e) => setP({ alternativas: draft.pergunta.alternativas.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
                  />
                </div>
              ))}
              <FieldLabel htmlFor="mud-explicacao">Explicação (aparece acertando ou errando)</FieldLabel>
              <textarea id="mud-explicacao" className={inputCls} rows={2} maxLength={600} value={draft.pergunta.explicacao} onChange={(e) => setP({ explicacao: e.target.value })} />
            </div>
          )}
          <label className="mt-3 flex items-center gap-2 text-[14px] text-ink">
            <Switch checked={draft.usar_na_ia} onCheckedChange={(v) => set({ usar_na_ia: v })} /> Usar na IA (bloco &quot;Mudanças recentes&quot;, 30 dias)
          </label>
        </>
      )}

      <label className="mt-3 flex items-center gap-2 text-[14px] text-ink">
        <Switch checked={draft.published} onCheckedChange={(v) => set({ published: v })} /> Publicada (visível para a equipe)
      </label>

      {sel && importante && sel.published && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="type-overline text-ink-muted">Confirmações · {sel.confirmadas} de {sel.total}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Confirmações">
            <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
          </div>
          {sel.faltam.length > 0
            ? <p className="mt-2 text-[14px] text-ink-muted">Falta confirmar: {sel.faltam.join(", ")}</p>
            : <p className="mt-2 text-[14px] text-ink-muted">Todo mundo confirmou.</p>}
          {acerto !== null && <p className="mt-1 text-[14px] text-ink-muted">Acerto na checagem: {acerto}% ({sel.acertos} de {sel.com_checagem})</p>}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {sel && importante && sel.published && sel.faltam.length > 0 && (
          <GoldButton className="h-9 text-[14px]" onClick={onLembrar} disabled={lembrando}>Lembrar quem falta</GoldButton>
        )}
        {sel
          ? <OutlineButton className="h-9 text-[14px]" onClick={onSalvar} disabled={!valida || salvando}>Salvar edição</OutlineButton>
          : <GoldButton className="h-9 text-[14px]" onClick={onSalvar} disabled={!valida || salvando}>{draft.published ? "Salvar e publicar" : "Salvar rascunho"}</GoldButton>}
        {sel && importante && (
          <OutlineButton className="h-9 text-[14px]" onClick={onIncorporar}>{sel.incorporada ? "Tirar de incorporada" : "Incorporada ao Playbook"}</OutlineButton>
        )}
        {sel && <DeleteLink onConfirm={onExcluir} title="Excluir esta mudança?" description="As confirmações dela também somem. Não dá para desfazer." />}
      </div>
      {sel && importante && sel.published && (
        <p className="mt-3 text-[12.5px] text-ink-muted">&quot;Lembrar&quot; mostra a faixa e a notificação do Chrome para quem falta. Não envia mensagem para ninguém.</p>
      )}
      {sel && <p className="mt-1 text-[12.5px] text-ink-muted">Criada em {fmtDia(sel.created_at)}{sel.publicada_em ? ` · publicada em ${fmtDia(sel.publicada_em)}` : ""}.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gerar informativas com IA (já existia em Novidades)
// ---------------------------------------------------------------------------

type ItemIA = { title: string; summary: string; selected: boolean };

function GeradorIA({ onPublicado }: { onPublicado: () => void }) {
  const upsertFn = useServerFn(upsertChangelogEntry);
  const genAI = useServerFn(simulatorChat);
  const [notas, setNotas] = useState("");
  const [gerando, setGerando] = useState(false);
  const [itens, setItens] = useState<ItemIA[]>([]);
  const [publicando, setPublicando] = useState(false);

  const gerar = async () => {
    if (!notas.trim()) return;
    setGerando(true);
    try {
      const prompt = `Você escreve entradas de changelog para os usuários internos de um sistema chamado Central de Apoio (Cartão de TODOS).
A partir das notas abaixo, que podem estar bagunçadas e misturar assuntos, separe em um ou mais itens de novidade.
Cada item tem "title" (curto, até 8 palavras) e "summary" (1 ou 2 frases: o que mudou e por que ajuda).
Responda APENAS com um array JSON: [{"title":"...","summary":"..."}]. Sem markdown.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: notas }], model: ADMIN_ASSISTANT_MODEL } });
      const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
      const lista: ItemIA[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: { title?: string; summary?: string }) => ({ title: it.title || "", summary: it.summary || "", selected: true }))
        .filter((it: ItemIA) => it.title && it.summary);
      if (!lista.length) { toast.error("A IA não encontrou itens nas notas."); return; }
      setItens(lista);
    } catch (e) { erro(e); } finally { setGerando(false); }
  };

  const publicar = async () => {
    const escolhidos = itens.filter((i) => i.selected);
    if (!escolhidos.length) return;
    setPublicando(true);
    try {
      for (const i of escolhidos) await upsertFn({ data: { title: i.title, summary: i.summary, published: true, tipo: "informativa" } });
      toast.success(`${escolhidos.length} novidade(s) informativa(s) publicada(s).`);
      setItens([]); setNotas(""); onPublicado();
    } catch (e) { erro(e); } finally { setPublicando(false); }
  };

  return (
    <details className="mt-8 rounded-xl border border-line px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-[14.5px] font-medium text-ink"><Sparkles className="h-4 w-4 text-gold" strokeWidth={1.5} /> Gerar informativas com IA</summary>
      <p className="mt-2 text-[13.5px] text-ink-muted">Cole um resumo do que mudou; a IA separa em itens para você revisar. Saem como informativas (sem confirmação).</p>
      <textarea className={cn(inputCls, "mt-2")} rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} />
      <GoldButton className="mt-2 h-9 text-[14px]" onClick={gerar} disabled={gerando || !notas.trim()}>{gerando ? "Gerando…" : "Gerar com IA"}</GoldButton>
      {itens.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {itens.map((it, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <input type="checkbox" className="mt-2 accent-[var(--gold,#B8872E)]" aria-label="Publicar este item" checked={it.selected}
                onChange={(e) => setItens((p) => p.map((x, i) => (i === idx ? { ...x, selected: e.target.checked } : x)))} />
              <div className="flex-1 space-y-1">
                <input className={inputCls} value={it.title} onChange={(e) => setItens((p) => p.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))} />
                <textarea className={inputCls} rows={2} value={it.summary} onChange={(e) => setItens((p) => p.map((x, i) => (i === idx ? { ...x, summary: e.target.value } : x)))} />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <OutlineButton className="h-9 text-[14px]" onClick={() => setItens([])}>Descartar</OutlineButton>
            <GoldButton className="h-9 text-[14px]" onClick={publicar} disabled={publicando || itens.every((i) => !i.selected)}>{publicando ? "Publicando…" : "Publicar selecionados"}</GoldButton>
          </div>
        </div>
      )}
    </details>
  );
}
