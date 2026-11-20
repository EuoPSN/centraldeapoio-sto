import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  excluirLimiteExtra, excluirPadraoEscrita, excluirRegraFixa, criarLimiteExtra, getCerebroAdmin, getLimitesAdmin,
  getRaioxEquipe, getRaioxVendedor, salvarCerebroBloco, salvarFunilEtapa, salvarLimite, salvarPadraoEscrita,
  salvarRegraFixa, testarCerebro,
  type BlocoAdmin, type PadroesRaiox,
} from "@/lib/cerebro.functions";
import {
  ETAPA_FUNIL_NOME, FERRAMENTAS, FERRAMENTAS_COLUNAS, FERRAMENTA_LABEL, alternarColuna, blocoVazio, colunaUsa, contarPalavras,
  type Ferramenta, type FunilEtapa, type PadraoEscritaItem, type RegraFixa,
} from "@/lib/cerebro";
import { GoldButton, OutlineButton, TextTabs } from "@/components/scripts/shared";
import { ChoicePill, Overline } from "@/components/cliente-disse/shared";
import { MarcianaEye } from "@/components/marciana/MarcianaEye";
import {
  AdminListDetail, DeleteLink, FieldLabel, FilterPill, ListRow, PanelEmpty, PanelHeader, TagsField, inputCls,
} from "@/components/admin/AdminListDetail";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
const CEREBRO_KEY = ["admin-cerebro"] as const;
const LIMITES_KEY = ["admin-cerebro-limites"] as const;

type Aba = "skills" | "etapas" | "padrao" | "regras" | "limites";
const ABAS: { id: Aba; name: string }[] = [
  { id: "skills", name: "Skills" },
  { id: "etapas", name: "Etapas do funil" },
  { id: "padrao", name: "Padrão de escrita" },
  { id: "regras", name: "Regras fixas" },
  { id: "limites", name: "Limites de uso" },
];

const TITULO = "Cérebro da Omnia";
const SUBTITULO = "As instruções que todas as ferramentas seguem. Cada ferramenta usa só os blocos marcados.";

// ===========================================================================
// Cérebro da Omnia (abas)
// ===========================================================================

export function CerebroAdminTab() {
  const [aba, setAba] = useState<Aba>("skills");
  const tabs = <TextTabs<Aba> label="Seções do Cérebro" items={ABAS} value={aba} onChange={setAba} />;
  switch (aba) {
    case "skills": return <SkillsTab tabs={tabs} irPara={setAba} />;
    case "etapas": return <EtapasTab tabs={tabs} />;
    case "padrao": return <PadraoTab tabs={tabs} />;
    case "regras": return <RegrasTab tabs={tabs} />;
    case "limites": return <LimitesTab tabs={tabs} />;
  }
}

function useCerebro() {
  const fn = useServerFn(getCerebroAdmin);
  return useQuery({ queryKey: CEREBRO_KEY, queryFn: () => fn({}) });
}

const Carregando = () => <p className="py-6 text-[14px] text-ink-muted">Carregando…</p>;

