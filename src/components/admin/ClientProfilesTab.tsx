import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listClientProfiles, upsertClientProfile, deleteClientProfile, moveClientProfile } from "@/lib/clientprofiles.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ClientProfileStatesEditor } from "@/components/admin/ClientProfileStatesEditor";

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

const EMPTY = { name: "", category_id: "", personality: "", difficulty: "medio", objectives: "", objections: "", behaviors: "", cliente_nome: "", cliente_cpf: "", cliente_regiao: "", cliente_genero: "masculino" };

export function ClientProfilesTab() {
  const listFn = useServerFn(listClientProfiles);
  const upsertFn = useServerFn(upsertClientProfile);
  const deleteFn = useServerFn(deleteClientProfile);
  const moveFn = useServerFn(moveClientProfile);
  const catFn = useServerFn(listCategories);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["client_profiles"], queryFn: () => listFn() });
  const catQ = useQuery({ queryKey: ["cats", "client_profile"], queryFn: () => catFn({ data: { scope: "client_profile" } }) });
  const profiles = (q.data ?? []) as any[];
  const categories = (catQ.data ?? []) as { id: string; name: string }[];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCat, setOverCat] = useState<string | null>(null);

  const upsertMut = useMutation({
    mutationFn: (d: any) => upsertFn({ data: { ...d, category_id: d.category_id || null } }),
    onSuccess: (result: any) => {
      toast.success("Perfil salvo!");
      qc.invalidateQueries({ queryKey: ["client_profiles"] });
      // Mantém o diálogo aberto e já com o id, para permitir cadastrar a Jornada em seguida.
      setForm((f: any) => ({ ...f, id: result?.id ?? f.id }));
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
  const moveMut = useMutation({
    mutationFn: (v: { id: string; category_id: string | null }) => moveFn({ data: v }),
    onSuccess: () => {
      toast.success("Perfil movido.");
      qc.invalidateQueries({ queryKey: ["client_profiles"] });
    },
    onError: () => toast.error("Erro ao mover perfil."),
  });

  const openNew = () => { setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (p: any) => { setForm({ ...p, category_id: p.category_id ?? "" }); setOpen(true); };
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const columns: { id: string | null; name: string }[] = [
    ...categories.map(c => ({ id: c.id as string | null, name: c.name })),
    { id: null, name: "Sem categoria" },
  ];

  const handleDrop = (catId: string | null) => {
    setOverCat(null);
    if (!dragId) return;
    const p = profiles.find(x => x.id === dragId);
    setDragId(null);
    if (!p || (p.category_id ?? null) === catId) return;
    moveMut.mutate({ id: dragId, category_id: catId });
  };

  const renderCard = (p: any) => (
    <Card
      key={p.id}
      draggable
      onDragStart={() => setDragId(p.id)}
      onDragEnd={() => { setDragId(null); setOverCat(null); }}
      className={`p-3 space-y-2 cursor-grab active:cursor-grabbing ${dragId === p.id ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          <GripVertical className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <h3 className="font-semibold text-sm truncate">{p.name}</h3>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      <Badge className={DIFFICULTY_COLORS[p.difficulty] ?? ""}>{DIFFICULTY_LABELS[p.difficulty] ?? p.difficulty}</Badge>
      {p.personality && <p className="text-xs text-muted-foreground line-clamp-2">{p.personality}</p>}
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Perfis de Cliente</h2>
          <p className="text-sm text-muted-foreground">Arraste os perfis entre as categorias (Filiação, Refiliação, Migração, EDT, Outros).</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Perfil</Button>
      </div>

      {profiles.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">Nenhum perfil cadastrado ainda. Clique em "Novo Perfil" para começar.</Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {columns.map(col => {
          const items = profiles.filter(p => (p.category_id ?? null) === col.id);
          const isOver = overCat === (col.id ?? "__null__");
          return (
            <div
              key={col.id ?? "none"}
              onDragOver={e => { e.preventDefault(); setOverCat(col.id ?? "__null__"); }}
              onDragLeave={() => setOverCat(null)}
              onDrop={e => { e.preventDefault(); handleDrop(col.id); }}
              className={`rounded-lg border bg-muted/30 p-3 space-y-3 min-h-[140px] transition-colors ${isOver ? "border-primary bg-primary/5" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{col.name}</h3>
                <Badge variant="outline">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map(renderCard)}
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">Solte um perfil aqui</p>
                )}
              </div>
            </div>
          );
        })}
      </div>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar Perfil" : "Novo Perfil de Cliente"}</DialogTitle></DialogHeader>

          <Tabs defaultValue="geral">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="personalidade">Personalidade</TabsTrigger>
              <TabsTrigger value="dados">Dados fictícios</TabsTrigger>
              <TabsTrigger value="jornada">Jornada</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-3 pt-4">
              <div>
                <Label>Nome do perfil</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Cliente Desconfiado" />
              </div>
              <div>
                <Label>Subcategoria</Label>
                <Select value={form.category_id || "none"} onValueChange={v => set("category_id", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="— Sem subcategoria —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem subcategoria —</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Gerencie as subcategorias (Filiação, Refiliação, Migração, EDT...) em Admin → Categorias. Você também pode arrastar o card entre as colunas.
                </p>
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
            </TabsContent>

            <TabsContent value="personalidade" className="space-y-3 pt-4">
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
            </TabsContent>

            <TabsContent value="dados" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">
                Esses dados aparecem no cartão do cliente durante a simulação e podem ser usados pela IA nas respostas.
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
            </TabsContent>

            <TabsContent value="jornada" className="pt-4">
              {form.id ? (
<ClientProfileStatesEditor profileId={form.id} profileNome={form.cliente_nome} profileCpf={form.cliente_cpf} />
    ) : (
                <p className="text-sm text-muted-foreground">
                  Clique em "Salvar" na aba Geral primeiro — depois que o perfil existir, você poderá cadastrar os estados da jornada aqui.
                </p>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button onClick={() => upsertMut.mutate(form)} disabled={!form.name || upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : form.id ? "Salvar alterações" : "Salvar e continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
