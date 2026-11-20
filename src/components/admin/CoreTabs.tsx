import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useState } from "react";
import {
  listContent, upsertContent, deleteContent,
} from "@/lib/content.functions";
import { getAjudaFeedbackSummary } from "@/lib/ajuda.functions";
import {
  listUsers, promoteUser, setUserActive, createUser, resetUserPassword, deleteUser,
  updateUserBirthdate, updateUserDisplayName,
} from "@/lib/users.functions";
import { reindexAll, getIndexStats } from "@/lib/embeddings.functions";
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
import { Database, Pencil, Plus, RefreshCw, Settings, Sparkles, Trash2, UserPlus, Users, ShieldCheck } from "lucide-react";
import { MARCIANA_CHAT_MODEL } from "@/lib/ai-models";

// ============ Users ============
export function UsersTab() {
  const list = useServerFn(listUsers);
  const promote = useServerFn(promoteUser);
  const active = useServerFn(setUserActive);
  const create = useServerFn(createUser);
  const reset = useServerFn(resetUserPassword);
  const del = useServerFn(deleteUser);
  const setBirthdate = useServerFn(updateUserBirthdate);
  const setDisplayName = useServerFn(updateUserDisplayName);
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: () => list({}) });

  const [openNew, setOpenNew] = useState(false);
  const [newU, setNewU] = useState({ email: "", password: "", displayName: "", role: "funcionario" as "admin" | "funcionario", dataNascimento: "" });

  const birthdateMut = useMutation({
    mutationFn: (v: { userId: string; dataNascimento: string | null }) => setBirthdate({ data: v }),
    onSuccess: () => { toast.success("Data de nascimento salva."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const displayNameMut = useMutation({
    mutationFn: (v: { userId: string; displayName: string }) => setDisplayName({ data: v }),
    onSuccess: () => { toast.success("Nome atualizado."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

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
    mutationFn: () => create({ data: { ...newU, dataNascimento: newU.dataNascimento || null } }),
    onSuccess: () => { toast.success("Usuário criado."); setOpenNew(false); setNewU({ email: "", password: "", displayName: "", role: "funcionario", dataNascimento: "" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
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
        <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-gold-text" /> Usuários ({usersQ.data?.length ?? 0})</h3>
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
              <div>
                <Label>Data de nascimento (opcional)</Label>
                <Input type="date" value={newU.dataNascimento} onChange={(e) => setNewU({ ...newU, dataNascimento: e.target.value })} />
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
            <TableHead>Aniversário</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...(usersQ.data ?? [])].sort((a: any, b: any) => Number(a.is_active) - Number(b.is_active)).map((u: any) => {
            const isAdmin = u.roles.includes("admin");
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <Input defaultValue={u.display_name || ""} placeholder={u.email} className="h-8 text-sm font-medium mb-0.5"
                    onBlur={(e) => { if (e.target.value.trim() && e.target.value !== u.display_name) displayNameMut.mutate({ userId: u.id, displayName: e.target.value.trim() }); }} />
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "Admin" : "Funcionário"}</Badge>
                </TableCell>
                <TableCell>
                  <Input type="date" defaultValue={u.data_nascimento ?? ""} className="h-8 w-36 text-xs"
                    onBlur={(e) => birthdateMut.mutate({ userId: u.id, dataNascimento: e.target.value || null })} />
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

// ============ Central de Ajuda: Procedimentos / Problemas técnicos ============
// Era uma aba só ("Conteúdo (legado)") com um seletor problemas/tutoriais;
// agora cada uma vira uma seção própria do Admin, com a seção já fixa.
function ContentTab({ section }: { section: "problemas" | "tutoriais" }) {
  const list = useServerFn(listContent);
  const upsert = useServerFn(upsertContent);
  const del = useServerFn(deleteContent);
  const feedbackSummaryFn = useServerFn(getAjudaFeedbackSummary);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["content", section], queryFn: () => list({ data: { section } }) });
  const feedbackQ = useQuery({ queryKey: ["ajuda-feedback-summary"], queryFn: () => feedbackSummaryFn({}) });
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);

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
      <div className="flex justify-end">
        <Button size="sm" className="gap-2" onClick={() => setEdit({ category: "", title: "", content: "", link_externo: "", link_label: "" })}>
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Título</TableHead><TableHead>Isso ajudou?</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).map((c: { id: string; category: string | null; title: string; content: string; link_externo: string | null; link_label: string | null }) => {
              const fb = (feedbackQ.data as Record<string, { sim: number; nao: number; recentesNao: { data: string; pessoa: string }[] }> | undefined)?.[c.id];
              const open = feedbackOpenId === c.id;
              return (
                <Fragment key={c.id}>
                  <TableRow>
                    <TableCell><Badge variant="secondary">{c.category || "—"}</Badge></TableCell>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>
                      {fb && (fb.sim > 0 || fb.nao > 0) ? (
                        <button
                          type="button"
                          onClick={() => setFeedbackOpenId(open ? null : c.id)}
                          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                        >
                          {fb.sim} sim · {fb.nao} não
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setEdit({ id: c.id, category: c.category ?? "", title: c.title, content: c.content, link_externo: c.link_externo ?? "", link_label: c.link_label ?? "" })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && delMut.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                  {open && fb && fb.recentesNao.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted/30">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">"Não" mais recentes</p>
                        <ul className="space-y-0.5">
                          {fb.recentesNao.map((r, i) => (
                            <li key={i} className="text-sm text-muted-foreground">
                              {new Date(r.data).toLocaleDateString("pt-BR")} — {r.pessoa}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
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

export const ProcedimentosTab = () => <ContentTab section="tutoriais" />;
export const ProblemasTecnicosTab = () => <ContentTab section="problemas" />;

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

export function AiTab() {
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
  const [model, setModel] = useState(MARCIANA_CHAT_MODEL);
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
          client_knowledge: (sSettings.data as any)?.client_knowledge ?? "",
          simulador_nota_referencia: (sSettings.data as any)?.simulador_nota_referencia ?? null,
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
            <h3 className="font-semibold flex items-center gap-2"><Database className="h-4 w-4 text-gold-text" /> Base vetorial (RAG)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Reindexa scripts, conhecimento, problemas, tutoriais e preços gerando embeddings semânticos. Execute após adicionar ou alterar conteúdo.
            </p>
            {resumeReindex ? (
              <p className="text-sm text-amber-600 mt-2">
                Reindexação pausada por limite temporário da IA. Aguarde alguns minutos e clique novamente para continuar sem apagar o progresso.
              </p>
            ) : null}
            <p className="text-sm mt-2">Total atual: <strong className="text-gold-text">{sQ.data?.totalChunks ?? 0}</strong> chunks indexados.</p>
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
        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold-text" /> Modelo da IA</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O assistente usa <code className="text-xs bg-muted px-1 py-0.5 rounded">{MARCIANA_CHAT_MODEL}</code> via Lovable AI Gateway, com busca híbrida na base interna. Embeddings em 1536 dimensões compatíveis com <code className="text-xs bg-muted px-1 py-0.5 rounded">text-embedding-3-small</code>.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold-text" /> Fatos Essenciais</h3>
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
            <Settings className="h-4 w-4 text-gold-text" /> Configurações de Prompt & IA
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
                    <SelectItem value={MARCIANA_CHAT_MODEL}>{MARCIANA_CHAT_MODEL}</SelectItem>
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
