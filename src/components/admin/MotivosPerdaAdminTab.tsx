import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListMotivos, deleteMotivo, upsertMotivo } from "@/lib/retomada.functions";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { AdminListDetail, DeleteLink, FieldLabel, ListRow, PanelEmpty, PanelHeader, inputCls } from "@/components/admin/AdminListDetail";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { erro } from "@/components/admin/retomada-shared";

const MOTIVOS_KEY = ["admin-motivos-perda"] as const;


// ===========================================================================
// Motivos de perda
// ===========================================================================

interface MotivoEdit { id?: string; nome: string; ordem: number; ativo: boolean; usos?: number }


export function MotivosPerdaAdminTab() {
  const listFn = useServerFn(adminListMotivos);
  const upsertFn = useServerFn(upsertMotivo);
  const delFn = useServerFn(deleteMotivo);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: MOTIVOS_KEY, queryFn: () => listFn({}) });
  const [edit, setEdit] = useState<MotivoEdit | null>(null);
  const motivos = q.data ?? [];

  const refresh = () => { qc.invalidateQueries({ queryKey: MOTIVOS_KEY }); qc.invalidateQueries({ queryKey: ["retomada-base"] }); };
  const salvar = useMutation({
    mutationFn: (v: MotivoEdit) => upsertFn({ data: { id: v.id, nome: v.nome, ordem: v.ordem, ativo: v.ativo } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); refresh(); },
    onError: erro,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído."); setEdit(null); refresh(); },
    onError: erro,
  });

  return (
    <AdminListDetail
      title="Motivos de perda"
      subtitle="As opções que o atendente vê ao marcar um cliente como perdido."
      actions={<GoldButton className="h-9 text-[14px]" onClick={() => setEdit({ nome: "", ordem: (motivos.length + 1) * 10, ativo: true })}>+ Novo motivo</GoldButton>}
      panel={edit ? (
        <div>
          <PanelHeader overline={edit.id ? "Editando · motivo" : "Novo · motivo"} title={edit.nome || "Sem nome"} onClose={() => setEdit(null)} />
          <FieldLabel>Nome</FieldLabel>
          <input className={inputCls} value={edit.nome} maxLength={80} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
          <FieldLabel>Ordem (menor aparece primeiro)</FieldLabel>
          <input type="number" className={cn(inputCls, "w-28")} value={edit.ordem} onChange={(e) => setEdit({ ...edit, ordem: Number(e.target.value) || 0 })} />
          <label className="mt-4 flex items-center gap-2 text-[14px] text-ink">
            <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} /> Aparece para o atendente
          </label>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <GoldButton className="h-9 text-[14px]" disabled={!edit.nome.trim() || salvar.isPending} onClick={() => salvar.mutate(edit)}>Salvar</GoldButton>
            <OutlineButton className="h-9 text-[14px]" onClick={() => setEdit(null)}>Cancelar</OutlineButton>
            {edit.id && <DeleteLink title="Excluir este motivo?" description="Os clientes já marcados com ele continuam com o texto gravado." onConfirm={() => excluir.mutate(edit.id!)} />}
          </div>
        </div>
      ) : <PanelEmpty />}
    >
      {q.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p> : (
        <div className="border-t border-line">
          {motivos.map((m) => (
            <ListRow key={m.id} active={edit?.id === m.id} onClick={() => setEdit({ id: m.id, nome: m.nome, ordem: m.ordem, ativo: m.ativo })}>
              <span className={cn("min-w-0 flex-1 truncate text-[15px] font-medium", m.ativo ? "text-ink" : "text-ink-muted")}>{m.nome}</span>
              <span className="shrink-0 text-[13px] text-ink-muted">{m.usos} {m.usos === 1 ? "perdido" : "perdidos"}</span>
              {!m.ativo && <span className="shrink-0 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11.5px] text-ink-muted">Oculto</span>}
            </ListRow>
          ))}
        </div>
      )}
    </AdminListDetail>
  );
}
