import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminListFechamento, deleteFechamentoItem, upsertFechamentoItem } from "@/lib/cliente-disse.functions";
import { ETAPAS, ETAPA_LABEL, ITEM_TIPOS, ITEM_TIPO_LABEL, VARIAVEIS, type Etapa, type FechamentoItem, type ItemTipo } from "@/lib/cliente-disse";
import { GoldButton, OutlineButton, normalize } from "@/components/scripts/shared";
import { BASE_KEY } from "@/components/cliente-disse/shared";
import { AdminListDetail, DeleteLink, FieldLabel, FilterPill, ListRow, PanelEmpty, PanelHeader, StatusTag, TagsField, inputCls } from "@/components/admin/AdminListDetail";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { erro } from "@/components/admin/cliente-disse-shared";


// ===========================================================================
// Fechamento
// ===========================================================================

type ItemEdit = Omit<FechamentoItem, "id" | "updated_at"> & { id?: string };


export function FechamentoAdminTab() {
  const listFn = useServerFn(adminListFechamento);
  const upsertFn = useServerFn(upsertFechamentoItem);
  const delFn = useServerFn(deleteFechamentoItem);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-fechamento"], queryFn: () => listFn({}) });
  const [tipo, setTipo] = useState<"todos" | ItemTipo>("todos");
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<ItemEdit | null>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);

  const itens = q.data ?? [];
  const filtrados = itens.filter((i) =>
    (tipo === "todos" || i.tipo === tipo) && (!busca.trim() || normalize(`${i.titulo} ${i.exemplos_de_fala.join(" ")}`).includes(normalize(busca.trim()))),
  );
  const porEtapa = useMemo(() => ETAPAS.map((e) => ({
    etapa: e,
    itens: filtrados.filter((i) => i.etapa === e).sort((a, b) => ITEM_TIPOS.indexOf(a.tipo) - ITEM_TIPOS.indexOf(b.tipo) || a.ordem - b.ordem),
  })), [filtrados]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-fechamento"] }); qc.invalidateQueries({ queryKey: BASE_KEY }); };
  const salvar = useMutation({
    mutationFn: (v: ItemEdit) => upsertFn({ data: v }),
    onSuccess: (r) => { toast.success(r.status === "publicada" ? "Publicado." : "Salvo como rascunho."); setEdit({ ...r }); refresh(); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído."); setEdit(null); refresh(); },
    onError: erro,
  });

  const inserirVar = (v: string) => {
    if (!edit) return;
    const el = msgRef.current;
    const atual = edit.mensagem ?? "";
    const ini = el?.selectionStart ?? atual.length;
    const fim = el?.selectionEnd ?? atual.length;
    const novo = atual.slice(0, ini) + v + atual.slice(fim);
    setEdit({ ...edit, mensagem: novo });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + v.length, ini + v.length); });
  };

  const novo = (): ItemEdit => ({
    tipo: tipo === "todos" ? "mensagem_etapa" : tipo, etapa: "proposta", titulo: "", exemplos_de_fala: [], mensagem: null,
    passos: [], evite: null, ordem: (itens.length + 1) * 10, status: "rascunho",
  });

  return (
    <AdminListDetail
      title="Fechamento"
      subtitle="Sinais de compra, mensagens de cada etapa e travamentos da aba Fechar com este cliente."
      actions={<GoldButton className="h-9 text-[14px]" onClick={() => setEdit(novo())}>+ Novo item</GoldButton>}
      filters={(["todos", ...ITEM_TIPOS] as const).map((t) => (
        <FilterPill key={t} active={tipo === t} onClick={() => setTipo(t)}>{t === "todos" ? "Todos" : ITEM_TIPO_LABEL[t]}</FilterPill>
      ))}
      search={busca}
      onSearch={setBusca}
      panel={
        edit ? (
          <div>
            <PanelHeader overline={`${edit.id ? "Editando" : "Novo"} · ${ITEM_TIPO_LABEL[edit.tipo].toLowerCase()}`} title={edit.titulo || "Sem título"} onClose={() => setEdit(null)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Tipo</FieldLabel>
                <select className={inputCls} value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value as ItemTipo })}>
                  {ITEM_TIPOS.map((t) => <option key={t} value={t}>{ITEM_TIPO_LABEL[t]}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Etapa</FieldLabel>
                <select className={inputCls} value={edit.etapa} onChange={(e) => setEdit({ ...edit, etapa: e.target.value as Etapa })}>
                  {ETAPAS.map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
                </select>
              </div>
            </div>
            <FieldLabel>Título</FieldLabel>
            <input className={inputCls} value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} />
            <FieldLabel>Exemplos de fala</FieldLabel>
            <TagsField value={edit.exemplos_de_fala} onChange={(v) => setEdit({ ...edit, exemplos_de_fala: v })} placeholder="Digite uma fala e Enter" />
            <FieldLabel>Mensagem</FieldLabel>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {VARIAVEIS.map((v) => (
                <button key={v} type="button" onClick={() => inserirVar(v)} className="rounded border border-line-strong px-1.5 py-0.5 font-mono text-[12px] text-ink hover:bg-surface-2">{v}</button>
              ))}
            </div>
            <textarea ref={msgRef} rows={5} className={inputCls} value={edit.mensagem ?? ""} onChange={(e) => setEdit({ ...edit, mensagem: e.target.value || null })} />
            <FieldLabel>Passos</FieldLabel>
            <div className="space-y-1.5">
              {edit.passos.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <span className="w-5 pt-2 text-right text-[13px] text-ink-muted">{i + 1}.</span>
                  <input className={inputCls} value={p} onChange={(e) => setEdit({ ...edit, passos: edit.passos.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <button type="button" aria-label="Remover passo" className="text-ink-muted hover:text-ink" onClick={() => setEdit({ ...edit, passos: edit.passos.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" className="text-[13.5px] font-semibold text-gold-text hover:underline" onClick={() => setEdit({ ...edit, passos: [...edit.passos, ""] })}>+ Passo</button>
            </div>
            <FieldLabel>Evite</FieldLabel>
            <textarea rows={2} className={inputCls} value={edit.evite ?? ""} onChange={(e) => setEdit({ ...edit, evite: e.target.value || null })} />
            <div className="mt-4 flex items-center gap-3">
              <Switch id="fech-pub" checked={edit.status === "publicada"} onCheckedChange={(c) => setEdit({ ...edit, status: c ? "publicada" : "rascunho" })} />
              <label htmlFor="fech-pub" className="text-[14px] text-ink">Publicado</label>
              <span className="ml-auto flex items-center gap-2 text-[13px] text-ink-muted">
                Ordem
                <input type="number" className={cn(inputCls, "w-20 py-1")} value={edit.ordem} onChange={(e) => setEdit({ ...edit, ordem: Number(e.target.value) || 0 })} />
              </span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <GoldButton className="h-9 text-[14px]" disabled={!edit.titulo.trim() || salvar.isPending} onClick={() => salvar.mutate({ ...edit, passos: edit.passos.filter((p) => p.trim()) })}>Salvar</GoldButton>
              <OutlineButton className="h-9 text-[14px]" onClick={() => setEdit(null)}>Cancelar</OutlineButton>
              {edit.id && <DeleteLink onConfirm={() => excluir.mutate(edit.id!)} />}
            </div>
          </div>
        ) : <PanelEmpty />
      }
    >
      {q.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
      {porEtapa.map((g) => (
        <section key={g.etapa} className="mb-4">
          <p className="type-overline border-b border-line pb-1.5 text-ink-muted">{ETAPA_LABEL[g.etapa]}</p>
          {g.itens.length === 0 && <p className="py-2 text-[13px] text-ink-muted">Nada cadastrado.</p>}
          {g.itens.map((i) => (
            <ListRow key={i.id} active={edit?.id === i.id} onClick={() => setEdit({ ...i })}>
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{i.titulo}</span>
              <span className="shrink-0 text-[12.5px] text-ink-muted">{ITEM_TIPO_LABEL[i.tipo]}</span>
              <StatusTag status={i.status} />
            </ListRow>
          ))}
        </section>
      ))}
    </AdminListDetail>
  );
}