function PilulasFerramentas({ ferramentas }: { ferramentas: readonly string[] }) {
  const todas = FERRAMENTAS.every((f) => ferramentas.includes(f));
  const nomes = todas ? ["Todas"] : FERRAMENTAS_COLUNAS.filter((c) => colunaUsa(ferramentas, c)).map((c) => FERRAMENTA_LABEL[c]);
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {nomes.map((n) => <span key={n} className="rounded-full border border-line-strong px-2 py-0.5 text-[12px] text-ink-muted">{n}</span>)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

function SkillsTab({ tabs, irPara }: { tabs: ReactNode; irPara: (a: Aba) => void }) {
  const q = useCerebro();
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarCerebroBloco);
  const blocos = q.data?.blocos ?? [];
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ conteudo: string; ferramentas: Ferramenta[]; ativo: boolean } | null>(null);

  const abrir = (b: BlocoAdmin) => { setSelId(b.id); setDraft({ conteudo: b.conteudo, ferramentas: b.ferramentas, ativo: b.ativo }); };
  const sel = blocos.find((b) => b.id === selId) ?? null;

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { id: sel!.id, conteudo: sel!.gerado ? undefined : draft!.conteudo, ferramentas: draft!.ferramentas, ativo: draft!.ativo } }),
    onSuccess: () => { toast.success("Salvo. As ferramentas já usam a nova versão."); qc.invalidateQueries({ queryKey: CEREBRO_KEY }); },
    onError: erro,
  });

  const painel = sel && draft ? (
    <SkillPainel
      bloco={sel} draft={draft} onChange={setDraft} onSalvar={() => salvar.mutate()} salvando={salvar.isPending}
      onFechar={() => { setSelId(null); setDraft(null); }} irPara={irPara}
    />
  ) : <PanelEmpty>Escolha uma skill na lista para editar.</PanelEmpty>;

  return (
    <AdminListDetail title={TITULO} subtitle={SUBTITULO} belowHeader={tabs} panel={painel}>
      {q.isLoading ? <Carregando /> : (
        <>
          <div className="border-t border-line">
            {blocos.map((b) => (
              <ListRow key={b.id} active={b.id === selId} onClick={() => abrir(b)}>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[15px] font-medium", b.ativo ? "text-ink" : "text-ink-muted")}>{b.titulo}</span>
                  <span className="block truncate text-[13px] text-ink-muted">{b.descricao_curta}</span>
                </span>
                {!b.ativo && <span className="shrink-0 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11.5px] text-ink-muted">Desligada</span>}
                <span className="max-w-[48%] shrink-0"><PilulasFerramentas ferramentas={b.ferramentas} /></span>
              </ListRow>
            ))}
          </div>

          <div className="mt-8">
            <Overline>Quem usa o quê</Overline>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[560px] border-t border-line text-[13.5px]">
                <thead>
                  <tr className="text-ink-muted">
                    <th scope="col" className="py-2 pr-2 text-left font-normal">Skill</th>
                    {FERRAMENTAS_COLUNAS.map((c) => <th key={c} scope="col" className="px-1 py-2 text-center font-normal">{FERRAMENTA_LABEL[c]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {blocos.map((b) => (
                    <tr key={b.id} className="border-t border-line">
                      <th scope="row" className="py-2 pr-2 text-left font-normal text-ink">{b.titulo}</th>
                      {FERRAMENTAS_COLUNAS.map((c) => (
                        <td key={c} className="px-1 py-2 text-center">
                          {colunaUsa(b.ferramentas, c)
                            ? <span className="text-gold" role="img" aria-label="Usa">●</span>
                            : <span className="text-ink-muted" role="img" aria-label="Não usa">·</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminListDetail>
  );
}

function SkillPainel({ bloco, draft, onChange, onSalvar, salvando, onFechar, irPara }: {
  bloco: BlocoAdmin;
  draft: { conteudo: string; ferramentas: Ferramenta[]; ativo: boolean };
  onChange: (d: { conteudo: string; ferramentas: Ferramenta[]; ativo: boolean }) => void;
  onSalvar: () => void; salvando: boolean; onFechar: () => void; irPara: (a: Aba) => void;
}) {
  const testarFn = useServerFn(testarCerebro);
  const [testando, setTestando] = useState(false);
  const [conversa, setConversa] = useState("");
  const origem: Aba | null = bloco.chave === "padrao_escrita" ? "padrao" : bloco.chave === "etapas_funil" ? "etapas" : null;
  const texto = bloco.gerado ? bloco.conteudo_efetivo : draft.conteudo;
  const palavras = blocoVazio(texto) ? 0 : contarPalavras(texto);

  const teste = useMutation({
    mutationFn: () => testarFn({ data: { conversa, chave: bloco.chave, conteudo: draft.conteudo, ferramentas: draft.ferramentas } }),
    onError: () => toast.error("Não consegui testar agora. Tente de novo."),
  });

  // Ao trocar de skill, fecha o teste e limpa o resultado.
  useEffect(() => { setTestando(false); setConversa(""); teste.reset(); }, [bloco.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PanelHeader overline="Editando · skill" title={bloco.titulo} onClose={onFechar} />

      <FieldLabel htmlFor="cerebro-instrucoes">Instruções</FieldLabel>
      {bloco.gerado ? (
        <>
          <textarea id="cerebro-instrucoes" className={cn(inputCls, "min-h-[200px] bg-surface-2 text-ink-muted")} value={texto || "Ainda sem conteúdo."} readOnly rows={10} />
          {origem && (
            <p className="mt-1.5 text-[13px] text-ink-muted">
              Gerado a partir da aba{" "}
              <button type="button" className="font-semibold text-gold-text hover:underline" onClick={() => irPara(origem)}>
                {origem === "padrao" ? "Padrão de escrita" : "Etapas do funil"}
              </button>. Edite lá.
            </p>
          )}
        </>
      ) : (
        <>
          <textarea
            id="cerebro-instrucoes" className={cn(inputCls, "min-h-[200px] leading-6")} rows={10} value={draft.conteudo}
            onChange={(e) => onChange({ ...draft, conteudo: e.target.value })}
          />
          {blocoVazio(draft.conteudo) && <p className="mt-1.5 text-[13px] text-ink-muted">Ainda sem conteúdo: a IA ignora esta skill até você escrever.</p>}
        </>
      )}

      <FieldLabel>Usado por</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {FERRAMENTAS_COLUNAS.map((c) => (
          <ChoicePill key={c} active={colunaUsa(draft.ferramentas, c)} onClick={() => onChange({ ...draft, ferramentas: alternarColuna(draft.ferramentas, c) })}>
            {FERRAMENTA_LABEL[c]}
          </ChoicePill>
        ))}
      </div>

      <FieldLabel>Tamanho</FieldLabel>
      <p className="text-[14px] text-ink-muted">≈ {palavras.toLocaleString("pt-BR")} palavras · blocos maiores gastam mais da cota de IA</p>

      <label className="mt-4 flex items-center gap-2 text-[14px] text-ink">
        <Switch checked={draft.ativo} onCheckedChange={(v) => onChange({ ...draft, ativo: v })} /> Ligada (as ferramentas marcadas usam esta skill)
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <GoldButton className="h-9 text-[14px]" onClick={onSalvar} disabled={salvando}>Salvar</GoldButton>
        <OutlineButton className="h-9 text-[14px]" onClick={() => setTestando((v) => !v)}>Testar com uma conversa</OutlineButton>
      </div>

      {testando && (
        <div className="mt-4 rounded-xl border border-dashed border-line-strong p-4">
          <FieldLabel htmlFor="cerebro-teste">Cole um trecho de conversa</FieldLabel>
          <textarea id="cerebro-teste" className={cn(inputCls, "min-h-[110px]")} rows={5} maxLength={8000} value={conversa} onChange={(e) => setConversa(e.target.value)}
            placeholder={"Cliente: Oi, vi o anúncio. Quanto é?\nAtendente: …"} />
          <p className="mt-1 text-[12.5px] text-ink-muted">Roda o Copiloto com as instruções acima, como estão agora (sem salvar). Telefone, CPF e e-mail são apagados.</p>
          <GoldButton className="mt-3 h-9 text-[14px]" disabled={!conversa.trim() || teste.isPending} onClick={() => teste.mutate()}>Testar</GoldButton>
          {teste.isPending && (
            <div className="mt-3 flex items-center gap-2 text-gold"><MarcianaEye size={22} state="thinking" /><span className="text-[14px] text-ink">Testando…</span></div>
          )}
          {teste.data && !teste.isPending && (
            <div className="mt-3 space-y-3 text-[14px] leading-6 text-ink">
              <p><strong className="font-semibold">{ETAPA_FUNIL_NOME[teste.data.etapa]}</strong> · {teste.data.resumo_onde_esta}</p>
              <div><Overline>Direta</Overline><p className="mt-0.5 whitespace-pre-wrap">{teste.data.opcao_direta.texto}</p></div>
              <div><Overline>Consultiva</Overline><p className="mt-0.5 whitespace-pre-wrap">{teste.data.opcao_consultiva.texto}</p></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapas do funil
// ---------------------------------------------------------------------------

function EtapasTab({ tabs }: { tabs: ReactNode }) {
  const q = useCerebro();
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarFunilEtapa);
  const etapas = q.data?.etapas ?? [];
  const [edit, setEdit] = useState<FunilEtapa | null>(null);

  const salvar = useMutation({
    mutationFn: (e: FunilEtapa) => salvarFn({ data: { etapa: e.etapa, nome: e.nome, definicao: e.definicao, sinais: e.sinais } }),
    onSuccess: () => { toast.success("Etapa salva."); qc.invalidateQueries({ queryKey: CEREBRO_KEY }); },
    onError: erro,
  });

  return (
    <AdminListDetail
      title={TITULO} subtitle="O Copiloto e o Raio-X só classificam a etapa usando estas definições." belowHeader={tabs}
      panel={edit ? (
        <div>
          <PanelHeader overline="Editando · etapa do funil" title={edit.nome || ETAPA_FUNIL_NOME[edit.etapa]} onClose={() => setEdit(null)} />
          <FieldLabel htmlFor="etapa-nome">Nome</FieldLabel>
          <input id="etapa-nome" className={inputCls} value={edit.nome} maxLength={60} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
          <FieldLabel htmlFor="etapa-def">O que faz o cliente estar nesta etapa</FieldLabel>
          <textarea id="etapa-def" className={cn(inputCls, "min-h-[120px]")} rows={5} maxLength={1500} value={edit.definicao} onChange={(e) => setEdit({ ...edit, definicao: e.target.value })} />
          <FieldLabel>Sinais na conversa</FieldLabel>
          <TagsField value={edit.sinais} onChange={(sinais) => setEdit({ ...edit, sinais })} placeholder="Digite um sinal e aperte Enter" />
          <div className="mt-5 flex gap-2 border-t border-line pt-4">
            <GoldButton className="h-9 text-[14px]" disabled={!edit.nome.trim() || salvar.isPending} onClick={() => salvar.mutate(edit)}>Salvar</GoldButton>
            <OutlineButton className="h-9 text-[14px]" onClick={() => setEdit(null)}>Cancelar</OutlineButton>
          </div>
        </div>
      ) : <PanelEmpty>Escolha uma etapa para definir.</PanelEmpty>}
    >
      {q.isLoading ? <Carregando /> : (
        <div className="border-t border-line">
          {etapas.map((e) => (
            <ListRow key={e.etapa} active={edit?.etapa === e.etapa} onClick={() => setEdit({ ...e })}>
              <span className="w-6 shrink-0 text-[13px] text-ink-muted">{e.ordem}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{e.nome}</span>
                <span className="block truncate text-[13px] text-ink-muted">{e.definicao.trim() || "Sem definição ainda"}</span>
              </span>
              {e.sinais.length > 0 && <span className="shrink-0 text-[13px] text-ink-muted">{e.sinais.length} {e.sinais.length === 1 ? "sinal" : "sinais"}</span>}
            </ListRow>
          ))}
        </div>
      )}
    </AdminListDetail>
  );
}

// ---------------------------------------------------------------------------
// Padrão de escrita
// ---------------------------------------------------------------------------

type PadraoDraft = Omit<PadraoEscritaItem, "id" | "ordem"> & { id: string | null };

function PadraoTab({ tabs }: { tabs: ReactNode }) {
  const q = useCerebro();
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarPadraoEscrita);
  const excluirFn = useServerFn(excluirPadraoEscrita);
  const itens = q.data?.padrao ?? [];
  const [filtro, setFiltro] = useState<"todos" | "pode" | "nao_pode">("todos");
  const [edit, setEdit] = useState<PadraoDraft | null>(null);
  const novo = (): PadraoDraft => ({ id: null, tipo: filtro === "pode" ? "pode" : "nao_pode", item: "", exemplo_errado: "", exemplo_certo: "", ativo: true });

  const salvar = useMutation({
    mutationFn: (d: PadraoDraft) => salvarFn({ data: d }),
    onSuccess: (r) => { toast.success("Salvo."); setEdit((e) => (e ? { ...e, id: r.id } : e)); qc.invalidateQueries({ queryKey: CEREBRO_KEY }); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: CEREBRO_KEY }); },
    onError: erro,
  });
  const lista = itens.filter((i) => filtro === "todos" || i.tipo === filtro);

  return (
    <AdminListDetail
      title={TITULO} subtitle="O que pode e o que não pode no texto. Vale para todas as ferramentas." belowHeader={tabs}
      actions={<GoldButton className="h-9 text-[14px]" onClick={() => setEdit(novo())}>+ Novo item</GoldButton>}
      filters={<>
        <FilterPill active={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos</FilterPill>
        <FilterPill active={filtro === "pode"} onClick={() => setFiltro("pode")}>Pode</FilterPill>
        <FilterPill active={filtro === "nao_pode"} onClick={() => setFiltro("nao_pode")}>Não pode</FilterPill>
      </>}
      panel={edit ? (
        <div>
          <PanelHeader overline={edit.id ? "Editando · padrão de escrita" : "Novo · padrão de escrita"} title={edit.item || "Sem texto"} onClose={() => setEdit(null)} />
          <FieldLabel>Tipo</FieldLabel>
          <div className="flex gap-1.5">
            <ChoicePill active={edit.tipo === "pode"} onClick={() => setEdit({ ...edit, tipo: "pode" })}>Pode</ChoicePill>
            <ChoicePill active={edit.tipo === "nao_pode"} onClick={() => setEdit({ ...edit, tipo: "nao_pode" })}>Não pode</ChoicePill>
          </div>
          <FieldLabel htmlFor="pad-item">Regra</FieldLabel>
          <input id="pad-item" className={inputCls} value={edit.item} maxLength={200} onChange={(e) => setEdit({ ...edit, item: e.target.value })} />
          <FieldLabel htmlFor="pad-errado">Exemplo errado (opcional)</FieldLabel>
          <input id="pad-errado" className={inputCls} value={edit.exemplo_errado} maxLength={300} onChange={(e) => setEdit({ ...edit, exemplo_errado: e.target.value })} />
          <FieldLabel htmlFor="pad-certo">Exemplo certo (opcional)</FieldLabel>
          <input id="pad-certo" className={inputCls} value={edit.exemplo_certo} maxLength={300} onChange={(e) => setEdit({ ...edit, exemplo_certo: e.target.value })} />
          <label className="mt-4 flex items-center gap-2 text-[14px] text-ink">
            <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} /> Em uso
          </label>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <GoldButton className="h-9 text-[14px]" disabled={edit.item.trim().length < 2 || salvar.isPending} onClick={() => salvar.mutate(edit)}>Salvar</GoldButton>
            <OutlineButton className="h-9 text-[14px]" onClick={() => setEdit(null)}>Cancelar</OutlineButton>
            {edit.id && <DeleteLink title="Excluir esta regra?" onConfirm={() => excluir.mutate(edit.id!)} />}
          </div>
        </div>
      ) : <PanelEmpty />}
    >
      {q.isLoading ? <Carregando /> : (
        <div className="border-t border-line">
          {lista.map((i) => (
            <ListRow key={i.id} active={edit?.id === i.id} onClick={() => setEdit({ ...i })}>
              <span className={cn("w-[68px] shrink-0 rounded-full border px-2 py-0.5 text-center text-[11.5px] font-semibold", i.tipo === "pode" ? "border-gold text-gold-text" : "border-line-strong text-ink-muted")}>
                {i.tipo === "pode" ? "Pode" : "Não pode"}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[15px]", i.ativo ? "text-ink" : "text-ink-muted")}>{i.item}</span>
                {(i.exemplo_errado || i.exemplo_certo) && (
                  <span className="block truncate text-[13px] text-ink-muted">
                    {i.exemplo_errado && <s>{i.exemplo_errado}</s>}{i.exemplo_errado && i.exemplo_certo && " → "}{i.exemplo_certo}
                  </span>
                )}
              </span>
              {!i.ativo && <span className="shrink-0 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11.5px] text-ink-muted">Fora de uso</span>}
            </ListRow>
          ))}
          {!lista.length && <p className="py-6 text-[14px] text-ink-muted">Nada por aqui.</p>}
        </div>
      )}
    </AdminListDetail>
  );
}

// ---------------------------------------------------------------------------
// Regras fixas
// ---------------------------------------------------------------------------

function RegrasTab({ tabs }: { tabs: ReactNode }) {
  const q = useCerebro();
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarRegraFixa);
  const excluirFn = useServerFn(excluirRegraFixa);
  const regras = q.data?.regras ?? [];
  const [edit, setEdit] = useState<{ id: string | null; texto: string; ativo: boolean } | null>(null);

  const salvar = useMutation({
    mutationFn: (d: { id: string | null; texto: string; ativo: boolean }) => salvarFn({ data: d }),
    onSuccess: (r) => { toast.success("Salvo."); setEdit((e) => (e ? { ...e, id: r.id } : e)); qc.invalidateQueries({ queryKey: CEREBRO_KEY }); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: CEREBRO_KEY }); },
    onError: erro,
  });

  return (
    <AdminListDetail
      title={TITULO} subtitle="Regras curtas que entram em toda chamada de IA, em qualquer ferramenta." belowHeader={tabs}
      actions={<GoldButton className="h-9 text-[14px]" onClick={() => setEdit({ id: null, texto: "", ativo: true })}>+ Nova regra</GoldButton>}
      panel={edit ? (
        <div>
          <PanelHeader overline={edit.id ? "Editando · regra fixa" : "Nova · regra fixa"} title={edit.texto.slice(0, 60) || "Sem texto"} onClose={() => setEdit(null)} />
          <FieldLabel htmlFor="regra-texto">Regra</FieldLabel>
          <textarea id="regra-texto" className={cn(inputCls, "min-h-[100px]")} rows={4} maxLength={300} value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} />
          <p className="mt-1 text-[12.5px] text-ink-muted">{edit.texto.length}/300 · mantenha curta: ela vai em todas as chamadas.</p>
          <label className="mt-4 flex items-center gap-2 text-[14px] text-ink">
            <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} /> Em uso
          </label>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <GoldButton className="h-9 text-[14px]" disabled={edit.texto.trim().length < 3 || salvar.isPending} onClick={() => salvar.mutate(edit)}>Salvar</GoldButton>
            <OutlineButton className="h-9 text-[14px]" onClick={() => setEdit(null)}>Cancelar</OutlineButton>
            {edit.id && <DeleteLink title="Excluir esta regra?" onConfirm={() => excluir.mutate(edit.id!)} />}
          </div>
        </div>
      ) : <PanelEmpty />}
    >
      {q.isLoading ? <Carregando /> : (
        <div className="border-t border-line">
          {regras.map((r: RegraFixa) => (
            <ListRow key={r.id} active={edit?.id === r.id} onClick={() => setEdit({ id: r.id, texto: r.texto, ativo: r.ativo })}>
              <span className={cn("min-w-0 flex-1 text-[15px] leading-6", r.ativo ? "text-ink" : "text-ink-muted")}>{r.texto}</span>
              {!r.ativo && <span className="shrink-0 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11.5px] text-ink-muted">Fora de uso</span>}
            </ListRow>
          ))}
        </div>
      )}
    </AdminListDetail>
  );
}

// ---------------------------------------------------------------------------
// Limites de uso
// ---------------------------------------------------------------------------

function LimitesTab({ tabs }: { tabs: ReactNode }) {
  const fn = useServerFn(getLimitesAdmin);
  const salvarFn = useServerFn(salvarLimite);
  const criarFn = useServerFn(criarLimiteExtra);
  const excluirFn = useServerFn(excluirLimiteExtra);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: LIMITES_KEY, queryFn: () => fn({}) });
  const [valores, setValores] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<{ user_id: string; ferramenta: Ferramenta; extra: string; dias: string }>({ user_id: "", ferramenta: "copiloto", extra: "10", dias: "1" });

  const limites = useMemo(() => new Map((q.data?.limites ?? []).map((l) => [l.ferramenta, l.limite_diario])), [q.data]);
  const valorDe = (f: string) => valores[f] ?? (limites.get(f) == null ? "" : String(limites.get(f)));

  const salvar = useMutation({
    mutationFn: (f: Ferramenta) => {
      const v = valorDe(f).trim();
      return salvarFn({ data: { ferramenta: f, limite_diario: v === "" ? null : Number(v) } });
    },
    onSuccess: () => { toast.success("Limite salvo."); setValores({}); qc.invalidateQueries({ queryKey: LIMITES_KEY }); },
    onError: erro,
  });
  const criar = useMutation({
    mutationFn: () => criarFn({ data: { user_id: extra.user_id, ferramenta: extra.ferramenta, extra: Number(extra.extra), dias: Number(extra.dias) } }),
    onSuccess: () => { toast.success("Liberação criada."); qc.invalidateQueries({ queryKey: LIMITES_KEY }); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIMITES_KEY }),
    onError: erro,
  });

  const d = q.data;
  return (
    <AdminListDetail
      title={TITULO} subtitle="Quantas vezes por dia cada pessoa pode usar cada ferramenta de IA. Admin não tem limite. O dia vira à meia-noite de Brasília." belowHeader={tabs}
      panel={(
        <div>
          <PanelHeader overline="Liberar mais" title="Liberação extra para uma pessoa" />
          <FieldLabel htmlFor="ext-user">Pessoa</FieldLabel>
          <select id="ext-user" className={inputCls} value={extra.user_id} onChange={(e) => setExtra({ ...extra, user_id: e.target.value })}>
            <option value="">Escolha…</option>
            {(d?.usuarios ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <FieldLabel htmlFor="ext-ferr">Ferramenta</FieldLabel>
          <select id="ext-ferr" className={inputCls} value={extra.ferramenta} onChange={(e) => setExtra({ ...extra, ferramenta: e.target.value as Ferramenta })}>
            {FERRAMENTAS.map((f) => <option key={f} value={f}>{FERRAMENTA_LABEL[f]}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="ext-qtd">Usos a mais por dia</FieldLabel>
              <input id="ext-qtd" type="number" min={1} className={inputCls} value={extra.extra} onChange={(e) => setExtra({ ...extra, extra: e.target.value })} />
            </div>
            <div>
              <FieldLabel htmlFor="ext-dias">Por quantos dias</FieldLabel>
              <input id="ext-dias" type="number" min={1} max={90} className={inputCls} value={extra.dias} onChange={(e) => setExtra({ ...extra, dias: e.target.value })} />
            </div>
          </div>
          <GoldButton className="mt-4 h-9 text-[14px]" disabled={!extra.user_id || Number(extra.extra) < 1 || criar.isPending} onClick={() => criar.mutate()}>Liberar</GoldButton>

          <div className="mt-6 border-t border-line pt-4">
            <Overline>Liberações em vigor</Overline>
            {!(d?.extras.length) ? <p className="mt-2 text-[14px] text-ink-muted">Nenhuma.</p> : (
              <ul className="mt-2">
                {d.extras.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 border-b border-line py-2 text-[14px]">
                    <span className="min-w-0 text-ink">
                      {e.nome} · {FERRAMENTA_LABEL[e.ferramenta as Ferramenta] ?? e.ferramenta} <span className="text-ink-muted">+{e.extra}/dia até {new Date(e.valido_ate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                    </span>
                    <button type="button" className="shrink-0 text-ink-muted hover:text-ink" onClick={() => excluir.mutate(e.id)}>Remover</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    >
      {q.isLoading ? <Carregando /> : (
        <div className="border-t border-line">
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_64px_64px_64px] items-center gap-3 px-3 py-2 text-[12px] text-ink-muted sm:grid">
            <span>Ferramenta</span><span>Limite por dia</span><span className="text-right">Hoje</span><span className="text-right">7 dias</span><span className="text-right">Pessoas</span>
          </div>
          {FERRAMENTAS.map((f) => {
            const u = d?.uso[f];
            const mudou = valorDe(f) !== (limites.get(f) == null ? "" : String(limites.get(f)));
            return (
              <div key={f} className="grid grid-cols-[minmax(0,1fr)_120px_64px_64px_64px] items-center gap-3 border-b border-line px-3 py-2.5">
                <span className="min-w-0 truncate text-[15px] text-ink">{FERRAMENTA_LABEL[f]}</span>
                <span className="flex items-center gap-1.5">
                  <input
                    aria-label={`Limite diário de ${FERRAMENTA_LABEL[f]}`} type="number" min={1} placeholder="Sem limite"
                    className={cn(inputCls, "h-8 w-[86px] px-2 py-1")} value={valorDe(f)} onChange={(e) => setValores({ ...valores, [f]: e.target.value })}
                  />
                  {mudou && <button type="button" className="text-[13px] font-semibold text-gold-text hover:underline" onClick={() => salvar.mutate(f)}>Salvar</button>}
                </span>
                <span className="text-right text-[14px] tabular-nums text-ink">{u?.hoje ?? 0}</span>
                <span className="text-right text-[14px] tabular-nums text-ink">{u?.semana ?? 0}</span>
                <span className="text-right text-[14px] tabular-nums text-ink">{u?.pessoas ?? 0}</span>
              </div>
            );
          })}
          <p className="px-3 py-3 text-[13px] text-ink-muted">Em branco = sem limite. Uso conta tentativas bem-sucedidas, sem guardar o conteúdo.</p>
        </div>
      )}
    </AdminListDetail>
  );
}

// ===========================================================================
// Raio-X da equipe
// ===========================================================================

const fmtData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

function Padroes({ p }: { p: PadroesRaiox }) {
  const Lista = ({ itens, vazio }: { itens: { nome: string; n: number }[]; vazio: string }) => (
    itens.length ? (
      <ol className="mt-1.5 space-y-1">
        {itens.map((i) => <li key={i.nome} className="flex justify-between gap-3 text-[14.5px] text-ink"><span className="min-w-0">{i.nome}</span><span className="shrink-0 tabular-nums text-ink-muted">{i.n}×</span></li>)}
      </ol>
    ) : <p className="mt-1.5 text-[14px] text-ink-muted">{vazio}</p>
  );
  return (
    <div className="space-y-5">
      <div><Overline>Raio-X feitos (90 dias)</Overline><p className="mt-1 text-[24px] font-medium leading-8 text-ink">{p.total}</p></div>
      <div><Overline>Técnicas que mais faltam</Overline><Lista itens={p.tecnicas} vazio="Ainda sem dados." /></div>
      <div><Overline>Erros de escrita mais frequentes</Overline><Lista itens={p.escrita} vazio="Nenhum erro registrado." /></div>
      <div><Overline>Etapa em que mais perde</Overline><Lista itens={p.etapa ? [p.etapa] : []} vazio="Ainda sem dados." /></div>
    </div>
  );
}

export function RaioxEquipeTab() {
  const fn = useServerFn(getRaioxEquipe);
  const vendFn = useServerFn(getRaioxVendedor);
  const q = useQuery({ queryKey: ["admin-raiox-equipe"], queryFn: () => fn({}) });
  const [sel, setSel] = useState<string>("equipe");
  const vendedor = q.data?.vendedores.find((v) => v.user_id === sel) ?? null;
  const detalhe = useQuery({
    queryKey: ["admin-raiox-vendedor", sel], enabled: !!vendedor,
    queryFn: () => vendFn({ data: { user_id: sel } }),
  });

  const painel = q.data ? (
    <div>
      <PanelHeader overline={vendedor ? "Vendedor" : "Equipe"} title={vendedor ? vendedor.nome : "Toda a equipe"} />
      <Padroes p={vendedor ?? q.data.equipe} />
      {vendedor && (
        <div className="mt-6 border-t border-line pt-4">
          <Overline>Resultados (90 dias)</Overline>
          {detalhe.isLoading ? <Carregando /> : (
            <ul className="mt-2 space-y-4">
              {(detalhe.data ?? []).map((r) => (
                <li key={r.id} className="rounded-lg border border-line p-3 text-[14px] leading-6 text-ink">
                  <p className="text-[12.5px] text-ink-muted">{fmtData(r.created_at)}{r.etapa ? ` · ${ETAPA_FUNIL_NOME[r.etapa as keyof typeof ETAPA_FUNIL_NOME] ?? r.etapa}` : ""}</p>
                  {r.onde_perdeu?.descricao && <p className="mt-1">{r.onde_perdeu.descricao}</p>}
                  {(r.onde_perdeu?.fala_cliente || r.onde_perdeu?.fala_atendente) && (
                    <p className="mt-1 text-ink-muted">
                      {r.onde_perdeu.fala_cliente && <>Cliente: “{r.onde_perdeu.fala_cliente}”</>}
                      {r.onde_perdeu.fala_cliente && r.onde_perdeu.fala_atendente && " · "}
                      {r.onde_perdeu.fala_atendente && <>Atendente: “{r.onde_perdeu.fala_atendente}”</>}
                    </p>
                  )}
                  {r.faltou?.length > 0 && <p className="mt-1 flex flex-wrap gap-1.5">{r.faltou.map((f, i) => <span key={i} className="rounded-full border border-line-strong px-2 py-0.5 text-[12px]">{f.tecnica}</span>)}</p>}
                </li>
              ))}
              {!detalhe.data?.length && <p className="text-[14px] text-ink-muted">Nenhum Raio-X nos últimos 90 dias.</p>}
            </ul>
          )}
        </div>
      )}
      <p className="mt-6 rounded-xl border border-dashed border-line-strong p-3 text-[13px] leading-5 text-ink-muted">
        Só números, padrões e trechos já sem nome ou telefone do cliente. A conversa completa nunca é guardada. Os resultados somem após 90 dias.
      </p>
    </div>
  ) : <PanelEmpty>Carregando…</PanelEmpty>;

  return (
    <AdminListDetail title="Raio-X da equipe" subtitle="Padrões das análises de venda perdida, por vendedor e da equipe toda." panel={painel}>
      {q.isLoading ? <Carregando /> : (
        <div className="border-t border-line">
          <ListRow active={sel === "equipe"} onClick={() => setSel("equipe")}>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">Toda a equipe</span>
            <span className="shrink-0 text-[13px] text-ink-muted">{q.data?.equipe.total ?? 0} Raio-X</span>
          </ListRow>
          {(q.data?.vendedores ?? []).map((v) => (
            <ListRow key={v.user_id} active={sel === v.user_id} onClick={() => setSel(v.user_id)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{v.nome}</span>
                <span className="block truncate text-[13px] text-ink-muted">{v.tecnicas[0] ? `Falta mais: ${v.tecnicas[0].nome}` : "Sem dados de técnica"} · último em {fmtData(v.ultimo)}</span>
              </span>
              <span className="shrink-0 text-[13px] text-ink-muted">{v.total} Raio-X</span>
            </ListRow>
          ))}
          {!q.data?.vendedores.length && <p className="py-6 text-[14px] text-ink-muted">Ninguém fez Raio-X ainda.</p>}
        </div>
      )}
    </AdminListDetail>
  );
}
