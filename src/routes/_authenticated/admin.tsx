import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listContent, upsertContent, deleteContent,
  listScripts, upsertScript, deleteScript,
  listPricing, upsertPricing, deletePricing, setPricingItemUnidades,
} from "@/lib/content.functions";
import {
  listUsers, promoteUser, setUserActive, createUser, resetUserPassword, deleteUser,
  getStats, adminListConversations,
} from "@/lib/users.functions";
import { reindexAll, getIndexStats } from "@/lib/embeddings.functions";
import { seedInitialData } from "@/lib/seed.functions";
import { getAiSettings, updateAiSettings, generateEssentialFactsDraft } from "@/lib/chat.functions";
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
import { Database, LayoutDashboard, Pencil, Plus, RefreshCw, Settings, Sparkles, Trash2, UserPlus, Users, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { listUnidades, upsertUnidade } from "@/lib/unidades.functions";
import { MessagesTab } from "@/components/admin/MessagesTab";
import { TaxonomyTab } from "@/components/admin/TaxonomyTab";
import { SuggestionsTab } from "@/components/admin/SuggestionsTab";
import { MenuTab } from "@/components/admin/MenuTab";
import { AppearanceTab } from "@/components/admin/AppearanceTab";
import { KnowledgeTab } from "@/components/admin/KnowledgeTab";
import { ClientProfilesTab } from "@/components/admin/ClientProfilesTab";
import { SimulatorResultsTab } from "@/components/admin/SimulatorResultsTab";
import { AdminSectionsTab, ADMIN_GROUP_ORDER } from "@/components/admin/AdminSectionsTab";
import { ChangelogTab } from "@/components/admin/ChangelogTab";
import { UnidadesTab } from "@/components/admin/UnidadesTab";
import { listAdminSections } from "@/lib/settings.functions";
import { getIcon } from "@/lib/icon-map";
import { cn } from "@/lib/utils";

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
  const sectionsFn = useServerFn(listAdminSections);
  const sectionsQ = useQuery({ queryKey: ["admin-sections-nav"], queryFn: () => sectionsFn({}) });
  const sections = (sectionsQ.data ?? []) as {
    id: string; tab_key: string; label: string; icon: string;
    group_name: string; position: number; visible: boolean;
  }[];

  const [active, setActive] = useState("overview");

  const visibleSections = sections.filter((s) => s.visible);
  const grouped = visibleSections.reduce<Record<string, typeof visibleSections>>((acc, s) => {
    (acc[s.group_name] ??= []).push(s);
    return acc;
  }, {});
  const orderedGroups = [...ADMIN_GROUP_ORDER, ...Object.keys(grouped).filter((g) => !ADMIN_GROUP_ORDER.includes(g))];

  const TAB_COMPONENTS: Record<string, ComponentType> = {
    users: UsersTab,
    knowledge: KnowledgeTab,
    messages: MessagesTab,
    taxonomy: TaxonomyTab,
    content: ContentTab,
    pricing: PricingTab,
    suggestions: SuggestionsTab,
    menu: MenuTab,
    appearance: AppearanceTab,
    ai: AiTab,
    perfis: ClientProfilesTab,
    atendimentos: SimulatorResultsTab,
organizacao: AdminSectionsTab,
    changelog: ChangelogTab,
    unidades: UnidadesTab,
  };
  const ActiveComponent = active === "overview" ? OverviewTab : (TAB_COMPONENTS[active] ?? OverviewTab);

  const navButtonClass = (key: string) =>
    cn(
      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors",
      active === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-1">Gestão de conteúdo, usuários e IA.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
        <nav className="lg:sticky lg:top-6 space-y-4">
          <button onClick={() => setActive("overview")} className={navButtonClass("overview")}>
            <LayoutDashboard className="h-4 w-4" /> Visão Geral
          </button>

          {sectionsQ.isLoading && <p className="px-3 text-xs text-muted-foreground">Carregando menu...</p>}

          {orderedGroups.map((group) => {
            const list = grouped[group];
            if (!list?.length) return null;
            return (
              <div key={group}>
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{group}</p>
                <div className="space-y-0.5">
                  {list.map((s) => {
                    const Icon = getIcon(s.icon);
                    return (
                      <button key={s.tab_key} onClick={() => setActive(s.tab_key)} className={navButtonClass(s.tab_key)}>
                        <Icon className="h-4 w-4" /> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="min-w-0">
          <ActiveComponent />
        </div>
      </div>
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
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
  const del = useServerFn(deleteUser);
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
  const deleteMut = useMutation({
    mutationFn: (userId: string) => del({ data: { userId } }),
    onSuccess: () => { toast.success("Usuário excluído."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
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
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Excluir usuário"
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      if (confirm(`Excluir permanentemente ${u.display_name || u.email}? Esta ação não pode ser desfeita.`)) {
                        deleteMut.mutate(u.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
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
  const setUnidadesFn = useServerFn(setPricingItemUnidades);
  const unidadesListFn = useServerFn(listUnidades);
  const upsertUnidadeFn = useServerFn(upsertUnidade);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pricing"], queryFn: () => list({}) });
  const unidadesQ = useQuery({ queryKey: ["unidades"], queryFn: () => unidadesListFn({}) });
  const unidadesList = (unidadesQ.data ?? []) as { id: string; nome: string }[];

  type UnidadeSel = "none" | "principal" | "outras";
  const [edit, setEdit] = useState<null | { id?: string; category: string; specialty: string; cartao_price: string; particular_price: string; notes: string; description: string; unidadesSel: Record<string, UnidadeSel> }>(null);
  const [descGenerating, setDescGenerating] = useState(false);

  // ---- Preenchimento automático via IA ----
  type AiPricingItem = { category: string; specialty: string; cartao_price: number | null; particular_price: number | null; notes: string | null; regioes_principais: string[]; regioes_outras: string[]; selected: boolean };
  const genAI = useServerFn(simulatorChat);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiPreview, setAiPreview] = useState<AiPricingItem[]>([]);

  const generateFromAI = async () => {
    if (!aiInput.trim()) return;
    setAiGenerating(true);
    try {
      const prompt = `Você organiza tabelas de preços de um cartão de descontos em saúde (Cartão de Todos) a partir de texto livre enviado por um administrador.
Extraia cada especialidade ou procedimento mencionado no texto e devolva um array JSON, um objeto por item, no formato exato:
[{"category": "...", "specialty": "...", "cartao_price": numero ou null, "particular_price": numero ou null, "notes": "texto curto ou null", "regioes_principais": ["..."], "regioes_outras": ["..."]}]

Regras:
- "category" agrupa itens parecidos (ex: "Consultas", "Exames", "Procedimentos", "Odontologia"). Use categorias curtas e consistentes entre os itens.
- "specialty" é o nome específico da especialidade ou procedimento (ex: "Cardiologista", "Hemograma completo").
- "cartao_price" e "particular_price" são números em reais, com ponto como separador decimal (ex: 45.90), sem o símbolo R$. Se um valor não aparecer no texto, use null.
- "notes" é opcional: use apenas se houver informação extra relevante sobre como a especialidade/procedimento funciona.
- "regioes_principais" e "regioes_outras" são listas de nomes de bairro/região/cidade, SE o texto mencionar onde aquele item está disponível. Se não houver nada, devolva as duas listas vazias.
- Responda APENAS com o array JSON, sem markdown, sem nenhum texto fora do JSON.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: aiInput }], model: "google/gemini-2.5-flash" } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const items: AiPricingItem[] = (Array.isArray(parsed) ? parsed : [])
        .map((it: any) => ({
          category: it.category || "Outros",
          specialty: it.specialty || "",
          cartao_price: typeof it.cartao_price === "number" ? it.cartao_price : null,
          particular_price: typeof it.particular_price === "number" ? it.particular_price : null,
          notes: it.notes || null,
          regioes_principais: Array.isArray(it.regioes_principais) ? it.regioes_principais : [],
          regioes_outras: Array.isArray(it.regioes_outras) ? it.regioes_outras : [],
          selected: true,
        }))
        .filter((it: AiPricingItem) => it.specialty);
      if (items.length === 0) { toast.error("A IA não conseguiu identificar nenhum item no texto enviado."); return; }
      setAiPreview(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA.");
    } finally {
      setAiGenerating(false);
    }
  };

  // acha a unidade pelo nome (sem diferenciar maiúsc/minúsc) ou cria uma nova
  const resolveUnidadeId = async (nome: string, cache: Map<string, string>) => {
    const key = nome.trim().toLowerCase();
    if (cache.has(key)) return cache.get(key)!;
    const existing = unidadesList.find((u) => u.nome.trim().toLowerCase() === key);
    if (existing) { cache.set(key, existing.id); return existing.id; }
    const created = await upsertUnidadeFn({ data: { nome: nome.trim(), position: 0 } });
    cache.set(key, created.id);
    return created.id;
  };

  const importSelected = async () => {
    const toImport = aiPreview.filter((i) => i.selected);
    if (toImport.length === 0) return;
    setAiImporting(true);
    const cache = new Map<string, string>();
    try {
      for (const item of toImport) {
        const created = await upsert({ data: { category: item.category, specialty: item.specialty, cartao_price: item.cartao_price, particular_price: item.particular_price, notes: item.notes, position: 0 } });
        const links: { unidade_id: string; destaque: boolean }[] = [];
        for (const nome of item.regioes_principais) links.push({ unidade_id: await resolveUnidadeId(nome, cache), destaque: true });
        for (const nome of item.regioes_outras) links.push({ unidade_id: await resolveUnidadeId(nome, cache), destaque: false });
        if (links.length > 0 && created?.id) {
          await setUnidadesFn({ data: { pricing_item_id: created.id, unidades: links } });
        }
      }
      toast.success(`${toImport.length} item(ns) importado(s)!`);
      qc.invalidateQueries({ queryKey: ["pricing"] });
      qc.invalidateQueries({ queryKey: ["unidades"] });
      setAiOpen(false); setAiInput(""); setAiPreview([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar itens.");
    } finally {
      setAiImporting(false);
    }
  };

  const generateDescription = async () => {
    if (!edit || !edit.specialty.trim()) { toast.error("Preencha o nome da especialidade primeiro."); return; }
    setDescGenerating(true);
    try {
      const prompt = `Você escreve descrições curtas para itens de uma tabela de preços de um cartão de descontos em saúde (Cartão de Todos), com o objetivo de ajudar uma busca por palavra-chave a encontrar o item certo mesmo quando o funcionário digita um sintoma, sinônimo ou termo relacionado, em vez do nome exato.

Item: ${edit.specialty}
Categoria: ${edit.category}
Observações cadastradas: ${edit.notes || "-"}

Escreva uma descrição curta (1 a 2 frases, até 240 caracteres), em texto corrido, mencionando: o que essa especialidade/procedimento trata ou resolve, e 3 a 6 palavras-chave/sinônimos relacionados (sintomas comuns, termos populares, área do corpo, etc.) que uma pessoa leiga poderia usar para buscar isso.

Responda APENAS com o texto da descrição, sem aspas, sem markdown, sem introdução.`;
      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: "Gere a descrição." }], model: "google/gemini-2.5-flash" } });
      setEdit((f) => f ? { ...f, description: content.trim() } : f);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar descrição.");
    } finally {
      setDescGenerating(false);
    }
  };

  const [bulkGenerating, setBulkGenerating] = useState(false);
  const generateAllMissingDescriptions = async () => {
    const faltando = (q.data ?? []).filter((p: any) => !p.description);
    if (faltando.length === 0) { toast.info("Todos os itens já têm descrição."); return; }
    setBulkGenerating(true);
    let sucesso = 0;
    try {
      for (const item of faltando) {
        try {
          const prompt = `Você escreve descrições curtas para itens de uma tabela de preços de um cartão de descontos em saúde (Cartão de Todos), com o objetivo de ajudar uma busca por palavra-chave a encontrar o item certo mesmo quando o funcionário digita um sintoma, sinônimo ou termo relacionado, em vez do nome exato.

Item: ${item.specialty}
Categoria: ${item.category}
Observações cadastradas: ${item.notes || "-"}

Escreva uma descrição curta (1 a 2 frases, até 240 caracteres), em texto corrido, mencionando: o que essa especialidade/procedimento trata ou resolve, e 3 a 6 palavras-chave/sinônimos relacionados (sintomas comuns, termos populares, área do corpo, etc.) que uma pessoa leiga poderia usar para buscar isso.

Responda APENAS com o texto da descrição, sem aspas, sem markdown, sem introdução.`;
          const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: "Gere a descrição." }], model: "google/gemini-2.5-flash" } });
          await upsert({ data: { id: item.id, category: item.category, specialty: item.specialty, cartao_price: item.cartao_price, particular_price: item.particular_price, notes: item.notes, description: content.trim(), position: 0 } });
          sucesso++;
        } catch {
          // Continua tentando os próximos itens mesmo se um falhar.
        }
      }
      toast.success(`${sucesso} de ${faltando.length} descrição(ões) gerada(s).`);
      qc.invalidateQueries({ queryKey: ["pricing"] });
    } finally {
      setBulkGenerating(false);
    }
  };

  const upsertMut = useMutation({
    mutationFn: async () => {
      const saved = await upsert({
        data: {
          id: edit!.id,
          category: edit!.category,
          specialty: edit!.specialty,
          cartao_price: edit!.cartao_price ? Number(edit!.cartao_price) : null,
          particular_price: edit!.particular_price ? Number(edit!.particular_price) : null,
          notes: edit!.notes || null,
          description: edit!.description || null,
          position: 0,
        },
      });
      const pricingItemId = edit!.id ?? saved.id;
      const unidades = Object.entries(edit!.unidadesSel)
        .filter(([, sel]) => sel !== "none")
        .map(([unidade_id, sel]) => ({ unidade_id, destaque: sel === "principal" }));
      await setUnidadesFn({ data: { pricing_item_id: pricingItemId, unidades } });
    },
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["pricing"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["pricing"] }); },
  });

  const openEdit = (p: any) => {
    const sel: Record<string, UnidadeSel> = {};
    ((p.unidades ?? []) as { destaque: boolean; unidade: { id: string; nome: string } | null }[]).forEach((link) => {
      if (link.unidade) sel[link.unidade.id] = link.destaque ? "principal" : "outras";
    });
    setEdit({
      id: p.id, category: p.category, specialty: p.specialty,
      cartao_price: p.cartao_price?.toString() ?? "", particular_price: p.particular_price?.toString() ?? "",
      notes: p.notes ?? "", description: (p as any).description ?? "", unidadesSel: sel,
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Itens de Preço ({q.data?.length ?? 0})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)}>
            <Sparkles className="h-4 w-4" /> Preencher com IA
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={generateAllMissingDescriptions} disabled={bulkGenerating}>
            <Sparkles className="h-4 w-4" /> {bulkGenerating ? "Gerando..." : "Gerar descrições faltantes"}
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setEdit({ category: "Consultas", specialty: "", cartao_price: "", particular_price: "", notes: "", description: "", unidadesSel: {} })}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
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
          {(q.data ?? []).map((p: any) => (
            <TableRow key={p.id}>
              <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
              <TableCell className="font-medium">{p.specialty}</TableCell>
              <TableCell className="text-right">{p.cartao_price != null ? `R$ ${Number(p.cartao_price).toFixed(2)}` : "—"}</TableCell>
              <TableCell className="text-right">{p.particular_price != null ? `R$ ${Number(p.particular_price).toFixed(2)}` : "—"}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
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

              <div>
                <Label>Unidades onde está disponível</Label>
                {unidadesList.length === 0 && <p className="text-xs text-muted-foreground mt-1">Nenhuma unidade cadastrada — vá em Admin → Unidades primeiro.</p>}
                <div className="space-y-1 mt-1">
                  {unidadesList.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-2 text-sm p-1.5 rounded border border-border/60">
                      <span>{u.nome}</span>
                      <Select
                        value={edit.unidadesSel[u.id] ?? "none"}
                        onValueChange={(v) => setEdit({ ...edit, unidadesSel: { ...edit.unidadesSel, [u.id]: v as UnidadeSel } })}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não vinculada</SelectItem>
                          <SelectItem value="principal">Principal</SelectItem>
                          <SelectItem value="outras">Outras regiões</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Descrição para busca (opcional)</Label>
                  <Button type="button" size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={generateDescription} disabled={descGenerating}>
                    <Sparkles className="h-3.5 w-3.5" /> {descGenerating ? "Gerando..." : "Gerar com IA"}
                  </Button>
                </div>
                <Textarea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  placeholder="Gerada por IA: ajuda a busca a encontrar por sintomas/sinônimos." />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={(v) => { setAiOpen(v); if (!v) { setAiPreview([]); setAiInput(""); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preencher tabela de preços com IA</DialogTitle></DialogHeader>

          {aiPreview.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cole abaixo o conteúdo com as especialidades, valores (Cartão de Todos e Particular) e qualquer observação extra. Pode colar de forma livre, como está no seu material — a IA organiza.
              </p>
              <Textarea rows={12} value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                placeholder={"Ex:\nCardiologia - consulta - R$ 80 pelo cartão, R$ 180 particular\nExame de sangue completo - R$ 45 cartão / R$ 90 particular - precisa jejum de 8h\n..."} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Confira os itens abaixo antes de importar. Desmarque o que não estiver certo — você pode ajustar manualmente depois na lista.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead className="text-right">CDT</TableHead>
                    <TableHead className="text-right">Particular</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiPreview.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Checkbox checked={item.selected}
                          onCheckedChange={(v) => setAiPreview((prev) => prev.map((p, i) => i === idx ? { ...p, selected: !!v } : p))} />
                      </TableCell>
                      <TableCell><Badge variant="secondary">{item.category}</Badge></TableCell>
                      <TableCell className="font-medium">{item.specialty}</TableCell>
                      <TableCell className="text-right">{item.cartao_price != null ? `R$ ${item.cartao_price.toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-right">{item.particular_price != null ? `R$ ${item.particular_price.toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            {aiPreview.length === 0 ? (
              <Button onClick={generateFromAI} disabled={aiGenerating || !aiInput.trim()} className="gap-2">
                <Sparkles className="h-4 w-4" /> {aiGenerating ? "Gerando..." : "Gerar com IA"}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAiPreview([])}>Voltar</Button>
                <Button onClick={importSelected} disabled={aiImporting || aiPreview.every((p) => !p.selected)}>
                  {aiImporting ? "Importando..." : `Importar ${aiPreview.filter((p) => p.selected).length} item(ns)`}
                </Button>
              </>
            )}
          </DialogFooter>
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
  const [essentialFacts, setEssentialFacts] = useState("");
  const [factsGenerating, setFactsGenerating] = useState(false);
  const genFactsDraft = useServerFn(generateEssentialFactsDraft);

  useEffect(() => {
    if (sSettings.data) {
      const parsed = parseSystemPrompt(sSettings.data.system_prompt);
      setGenderArticle(parsed.article);
      setName(parsed.name);
      setPrompt(parsed.body);
      if (sSettings.data.model) {
        setModel(sSettings.data.model);
      }
      setEssentialFacts((sSettings.data as any).essential_facts ?? "");
    }
  }, [sSettings.data]);

  const generateFactsDraft = async () => {
    setFactsGenerating(true);
    try {
      const { draft } = await genFactsDraft({});
      setEssentialFacts(draft);
      toast.success("Rascunho gerado — revise e clique em \"Salvar configurações\" para aplicar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar rascunho.");
    } finally {
      setFactsGenerating(false);
    }
  };

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

  const reindexIncrementalMut = useMutation({
    mutationFn: () => reindex({ data: { reset: false } }),
    onSuccess: (r) => {
      if (r.indexed === 0) {
        toast.success("Nenhum conteúdo novo para indexar.");
      } else {
        toast.success(`${r.indexed} novos chunks indexados!`);
      }
      qc.invalidateQueries({ queryKey: ["index-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao indexar."),
  });



const saveSettingsMut = useMutation({
    mutationFn: () => {
      const article = name === "Assistente IA do Cartão de Todos" ? "o" : "a";
      const finalPrompt = name ? `Você é ${article} ${name}, ${prompt}` : prompt;
      return updateSettings({
        data: {
          system_prompt: finalPrompt,
          model,
          essential_facts: essentialFacts,
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
          <div className="flex items-center gap-2">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${mut.isPending ? "animate-spin" : ""}`} />
              {mut.isPending ? "Reindexando..." : resumeReindex ? "Continuar reindexação" : "Reindexar tudo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reindexIncrementalMut.mutate()}
              disabled={reindexIncrementalMut.isPending}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {reindexIncrementalMut.isPending ? "Indexando..." : "Indexar novos conteúdos"}
            </Button>
          </div>

        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Modelo da IA</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O assistente usa <code className="text-xs bg-muted px-1 py-0.5 rounded">google/gemini-3-flash-preview</code> via Lovable AI Gateway, com busca híbrida na base interna. Embeddings em 1536 dimensões compatíveis com <code className="text-xs bg-muted px-1 py-0.5 rounded">text-embedding-3-small</code>.
        </p>
      </Card>

<Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Fatos Essenciais</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Fatos de alto risco (mensalidade, taxa de adesão, fidelidade, formas de pagamento...) que a MarcIAna SEMPRE usa como fonte confiável, mesmo sem busca — evita que conteúdo antigo ou duplicado na base a confunda. Sempre revise antes de salvar.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={generateFactsDraft} disabled={factsGenerating}>
            <Sparkles className="h-4 w-4" /> {factsGenerating ? "Gerando..." : "Gerar rascunho com IA"}
          </Button>
        </div>
        <Textarea
          rows={8}
          value={essentialFacts}
          onChange={(e) => setEssentialFacts(e.target.value)}
          placeholder='Ex: "Mensalidade: R$ 33,40. Taxa de adesão: R$ 66,80 (ou isenta com 5 indicações). Fidelidade: 12 meses, multa de 50% das mensalidades restantes. Pagamento: apenas cartão de crédito ou débito."'
        />
        <p className="text-xs text-muted-foreground">
          Lembre-se de clicar em "Salvar configurações" no final da página para aplicar as mudanças.
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
