import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listClientProfileStates,
  upsertClientProfileState,
  deleteClientProfileState,
} from "@/lib/clientprofilestates.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface JourneyState {
  id: string;
  profile_id: string;
  position: number;
  name: string;
  description: string | null;
  example_lines: string | null;
  advance_criteria: string | null;
  attachment_url: string | null;
  attachment_label: string | null;
}

const EMPTY_STATE = {
  id: undefined as string | undefined,
  name: "",
  description: "",
  example_lines: "",
  advance_criteria: "",
  attachment_url: "",
  attachment_label: "",
};

const DEFAULT_FUNNEL = [
  {
    name: "Desconfiado",
    example_lines: "\"Nunca ouvi falar disso. Como funciona?\"",
    advance_criteria: "O atendente explicou claramente o que é o Cartão de Todos e como funciona o desconto.",
  },
  {
    name: "Interessado",
    example_lines: "\"Então eu continuo pagando a Cemig normalmente?\" / \"Tem algum contrato?\"",
    advance_criteria: "O atendente explicou corretamente como funciona o pagamento e as condições contratuais.",
  },
  {
    name: "Convencido",
    example_lines: "\"E o que vocês precisam de mim?\" / \"Tudo bem, vou enviar.\"",
    advance_criteria: "O atendente pediu a foto da conta de energia e um documento com CPF.",
  },
  {
    name: "Cadastro",
    example_lines: "\"Conseguiu visualizar?\" / \"Precisa de mais alguma coisa?\"",
    advance_criteria: "O atendente confirmou o recebimento dos documentos e seguiu com o cadastro.",
  },
  {
    name: "Fechamento",
    example_lines: "\"Quando começo a receber o desconto?\" / \"Como acompanho isso?\"",
    advance_criteria: "O atendente concluiu o cadastro e explicou os próximos passos.",
  },
];

export function ClientProfileStatesEditor({ profileId }: { profileId: string }) {
  const listFn = useServerFn(listClientProfileStates);
  const upsertFn = useServerFn(upsertClientProfileState);
  const deleteFn = useServerFn(deleteClientProfileState);
  const qc = useQueryClient();
  const queryKey = ["profile_states_admin", profileId];
  const q = useQuery({ queryKey, queryFn: () => listFn({ data: { profile_id: profileId } }) });
  const items = (q.data ?? []) as JourneyState[];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_STATE>({ ...EMPTY_STATE });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upsertMut = useMutation({
    mutationFn: (payload: any) => upsertFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setOpen(false);
      setForm({ ...EMPTY_STATE });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar estado."),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Estado removido."); qc.invalidateQueries({ queryKey }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover."),
  });

  const openNew = () => { setForm({ ...EMPTY_STATE }); setOpen(true); };
  const openEdit = (s: JourneyState) => {
    setForm({
      id: s.id, name: s.name, description: s.description ?? "",
      example_lines: s.example_lines ?? "", advance_criteria: s.advance_criteria ?? "",
      attachment_url: s.attachment_url ?? "", attachment_label: s.attachment_label ?? "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    upsertMut.mutate({
      id: form.id,
      profile_id: profileId,
      position: form.id ? items.find((i) => i.id === form.id)?.position ?? 0 : items.length,
      name: form.name,
      description: form.description || null,
      example_lines: form.example_lines || null,
      advance_criteria: form.advance_criteria || null,
      attachment_url: form.attachment_url || null,
      attachment_label: form.attachment_label || null,
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    upsertFn({ data: { ...a, position: b.position } })
      .then(() => upsertFn({ data: { ...b, position: a.position } }))
      .then(() => qc.invalidateQueries({ queryKey }))
      .catch(() => toast.error("Erro ao reordenar."));
  };

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem excede 8MB."); return; }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Usuário não autenticado");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${uid}/perfil_estados/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-images").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed) throw signErr ?? new Error("Não foi possível gerar URL da imagem");
      setForm((f) => ({ ...f, attachment_url: signed.signedUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar imagem");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const seedDefaultFunnel = async () => {
    for (let i = 0; i < DEFAULT_FUNNEL.length; i++) {
      const s = DEFAULT_FUNNEL[i];
      await upsertFn({ data: { profile_id: profileId, position: items.length + i, ...s } });
    }
    qc.invalidateQueries({ queryKey });
    toast.success("Funil padrão de 5 etapas adicionado.");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Defina os estados pelos quais esse cliente evolui durante a simulação. A IA avança de estado quando o atendente atende o critério descrito.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" /> Novo estado
        </Button>
        {items.length === 0 && (
          <Button size="sm" variant="secondary" className="gap-2" onClick={seedDefaultFunnel}>
            <Sparkles className="h-4 w-4" /> Usar funil padrão (5 etapas)
          </Button>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Nenhum estado cadastrado — o simulador vai conversar livremente com esse perfil, sem funil.
        </p>
      )}

      <div className="space-y-2">
        {items.map((s, i) => (
          <Card key={s.id} className="p-3 flex items-start gap-3">
            <div className="flex flex-col gap-0.5 pt-1">
              <button disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-20">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button disabled={i === items.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-20">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{i + 1}</Badge>
                <span className="font-medium text-sm">{s.name}</span>
                {s.attachment_url && <Badge variant="secondary" className="gap-1 text-[10px]"><ImagePlus className="h-3 w-3" /> {s.attachment_label || "anexo"}</Badge>}
              </div>
              {s.advance_criteria && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">Critério: {s.advance_criteria}</p>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => confirm("Remover este estado?") && deleteMut.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar estado" : "Novo estado"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do estado</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Desconfiado" />
            </div>
            <div>
              <Label>Falas de exemplo</Label>
              <Textarea rows={2} value={form.example_lines} onChange={(e) => setForm((f) => ({ ...f, example_lines: e.target.value }))}
                placeholder='Ex: "Nunca ouvi falar disso. Como funciona?"' />
            </div>
            <div>
              <Label>Critério para avançar ao próximo estado</Label>
              <Textarea rows={2} value={form.advance_criteria} onChange={(e) => setForm((f) => ({ ...f, advance_criteria: e.target.value }))}
                placeholder="Ex: o atendente explicou claramente como funciona o desconto." />
            </div>
            <div>
              <Label>Observações internas (opcional)</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label>Documento fictício enviado ao chegar nesse estado (opcional)</Label>
              {form.attachment_url ? (
                <div className="relative h-20 w-20">
                  <img src={form.attachment_url} alt="anexo" className="h-20 w-20 object-cover rounded-md border" />
                  <button type="button" className="absolute -top-1.5 -right-1.5 bg-black/70 text-white rounded-full p-0.5"
                    onClick={() => setForm((f) => ({ ...f, attachment_url: "" }))}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="outline" className="gap-2" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> {uploading ? "Enviando..." : "Enviar imagem"}
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files)} />
              {form.attachment_url && (
                <Input value={form.attachment_label} onChange={(e) => setForm((f) => ({ ...f, attachment_label: e.target.value }))}
                  placeholder="Legenda (ex: Conta de luz)" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
