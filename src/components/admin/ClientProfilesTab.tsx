import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listClientProfiles, upsertClientProfile, deleteClientProfile } from "@/lib/clientprofiles.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const DIFFICULTY_LABELS: Record<string, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
  especialista: "Especialista",
};
const DIFFICULTY_COLORS: Record<string, string> = {
  facil: "bg-green-100 text-green-800",
  medio: "bg-yellow-100 text-yellow-800",
  dificil: "bg-orange-100 text-orange-800",
  especialista: "bg-red-100 text-red-800",
};

const EMPTY = { name: "", personality: "", difficulty: "medio", objectives: "", objections: "", behaviors: "", cliente_nome: "", cliente_cpf: "", cliente_regiao: "", cliente_genero: "masculino" };

export function ClientProfilesTab() {
  const listFn = useServerFn(listClientProfiles);
  const upsertFn = useServerFn(upsertClientProfile);
  const deleteFn = useServerFn(deleteClientProfile);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["client_profiles"], queryFn: () => listFn() });
  const profiles = (q.data ?? []) as any[];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });

  const upsertMut = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => {
      toast.success("Perfil salvo!");
      qc.invalidateQueries({ queryKey: ["client_profiles"] });
      setOpen(false);
      setForm({ ...EMPTY });
    },
    onError: () => toast.error("Erro ao salvar perfil."),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Perfil removido.");
      qc.invalidateQueries({ queryKey: ["client_profiles"] });
    },
    onError: () => toast.error("Erro ao remover."),
  });

  const openNew = () => { setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (p: any) => { setForm({ ...p }); setOpen(true); };
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Perfis de Cliente</h2>
          <p className="text-sm text-muted-foreground">Crie perfis para o Simulador MarcIAna usar como clientes virtuais.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Perfil</Button>
      </div>

      {profiles.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">Nenhum perfil cadastrado ainda. Clique em "Novo Perfil" para começar.</Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((p: any) => (
          <Card key={p.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm">{p.name}</h3>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <Badge className={DIFFICULTY_COLORS[p.difficulty] ?? ""}>{DIFFICULTY_LABELS[p.difficulty] ?? p.difficulty}</Badge>
            {p.personality && <p className="text-xs text-muted-foreground line-clamp-2">{p.personality}</p>}
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar Perfil" : "Novo Perfil de Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do perfil</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Cliente Desconfiado" />
            </div>
            <div>
              <Label>Nível de dificuldade</Label>
              <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facil">Fácil</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="dificil">Difícil</SelectItem>
                  <SelectItem value="especialista">Especialista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Personalidade</Label>
              <Textarea value={form.personality} onChange={e => set("personality", e.target.value)} placeholder="Descreva a personalidade do cliente..." rows={2} />
            </div>
            <div>
              <Label>Objetivos</Label>
              <Textarea value={form.objectives} onChange={e => set("objectives", e.target.value)} placeholder="O que esse cliente quer?" rows={2} />
            </div>
            <div>
              <Label>Objeções típicas</Label>
              <Textarea value={form.objections} onChange={e => set("objections", e.target.value)} placeholder="Quais objeções ele costuma levantar?" rows={2} />
            </div>
            <div>
              <Label>Comportamentos</Label>
              <Textarea value={form.behaviors} onChange={e => set("behaviors", e.target.value)} placeholder="Como ele age durante o atendimento?" rows={2} />
              </div>

              {/* Dados fictícios do cliente */}
              <div className="border-t pt-3 mt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Dados fictícios do cliente
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Nome completo</Label>
                    <Input value={form.cliente_nome ?? ""} 
                      onChange={e => set("cliente_nome", e.target.value)} 
                      placeholder="Ex: João Silva Santos" />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input value={form.cliente_cpf ?? ""} 
                      onChange={e => set("cliente_cpf", e.target.value)} 
                      placeholder="Ex: 123.456.789-00" />
                  </div>
                  <div>
                    <Label>Região</Label>
                    <Input value={form.cliente_regiao ?? ""} 
                      onChange={e => set("cliente_regiao", e.target.value)} 
                      placeholder="Ex: Belo Horizonte - MG" />
                  </div>
                  <div>
                    <Label>Gênero do avatar</Label>
                    <Select value={form.cliente_genero ?? "masculino"} 
                      onValueChange={v => set("cliente_genero", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsertMut.mutate(form)} disabled={!form.name || upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
