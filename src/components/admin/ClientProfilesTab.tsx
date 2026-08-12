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
import { Plus, Trash2, Pencil, GripVertical, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ClientProfileStatesEditor } from "@/components/admin/ClientProfileStatesEditor";
import { simulatorChat } from "@/lib/simulator.chat.functions";

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

const EMPTY = {
  name: "", category_id: "", personality: "", difficulty: "medio", objectives: "", objections: "", behaviors: "",
  cliente_nome: "", cliente_cpf: "", cliente_regiao: "", cliente_genero: "masculino", cliente_telefone: "",
  endereco_rua: "", endereco_numero: "", endereco_complemento: "", endereco_bairro: "", endereco_cidade: "", endereco_estado: "", endereco_cep: "",
  dependentes: [] as { nome: string; cpf: string; nascimento: string; situacao: string }[],
};

// Padrões reais extraídos de atendimentos finalizados, por subcategoria.
// Atualize este texto conforme mais atendimentos forem analisados.
function guidancePorSubcategoria(nomeCategoria: string): string {
  const n = (nomeCategoria || "").toLowerCase();
  if (n.includes("refili")) {
    return `Padrão real de clientes de Refiliação: já foram clientes antes e pedem reativação/atualização cadastral diretamente — não começam desconfiados sobre o produto em si. Dúvidas típicas giram em torno da diferença entre pacotes (Regular vs Ouro), inclusão ou remoção de dependentes, e a indicação de 5 contatos para isenção da taxa de reativação.`;
  }
  if (n.includes("filia") && !n.includes("refilia")) {
    return `Padrão real de clientes de Filiação: já demonstram interesse inicial (não é preciso convencer do zero sobre o produto); a objeção típica não é desconfiança, e sim timing/valor do pagamento — "vou pagar já?", "não tenho esse valor agora", "vou esperar receber". Também costumam pedir para incluir dependentes durante o cadastro.`;
  }
  return `Ainda não há atendimentos reais analisados especificamente para esta subcategoria — baseie-se no fluxo geral de vendas do Cartão de Todos (apresentação, coleta de dados, pagamento, termo de fidelidade, documentos, fechamento) e na descrição fornecida pelo administrador.`;
}

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
  const categories = (catQ.data ?? []) as { id: string; name: string; slug?: string }[];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCat, setOverCat] = useState<string | null>(null);

  const genAI = useServerFn(simulatorChat);
  const [genOpen, setGenOpen] = useState(false);
  const [genCategoria, setGenCategoria] = useState("");
  const [genDescricao, setGenDescricao] = useState("");
  const [generating, setGenerating] = useState(false);

  const generateProfile = async () => {
    setGenerating(true);
    try {
      const categoriaNome = categories.find(c => c.id === genCategoria)?.name || "Sem subcategoria";
      const prompt = `Você cria perfis de clientes fictícios para simulações de treinamento de atendimento do "Cartão de Todos" (cartão de descontos em saúde).

Subcategoria do atendimento: ${categoriaNome}
${guidancePorSubcategoria(categoriaNome)}

Descrição breve dada pelo administrador sobre este cliente específico: "${genDescricao || "-"}"

Crie um perfil de cliente fictício coerente com o padrão real acima E com a descrição dada. Responda APENAS com JSON válido, sem markdown e sem texto fora do JSON, neste formato exato:
{"nome_sugerido": "...", "personality": "...", "objectives": "...", "objections": "...", "behaviors": "..."}

- "nome_sugerido": nome curto do PERFIL (não do cliente fictício), ex: "Cliente Curioso - Filiação".
- "personality": 1 a 2 frases descrevendo o jeito desse cliente.
- "objectives": o que ele quer alcançar no atendimento.
- "objections": as objeções típicas que ele levanta, baseadas no padrão real informado.
- "behaviors": como ele se comporta durante a conversa.`;

      const { content } = await genAI({ data: { messages: [{ role: "system", content: prompt }, { role: "user", content: "Gere o perfil." }], model: "google/gemini-2.5-flash" } });
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const created: any = await upsertFn({
        data: {
          category_id: genCategoria || null,
          name: parsed.nome_sugerido || "Novo perfil gerado por IA",
          difficulty: "medio",
          personality: parsed.personality || "",
          objectives: parsed.objectives || "",
          objections: parsed.objections || "",
          behaviors: parsed.behaviors || "",
        },
      });

      qc.invalidateQueries({ queryKey: ["client_profiles"] });
      setGenOpen(false);
      setGenDescricao("");
      setForm({ ...created, category_id: created.category_id ?? "" });
      setOpen(true);
      toast.success("Perfil gerado! Confira os campos, ajuste o que quiser, adicione os dados fictícios e depois gere a Jornada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar perfil com IA.");
    } finally {
      setGenerating(false);
    }
  };

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
const openEdit = (p: any) => { setForm({ ...p, category_id: p.category_id ?? "", dependentes: p.dependentes ?? [] }); setOpen(true); };
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const selectedCategory = categories.find(c => c.id === form.category_id);
  const isCadastroExistente = !!selectedCategory && selectedCategory.slug !== "filiacao";

  const addDependente = () => setForm((f: any) => ({ ...f, dependentes: [...(f.dependentes ?? []), { nome: "", cpf: "", nascimento: "", situacao: "ativo" }] }));
  const updateDependente = (idx: number, key: string, value: string) =>
    setForm((f: any) => ({ ...f, dependentes: (f.dependentes ?? []).map((d: any, i: number) => (i === idx ? { ...d, [key]: value } : d)) }));
  const removeDependente = (idx: number) =>
    setForm((f: any) => ({ ...f, dependentes: (f.dependentes ?? []).filter((_: any, i: number) => i !== idx) }));

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenOpen(true)} className="gap-2"><Sparkles className="h-4 w-4" /> Gerar perfil com IA</Button>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Perfil</Button>
        </div>
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

              {isCadastroExistente && (
                <div className="space-y-3 pt-2 border-t">
                  <div>
                    <p className="text-sm font-medium">Cadastro existente (Refiliação/Migração/EDT)</p>
                    <p className="text-xs text-muted-foreground">
                      Esse cliente já tem cadastro na empresa. A IA vai usar esses dados pra <strong>confirmar</strong> o que o atendente disser — e corrigir quando estiver errado, em vez de simplesmente concordar com tudo.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Telefone</Label>
                      <Input value={form.cliente_telefone ?? ""} onChange={e => set("cliente_telefone", e.target.value)} placeholder="Ex: (31) 99999-0000" />
                    </div>
                    <div>
                      <Label>CEP</Label>
                      <Input value={form.endereco_cep ?? ""} onChange={e => set("endereco_cep", e.target.value)} placeholder="Ex: 33800-000" />
                    </div>
                    <div>
                      <Label>Rua</Label>
                      <Input value={form.endereco_rua ?? ""} onChange={e => set("endereco_rua", e.target.value)} placeholder="Ex: Rua José Pedro Pereira" />
                    </div>
                    <div>
                      <Label>Número</Label>
                      <Input value={form.endereco_numero ?? ""} onChange={e => set("endereco_numero", e.target.value)} placeholder="Ex: 206" />
                    </div>
                    <div>
                      <Label>Complemento</Label>
                      <Input value={form.endereco_complemento ?? ""} onChange={e => set("endereco_complemento", e.target.value)} placeholder="Ex: Apto 101" />
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      <Input value={form.endereco_bairro ?? ""} onChange={e => set("endereco_bairro", e.target.value)} placeholder="Ex: São Pedro" />
                    </div>
                    <div>
                      <Label>Cidade</Label>
                      <Input value={form.endereco_cidade ?? ""} onChange={e => set("endereco_cidade", e.target.value)} placeholder="Ex: Ribeirão das Neves" />
                    </div>
                    <div>
                      <Label>Estado</Label>
                      <Input value={form.endereco_estado ?? ""} onChange={e => set("endereco_estado", e.target.value)} placeholder="Ex: MG" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Dependentes cadastrados</Label>
                      <Button type="button" size="sm" variant="outline" onClick={addDependente}>+ Adicionar dependente</Button>
                    </div>
                    {(form.dependentes ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhum dependente cadastrado neste perfil.</p>
                    )}
                    {(form.dependentes ?? []).map((d: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end border rounded-md p-2">
                        <div><Label className="text-xs">Nome</Label><Input value={d.nome ?? ""} onChange={e => updateDependente(idx, "nome", e.target.value)} placeholder="Nome" /></div>
                        <div><Label className="text-xs">CPF</Label><Input value={d.cpf ?? ""} onChange={e => updateDependente(idx, "cpf", e.target.value)} placeholder="CPF" /></div>
                        <div><Label className="text-xs">Nascimento</Label><Input value={d.nascimento ?? ""} onChange={e => updateDependente(idx, "nascimento", e.target.value)} placeholder="dd/mm/aaaa" /></div>
                        <div><Label className="text-xs">Situação</Label><Input value={d.situacao ?? ""} onChange={e => updateDependente(idx, "situacao", e.target.value)} placeholder="ativo" /></div>
                        <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeDependente(idx)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="jornada" className="pt-4">
              {form.id ? (
                <ClientProfileStatesEditor
                  profileId={form.id}
                  profileNome={form.cliente_nome}
                  profileCpf={form.cliente_cpf}
                  profileTitulo={form.name}
                  profilePersonality={form.personality}
                  profileObjectives={form.objectives}
                  profileObjections={form.objections}
                  profileBehaviors={form.behaviors}
                  profileDifficulty={form.difficulty}
                />
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

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar perfil com IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subcategoria</Label>
              <Select value={genCategoria || "none"} onValueChange={v => setGenCategoria(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="— Sem subcategoria —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem subcategoria —</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                A IA usa o padrão real de atendimentos analisados dessa subcategoria (quando disponível) para gerar um perfil coerente.
              </p>
            </div>
            <div>
              <Label>Breve descrição deste cliente</Label>
              <Textarea rows={3} value={genDescricao} onChange={e => setGenDescricao(e.target.value)}
                placeholder='Ex: "Cliente mais curioso, faz muitas perguntas antes de decidir"' />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancelar</Button>
            <Button onClick={generateProfile} disabled={generating}>
              {generating ? "Gerando..." : "Gerar perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
