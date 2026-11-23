import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListObjecoes, deleteObjecao, upsertObjecao } from "@/lib/cliente-disse.functions";
import { ANGULO_LABEL, objecaoVazia, type AnguloTipo, type Objecao, type ObjecaoConteudo, type Status } from "@/lib/cliente-disse";
import { GoldButton, OutlineButton, normalize } from "@/components/scripts/shared";
import { BASE_KEY } from "@/components/cliente-disse/shared";
import { AdminListDetail, DeleteLink, FieldLabel, FilterPill, ListRow, PanelEmpty, PanelHeader, StatusTag, fmtDia, inputCls } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";
import { erro, ObjecaoForm } from "@/components/admin/cliente-disse-shared";


// ===========================================================================
// Objeções
// ===========================================================================

type ObjecaoEdit = ObjecaoConteudo & { id?: string; prioridade: number; status: Status };


export function ObjecoesAdminTab() {
  const listFn = useServerFn(adminListObjecoes);
  const upsertFn = useServerFn(upsertObjecao);
  const delFn = useServerFn(deleteObjecao);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-objecoes"], queryFn: () => listFn({}) });
  const [filtro, setFiltro] = useState<"todas" | Status>("todas");
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<ObjecaoEdit | null>(null);

  const objecoes = q.data?.objecoes ?? [];
  const uso30 = q.data?.uso30 ?? {};
  const lista = objecoes.filter((o) =>
    (filtro === "todas" || o.status === filtro) && (!busca.trim() || normalize(`${o.nome} ${o.exemplos_de_fala.join(" ")}`).includes(normalize(busca.trim()))),
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-objecoes"] });
    qc.invalidateQueries({ queryKey: BASE_KEY });
  };
  const salvar = useMutation({
    mutationFn: (v: ObjecaoEdit) => upsertFn({ data: v }),
    onSuccess: (o) => { toast.success(o.status === "publicada" ? "Objeção publicada." : "Salvo como rascunho."); setEdit(toEdit(o)); refresh(); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída."); setEdit(null); refresh(); },
    onError: erro,
  });

  return (
    <AdminListDetail
      title="Objeções"
      subtitle="Respostas aprovadas que aparecem em Scripts → O cliente disse…"
      actions={<GoldButton className="h-9 text-[14px]" onClick={() => setEdit({ ...objecaoVazia(), prioridade: (objecoes.length + 1) * 10, status: "rascunho" })}>+ Nova objeção</GoldButton>}
      filters={(["todas", "publicada", "rascunho"] as const).map((f) => (
        <FilterPill key={f} active={filtro === f} onClick={() => setFiltro(f)}>
          {f === "todas" ? "Todas" : f === "publicada" ? "Publicadas" : "Rascunhos"}
        </FilterPill>
      ))}
      search={busca}
      onSearch={setBusca}
      panel={
        edit ? (
          <div>
            <PanelHeader overline={edit.id ? "Editando · objeção" : "Nova · objeção"} title={edit.nome || "Sem nome"} onClose={() => setEdit(null)} />
            <ObjecaoForm value={edit} onChange={(v) => setEdit({ ...edit, ...v })} />
            <FieldLabel>Prioridade (menor trata primeiro)</FieldLabel>
            <input type="number" className={cn(inputCls, "w-28")} value={edit.prioridade} onChange={(e) => setEdit({ ...edit, prioridade: Number(e.target.value) || 0 })} />
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <GoldButton className="h-9 text-[14px]" disabled={!edit.nome.trim() || salvar.isPending} onClick={() => salvar.mutate(edit)}>Salvar</GoldButton>
              {edit.status === "rascunho" ? (
                <OutlineButton className="h-9 text-[14px]" disabled={!edit.nome.trim() || salvar.isPending} onClick={() => salvar.mutate({ ...edit, status: "publicada" })}>Publicar</OutlineButton>
              ) : (
                <OutlineButton className="h-9 text-[14px]" disabled={salvar.isPending} onClick={() => salvar.mutate({ ...edit, status: "rascunho" })}>Voltar para rascunho</OutlineButton>
              )}
              <OutlineButton className="h-9 text-[14px]" onClick={() => setEdit(null)}>Cancelar</OutlineButton>
              {edit.id && <DeleteLink title="Excluir esta objeção?" onConfirm={() => excluir.mutate(edit.id!)} />}
            </div>
          </div>
        ) : <PanelEmpty />
      }
    >
      {q.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
      {!q.isLoading && lista.length === 0 && <p className="py-6 text-sm text-ink-muted">Nenhuma objeção {filtro === "publicada" ? "publicada " : ""}ainda.</p>}
      {lista.map((o) => {
        const u = uso30[o.id];
        return (
          <ListRow key={o.id} active={edit?.id === o.id} onClick={() => setEdit(toEdit(o))}>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-[15px] text-ink", edit?.id === o.id && "font-semibold")}>{o.nome}</span>
              <span className="block truncate text-[12.5px] text-ink-muted">
                usada {u?.total ?? 0}× em 30 dias{u?.topAngulo ? ` · mais usado: ${ANGULO_LABEL[u.topAngulo as AnguloTipo] ?? (u.topAngulo === "avancar" ? "Para avançar" : u.topAngulo)}` : ""}
              </span>
            </span>
            <StatusTag status={o.status} />
            <span className="hidden shrink-0 text-[12.5px] text-ink-muted sm:inline">Atualizado {fmtDia(o.updated_at)}</span>
          </ListRow>
        );
      })}
    </AdminListDetail>
  );
}


function toEdit(o: Objecao): ObjecaoEdit {
  return {
    id: o.id, nome: o.nome, exemplos_de_fala: o.exemplos_de_fala, leituras: o.leituras, angulos: o.angulos,
    pergunta_avancar: o.pergunta_avancar, evite_dizer: o.evite_dizer, prioridade: o.prioridade, status: o.status,
  };
}
