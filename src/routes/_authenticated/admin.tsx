import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listContent, upsertContent, deleteContent,
  listScripts, upsertScript, deleteScript,
  listPricing, upsertPricing, deletePricing,
} from "@/lib/content.functions";
import {
  listUsers, promoteUser, setUserActive, createUser, resetUserPassword,
  getStats, adminListConversations,
} from "@/lib/users.functions";
import { reindexAll, getIndexStats } from "@/lib/embeddings.functions";
import { seedInitialData } from "@/lib/seed.functions";
import { getAiSettings, updateAiSettings } from "@/lib/chat.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Database, Pencil, Plus, RefreshCw, Settings, Sparkles, Trash2, UserPlus, Users } from "lucide-react";
import { MessagesTab } from "@/components/admin/MessagesTab";
import { FlowsTab } from "@/components/admin/FlowsTab";
import { TaxonomyTab } from "@/components/admin/TaxonomyTab";
import { SuggestionsTab } from "@/components/admin/SuggestionsTab";
import { MenuTab } from "@/components/admin/MenuTab";
import { AppearanceTab } from "@/components/admin/AppearanceTab";
import { KnowledgeTab } from "@/components/admin/KnowledgeTab";
import { ClientProfilesTab } from "@/components/admin/ClientProfilesTab";
import { SimulatorResultsTab } from "@/components/admin/SimulatorResultsTab";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-1">Gestão de conteúdo, usuários e IA.</p>
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto justify-start">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="knowledge">Base IA</TabsTrigger>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          <TabsTrigger value="flows">Fluxos</TabsTrigger>
          <TabsTrigger value="taxonomy">Categorias</TabsTrigger>
          
          <TabsTrigger value="content">Conteúdo (legado)</TabsTrigger>
          <TabsTrigger value="pricing">Preços</TabsTrigger>
          <TabsTrigger value="suggestions">Sugestões</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
          <TabsTrigger value="ai">IA & Indexação</TabsTrigger>
          <TabsTrigger value="perfis">Perfis de Cliente</TabsTrigger>
<TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6"><OverviewTab /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
        <TabsContent value="knowledge" className="mt-6"><KnowledgeTab /></TabsContent>
        <TabsContent value="messages" className="mt-6"><MessagesTab /></TabsContent>
        <TabsContent value="flows" className="mt-6"><FlowsTab /></TabsContent>
        <TabsContent value="taxonomy" className="mt-6"><TaxonomyTab /></TabsContent>
        
        <TabsContent value="content" className="mt-6"><ContentTab /></TabsContent>
        <TabsContent value="pricing" className="mt-6"><PricingTab /></TabsContent>
        <TabsContent value="suggestions" className="mt-6"><SuggestionsTab /></TabsContent>
        <TabsContent value="menu" className="mt-6"><MenuTab /></TabsContent>
        <TabsContent value="appearance" className="mt-6"><AppearanceTab /></TabsContent>
        <TabsContent value="ai" className="mt-6"><AiTab /></TabsContent>
          <TabsContent value="perfis" className="mt-6"><ClientProfilesTab /></TabsContent>
<TabsContent value="atendimentos" className="mt-6"><SimulatorResultsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Overview ============
function OverviewTab() {
  const stats = useServerFn(getStats);
  const idx = useServerFn(getIndexStats);
  const convs = useServerFn(adminListConversations);
  const seed = useServerFn(seedInitialData);
  const qc = useQueryClient();

  const sQ = useQuery({ queryKey: ["admin-stats"], queryFn: () => stats({}) });
  const iQ = useQuery({ queryKey: ["index-stats"], queryFn: () => idx({}) });
  const cQ = useQuery({ queryKey: ["admin-convs"], queryFn: () => convs({}) });

  const seedMut = useMutation({
    mutationFn: () => seed({}),
    onSuccess: (r) => {
      toast.success(`Seed concluído: ${r.seeded.scripts} scripts, ${r.seeded.content} conteúdos, ${r.seeded.pricing} preços.`);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const cards = [
    { label: "Usuários", value: sQ.data?.totalUsers ?? 0 },
    { label: "Conversas IA", value: sQ.data?.totalConversations ?? 0 },
    { label: "Perguntas feitas", value: sQ.data?.totalUserMessages ?? 0 },
    { label: "Chunks indexados", value: iQ.data?.totalChunks ?? 0 },
    { label: "Scripts", value: sQ.data?.totalScripts ?? 0 },
    { label: "Itens de conteúdo", value: sQ.data?.totalContentItems ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold text-primary mt-1">{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Importar dados iniciais</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Carrega scripts, conhecimento, problemas, tutoriais e tabela de preços a partir do material base (Cartão de Todos). Só insere se as tabelas estiverem vazias.
            </p>
          </div>
          <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
            {seedMut.isPending ? "Importando..." : "Importar dados"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Últimas conversas com a IA</h3>
        {cQ.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {(cQ.data?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>}
        <div className="divide-y divide-border">
          {(cQ.data ?? []).slice(0, 10).map((c) => (
            <div key={c.id} className="py-2 flex justify-between items-center text-sm">
              <span className="truncate">{c.title}</span>
              <span className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============ Users ============
function UsersTab() {
  const list = useServerFn(listUsers);
  const promote = useServerFn(promoteUser);
  const active = useServerFn(setUserActive);
  const create = useServerFn(createUser);
  const reset = useServerFn(resetUserPassword);
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: () => list({}) });

  const [openNew, setOpenNew] = useState(false);
  const [newU, setNewU] = useState({ email: "", password: "", displayName: "", role: "funcionario" as "admin" | "funcionario" });

  const promoteMut = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "funcionario" }) => promote({ data: v }),
    onSuccess: () => { toast.success("Papel atualizado."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const activeMut = useMutation({
    mutationFn: (v: { userId: string; isActive: boolean }) => active({ data: v }),
    onSuccess: () => { toast.success("Status atualizado."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const createMut = useMutation({
    mutationFn: () => create({ data: newU }),
    onSuccess: () => { toast.success("Usuário criado."); setOpenNew(false); setNewU({ email: "", password: "", displayName: "", role: "funcionario" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const resetMut = useMutation({
    mutationFn: (v: { userId: string; newPassword: string }) => reset({ data: v }),
    onSuccess: () => toast.success("Senha redefinida."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Usuários ({usersQ.data?.length ?? 0})</h3>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><UserPlus className="h-4 w-4" /> Novo usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar novo usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={newU.displayName} onChange={(e) => setNewU({ ...newU, displayName: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={newU.email} onChange={(e) => setNewU({ ...newU, email: e.target.value })} /></div>
              <div><Label>Senha temporária</Label><Input type="text" value={newU.password} onChange={(e) => setNewU({ ...newU, password: e.target.value })} /></div>
              <div>
                <Label>Papel</Label>
                <Select value={newU.role} onValueChange={(v) => setNewU({ ...newU, role: v as "admin" | "funcionario" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcionario">Funcionário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(usersQ.data ?? []).map((u) => {
            const isAdmin = u.roles.includes("admin");
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.display_name || u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "Admin" : "Funcionário"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? "outline" : "destructive"}>{u.is_active ? "Ativo" : "Bloqueado"}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => promoteMut.mutate({ userId: u.id, role: isAdmin ? "funcionario" : "admin" })}>
                    {isAdmin ? "Rebaixar" : "Promover"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => activeMut.mutate({ userId: u.id, isActive: !u.is_active })}>
                    {u.is_active ? "Bloquear" : "Reativar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const pwd = prompt("Nova senha (mín. 8 caracteres):");
                    if (pwd && pwd.length >= 8) resetMut.mutate({ userId: u.id, newPassword: pwd });
                  }}>
                    Resetar senha
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============ Scripts ============
function ScriptsTab() {
  const list = useServerFn(listScripts);
  const upsert = useServerFn(upsertScript);
  const del = useServerFn(deleteScript);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["scripts"], queryFn: () => list({}) });

  const [edit, setEdit] = useState<null | { id?: string; category: string; subcategory: string; title: string; body: string; usage_note: string }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: { ...edit!, position: 0 } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["scripts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["scripts"] }); },
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Scripts ({q.data?.length ?? 0})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ category: "Principais", subcategory: "", title: "", body: "", usage_note: "" })}>
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Título</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {(q.data ?? []).map((s) => (
            <TableRow key={s.id}>
              <TableCell><Badge variant="secondary">{s.category}{s.subcategory ? ` · ${s.subcategory}` : ""}</Badge></TableCell>
              <TableCell className="font-medium">{s.title}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => setEdit({ id: s.id, category: s.category, subcategory: s.subcategory ?? "", title: s.title, body: s.body, usage_note: s.usage_note ?? "" })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar script" : "Novo script"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Categoria</Label><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
                <div><Label>Subcategoria</Label><Input value={edit.subcategory} onChange={(e) => setEdit({ ...edit, subcategory: e.target.value })} /></div>
              </div>
              <div><Label>Título</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div><Label>Corpo da mensagem</Label><Textarea rows={8} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
              <div><Label>Onde usar (opcional)</Label><Input value={edit.usage_note} onChange={(e) => setEdit({ ...edit, usage_note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Content (conhecimento/problemas/tutoriais) ============
function ContentTab() {
  const [section, setSection] = useState<"conhecimento" | "problemas" | "tutoriais" | "treinamentos">("conhecimento");
  const list = useServerFn(listContent);
  const upsert = useServerFn(upsertContent);
  const del = useServerFn(deleteContent);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["content", section], queryFn: () => list({ data: { section } }) });

  const [edit, setEdit] = useState<null | { id?: string; category: string; title: string; content: string; link_externo?: string; link_label?: string }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: { ...edit!, section, tags: [], position: 0, link_externo: edit!.link_externo ?? null, link_label: edit!.link_label ?? null } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["content", section] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["content", section] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={section} onValueChange={(v) => setSection(v as typeof section)}>
          <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="conhecimento">Conhecimento Geral</SelectItem>
            <SelectItem value="problemas">Problemas Técnicos</SelectItem>
            <SelectItem value="tutoriais">Tutoriais</SelectItem>
            <SelectItem value="treinamentos">Treinamentos</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ category: "", title: "", content: "", link_externo: "", link_label: "" })}>
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Título</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).map((c: { id: string; category: string | null; title: string; content: string; link_externo: string | null; link_label: string | null }) => (
              <TableRow key={c.id}>
                <TableCell><Badge variant="secondary">{c.category || "—"}</Badge></TableCell>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ id: c.id, category: c.category ?? "", title: c.title, content: c.content, link_externo: c.link_externo ?? "", link_label: c.link_label ?? "" })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Categoria</Label><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
              <div><Label>Título</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div><Label>Conteúdo (Markdown)</Label><Textarea rows={10} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></div>
              <div>
                 <Label>Link externo (vídeo, PDF, página...)</Label>
                 <Input placeholder="https://..." value={edit.link_externo ?? ""} onChange={(e) => setEdit({ ...edit, link_externo: e.target.value })} />
               </div>
               <div>
                 <Label>Texto do link</Label>
                 <Input placeholder="Ex: Assistir vídeo, Abrir PDF..." value={edit.link_label ?? ""} onChange={(e) => setEdit({ ...edit, link_label: e.target.value })} />
               </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Pricing ============
function PricingTab() {
  const list = useServerFn(listPricing);
  const upsert = useServerFn(upsertPricing);
  const del = useServerFn(deletePricing);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pricing"], queryFn: () => list({}) });

  const [edit, setEdit] = useState<null | { id?: string; category: string; specialty: string; cartao_price: string; particular_price: string; notes: string }>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({
      data: {
        id: edit!.id,
        category: edit!.category,
        specialty: edit!.specialty,
        cartao_price: edit!.cartao_price ? Number(edit!.cartao_price) : null,
        particular_price: edit!.particular_price ? Number(edit!.particular_price) : null,
        notes: edit!.notes || null,
        position: 0,
      },
    }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["pricing"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["pricing"] }); },
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Itens de Preço ({q.data?.length ?? 0})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ category: "Consultas", specialty: "", cartao_price: "", particular_price: "", notes: "" })}>
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead>Especialidade</TableHead>
            <TableHead className="text-right">CDT</TableHead>
            <TableHead className="text-right">Particular</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(q.data ?? []).map((p) => (
            <TableRow key={p.id}>
              <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
              <TableCell className="font-medium">{p.specialty}</TableCell>
              <TableCell className="text-right">{p.cartao_price != null ? `R$ ${Number(p.cartao_price).toFixed(2)}` : "—"}</TableCell>
              <TableCell className="text-right">{p.particular_price != null ? `R$ ${Number(p.particular_price).toFixed(2)}` : "—"}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => setEdit({ id: p.id, category: p.category, specialty: p.specialty, cartao_price: p.cartao_price?.toString() ?? "", particular_price: p.particular_price?.toString() ?? "", notes: p.notes ?? "" })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar preço" : "Novo preço"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Categoria</Label><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
              <div><Label>Especialidade</Label><Input value={edit.specialty} onChange={(e) => setEdit({ ...edit, specialty: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor CDT (R$)</Label><Input type="number" step="0.01" value={edit.cartao_price} onChange={(e) => setEdit({ ...edit, cartao_price: e.target.value })} /></div>
                <div><Label>Valor Particular (R$)</Label><Input type="number" step="0.01" value={edit.particular_price} onChange={(e) => setEdit({ ...edit, particular_price: e.target.value })} /></div>
              </div>
              <div><Label>Observações</Label><Input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ AI / Indexing ============
const parseSystemPrompt = (fullPrompt: string | undefined) => {
  if (!fullPrompt) return { article: "a", name: "", body: "" };
  const match = fullPrompt.match(/^Você é ([ao])\s+([^,]+),\s*(.*)$/s);
  if (match) {
    return {
      article: match[1],
      name: match[2].trim(),
      body: match[3].trim(),
    };
  }
  return { article: "a", name: "", body: fullPrompt };
};

function AiTab() {
  const reindex = useServerFn(reindexAll);
  const stats = useServerFn(getIndexStats);
  const getSettings = useServerFn(getAiSettings);
  const updateSettings = useServerFn(updateAiSettings);

  const qc = useQueryClient();
  const sQ = useQuery({ queryKey: ["index-stats"], queryFn: () => stats({}) });

  const sSettings = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => getSettings({}),
  });

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [genderArticle, setGenderArticle] = useState("a");
  const [resumeReindex, setResumeReindex] = useState(false);

  useEffect(() => {
    if (sSettings.data) {
      const parsed = parseSystemPrompt(sSettings.data.system_prompt);
      setGenderArticle(parsed.article);
      setName(parsed.name);
      setPrompt(parsed.body);
      if (sSettings.data.model) {
        setModel(sSettings.data.model);
      }
    }
  }, [sSettings.data]);

  const mut = useMutation({
    mutationFn: () => reindex({ data: { reset: !resumeReindex } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success(`Reindexação concluída: ${r.indexed} novos chunks. ${r.skipped} já estavam atualizados.`);
        setResumeReindex(false);
      } else {
        toast.warning(`${r.indexed} chunks indexados. Limite temporário da IA atingido; tente novamente em alguns minutos para continuar.`);
        setResumeReindex(true);
      }
      qc.invalidateQueries({ queryKey: ["index-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const saveSettingsMut = useMutation({
    mutationFn: () => {
      const article = name === "Assistente IA do Cartão de Todos" ? "o" : "a";
      const finalPrompt = name ? `Você é ${article} ${name}, ${prompt}` : prompt;
      return updateSettings({
        data: {
          system_prompt: finalPrompt,
          model,
        },
      });
    },
    onSuccess: () => {
      toast.success("Configurações salvas.");
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar configurações"),
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Base vetorial (RAG)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Reindexa scripts, conhecimento, problemas, tutoriais e preços gerando embeddings semânticos. Execute após adicionar ou alterar conteúdo.
            </p>
            {resumeReindex ? (
              <p className="text-sm text-amber-600 mt-2">
                Reindexação pausada por limite temporário da IA. Aguarde alguns minutos e clique novamente para continuar sem apagar o progresso.
              </p>
            ) : null}
            <p className="text-sm mt-2">Total atual: <strong className="text-primary">{sQ.data?.totalChunks ?? 0}</strong> chunks indexados.</p>
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${mut.isPending ? "animate-spin" : ""}`} />
            {mut.isPending ? "Reindexando..." : resumeReindex ? "Continuar reindexação" : "Reindexar tudo"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Modelo da IA</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O assistente usa <code className="text-xs bg-muted px-1 py-0.5 rounded">google/gemini-3-flash-preview</code> via Lovable AI Gateway, com busca híbrida na base interna. Embeddings em 1536 dimensões compatíveis com <code className="text-xs bg-muted px-1 py-0.5 rounded">text-embedding-3-small</code>.
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" /> Configurações de Prompt & IA
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Personalize o nome da assistente, o modelo de linguagem e as diretrizes principais do system prompt.
          </p>
        </div>

        {sSettings.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando configurações...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assistant-name">Nome da assistente</Label>
                <Input
                  id="assistant-name"
                  placeholder="Ex: Sofia"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-model">Modelo</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="ai-model">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google/gemini-3-flash-preview">google/gemini-3-flash-preview</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Prompt</Label>
              <Textarea
                id="system-prompt"
                rows={10}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Escreva as instruções de comportamento do sistema da IA..."
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => saveSettingsMut.mutate()}
                disabled={saveSettingsMut.isPending}
              >
                {saveSettingsMut.isPending ? "Salvando..." : "Salvar configurações"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
