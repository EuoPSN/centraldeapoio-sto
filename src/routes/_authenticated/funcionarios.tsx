import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMetas, upsertMeta, deleteMeta } from "@/lib/metas.functions";
import { getAllUsers } from "@/lib/relatorio-prospeccao.functions";
import { gerarAnaliseIA, salvarClassificacao } from "@/lib/painel.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Brain, Loader2, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  component: Page,
});

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const PERFIS = ["Técnico","Comercial","Investigativo","Empático","Rápido","Detalhista"];
const NIVEIS = ["P1","P2","P3","P4"];
const NIVEL_DESC: Record<string, string> = {
  P1: "Baixa competência / Alto entusiasmo",
  P2: "Competência em desenvolvimento / Baixo entusiasmo",
  P3: "Alta competência / Comprometimento variável",
  P4: "Alta competência / Alto comprometimento",
};

const PERFIL_DESC: Record<string, string> = {
  "Técnico": "Domina processos e regras do produto. Responde com precisão.",
  "Comercial": "Foco em resultados, argumenta bem e contorna objeções.",
  "Investigativo": "Faz perguntas para entender o cliente antes de oferecer solução.",
  "Empático": "Conexão emocional, escuta ativa e linguagem acolhedora.",
  "Rápido": "Resolve com agilidade, direto ao ponto, sem enrolação.",
  "Detalhista": "Explica cada etapa com cuidado, muito preciso.",
};
const NIVEL_COR: Record<string, string> = {
  P1: "bg-red-100 text-red-700 border-red-200",
  P2: "bg-yellow-100 text-yellow-700 border-yellow-200",
  P3: "bg-blue-100 text-blue-700 border-blue-200",
  P4: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function mesAtual() { const d = new Date(); return `${MESES[d.getMonth()]}/${d.getFullYear()}`; }
function inicioMes() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function hoje() { return new Date().toISOString().slice(0, 10); }
const EMPTY_META = { nome: "", mes_referencia: mesAtual(), meta_mensal: 0, dias_uteis: 22 };

function ProgressBar({ valor, meta }: { valor: number; meta: number }) {
  const pct = meta > 0 ? Math.min(Math.round((valor / meta) * 100), 100) : 0;
  const cor = pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{valor} de {meta}</span>
        <span className={`font-semibold ${pct >= 100 ? "text-emerald-600" : pct >= 60 ? "text-yellow-600" : "text-red-500"}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Page() {
  const listFn = useServerFn(listMetas);
  const upsertFn = useServerFn(upsertMeta);
  const deleteFn = useServerFn(deleteMeta);
  const getUsersFn = useServerFn(getAllUsers);
  const gerarFn = useServerFn(gerarAnaliseIA);
  const salvarFn = useServerFn(salvarClassificacao);
  const qc = useQueryClient();

  const [openMeta, setOpenMeta] = useState(false);
  const [formMeta, setFormMeta] = useState<any>({ ...EMPTY_META });
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [analise, setAnalise] = useState<any>(null);
  const [perfisEdit, setPerfisEdit] = useState<string[]>([]);
  const [nivelEdit, setNivelEdit] = useState<string>("");
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const metasQ = useQuery({ queryKey: ["metas"], queryFn: () => listFn() });
  const usersQ = useQuery({ queryKey: ["all-users"], queryFn: () => getUsersFn() });

  const metas = (metasQ.data ?? []) as any[];
  const users = (usersQ.data ?? []) as any[];

  const upsertMut = useMutation({
    mutationFn: (d: any) => upsertFn({ data: d }),
    onSuccess: () => { toast.success("Meta salva!"); qc.invalidateQueries({ queryKey: ["metas"] }); setOpenMeta(false); setFormMeta({ ...EMPTY_META }); },
    onError: () => toast.error("Erro ao salvar meta."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["metas"] }); },
    onError: () => toast.error("Erro ao remover."),
  });

  const setM = (k: string, v: any) => setFormMeta((f: any) => ({ ...f, [k]: v }));

  const abrirPerfil = (u: any) => {
    setSelectedUser(u);
    setAnalise(null);
    setPerfisEdit(u.perfis_maturidade ?? []);
    setNivelEdit(u.nivel_lideranca ?? "");
  };

  const gerarAnalise = async () => {
    if (!selectedUser) return;
    setGerando(true);
    try {
      const result = await gerarFn({ data: { userId: selectedUser.id, nomeUsuario: selectedUser.display_name ?? selectedUser.email } });
      setAnalise(result);
      if (result.sugestao_perfis?.length) setPerfisEdit(result.sugestao_perfis);
      if (result.sugestao_nivel) setNivelEdit(result.sugestao_nivel);
    } catch { toast.error("Erro ao gerar análise."); }
    setGerando(false);
  };

  const salvarClassif = async () => {
    if (!selectedUser) return;
    setSalvando(true);
    try {
      await salvarFn({ data: { userId: selectedUser.id, perfis_maturidade: perfisEdit, nivel_lideranca: nivelEdit || null, recomendacoes: analise?.recomendacoes ?? "" } });
      toast.success("Classificação salva!");
      qc.invalidateQueries({ queryKey: ["all-users"] });
      setSelectedUser((u: any) => ({ ...u, perfis_maturidade: perfisEdit, nivel_lideranca: nivelEdit }));
    } catch { toast.error("Erro ao salvar classificação."); }
    setSalvando(false);
  };

  const togglePerfil = (p: string) => setPerfisEdit((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const metaDiaria = (m: any) => m.dias_uteis > 0 ? Number((m.meta_mensal / m.dias_uteis).toFixed(1)) : 0;
  const metaSemanal = (m: any) => m.dias_uteis > 0 ? Number((m.meta_mensal / m.dias_uteis * 5).toFixed(1)) : 0;

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Painel Inteligente de Funcionários
          </h1>
          <p className="text-muted-foreground text-sm">Metas, maturidade e desenvolvimento individual.</p>
        </div>
        <Button onClick={() => { setFormMeta({ ...EMPTY_META }); setOpenMeta(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Meta
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Metas do mês</h2>
          {metas.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">Nenhuma meta cadastrada.</Card>}
          {metas.map((m) => (
            <Card key={m.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-semibold">{m.nome}</h3><p className="text-xs text-muted-foreground">{m.mes_referencia}</p></div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setFormMeta({ ...m }); setOpenMeta(true); }}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(m.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
              <ProgressBar valor={0} meta={m.meta_mensal} />
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-muted/40 rounded p-2"><p className="font-semibold text-base">{m.meta_mensal}</p><p className="text-muted-foreground">Meta mês</p></div>
                <div className="bg-muted/40 rounded p-2"><p className="font-semibold text-base">{metaDiaria(m)}</p><p className="text-muted-foreground">Meta/dia</p></div>
                <div className="bg-muted/40 rounded p-2"><p className="font-semibold text-base">{metaSemanal(m)}</p><p className="text-muted-foreground">Meta/sem</p></div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Perfis da equipe</h2>
          {users.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum funcionário cadastrado.</Card>}
          {users.map((u: any) => (
            <Card key={u.id} className="p-4 cursor-pointer hover:border-primary/40 transition"
              onClick={() => abrirPerfil(u)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.display_name ?? u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.cargo ?? "Sem cargo"}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {u.nivel_lideranca && <Badge className={`text-xs ${NIVEL_COR[u.nivel_lideranca]}`}>{u.nivel_lideranca}</Badge>}
                  {(u.perfis_maturidade ?? []).slice(0, 2).map((p: string) => (
                    <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                  ))}
                  {(u.perfis_maturidade ?? []).length > 2 && <Badge variant="outline" className="text-xs">+{u.perfis_maturidade.length - 2}</Badge>}
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {selectedUser && (
        <Card className="p-5 border-primary/30 bg-primary/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Análise — {selectedUser.display_name ?? selectedUser.email}
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={gerarAnalise} disabled={gerando} className="gap-2">
                {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {gerando ? "Analisando..." : "Gerar análise IA"}
              </Button>
              <Button size="sm" onClick={salvarClassif} disabled={salvando} className="gap-2">
                {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salvar classificação
              </Button>
            </div>
          </div>

          {analise?.analise && (
            <div className="bg-background rounded-lg p-4 border">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Análise da IA</p>
              <p className="text-sm">{analise.analise}</p>
              {analise?.justificativa_perfis && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Por que esses perfis</p>
                  <p className="text-sm text-muted-foreground">{analise.justificativa_perfis}</p>
                </div>
              )}
              {analise?.justificativa_nivel && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Por que esse nível ({analise.sugestao_nivel})</p>
                  <p className="text-sm text-muted-foreground">{analise.justificativa_nivel}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Perfis de maturidade</p>
              <div className="flex flex-wrap gap-2">
                {PERFIS.map((p) => (
                  <div key={p} className="flex flex-col gap-1">
                    <button onClick={() => togglePerfil(p)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition text-left ${perfisEdit.includes(p) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}>
                      <span className="font-semibold block">{p}</span>
                      <span className={`text-[10px] leading-tight ${perfisEdit.includes(p) ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {PERFIL_DESC[p]}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Nível de liderança situacional</p>
              <div className="space-y-2">
                {NIVEIS.map((n) => (
                  <button key={n} onClick={() => setNivelEdit(nivelEdit === n ? "" : n)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${nivelEdit === n ? `${NIVEL_COR[n]} border-current` : "bg-background border-border hover:border-primary/50"}`}>
                    <span className="font-semibold">{n}</span> — {NIVEL_DESC[n]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {analise?.recomendacoes && (
            <div className="bg-background rounded-lg p-4 border">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Recomendações de desenvolvimento</p>
              <ul className="space-y-1">
                {analise.recomendacoes.split(";").filter((r: string) => r.trim()).map((r: string, i: number) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-primary font-bold flex-shrink-0">•</span>
                    {r.trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Dialog open={openMeta} onOpenChange={setOpenMeta}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{formMeta.id ? "Editar Meta" : "Nova Meta"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome do funcionário</Label><Input value={formMeta.nome} onChange={(e) => setM("nome", e.target.value)} placeholder="Nome exato como aparece nos relatórios" /></div>
            <div><Label>Mês de referência</Label><Input value={formMeta.mes_referencia} onChange={(e) => setM("mes_referencia", e.target.value)} placeholder="Ex: Julho/2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Meta mensal (vendas)</Label><Input type="number" min={0} value={formMeta.meta_mensal} onChange={(e) => setM("meta_mensal", Number(e.target.value))} /></div>
              <div><Label>Dias úteis no mês</Label><Input type="number" min={1} max={31} value={formMeta.dias_uteis} onChange={(e) => setM("dias_uteis", Number(e.target.value))} /></div>
            </div>
            {formMeta.meta_mensal > 0 && formMeta.dias_uteis > 0 && (
              <div className="bg-muted/40 rounded p-3 grid grid-cols-2 gap-2 text-center text-sm">
                <div><p className="font-semibold">{(formMeta.meta_mensal / formMeta.dias_uteis).toFixed(1)}</p><p className="text-xs text-muted-foreground">Meta diária</p></div>
                <div><p className="font-semibold">{(formMeta.meta_mensal / formMeta.dias_uteis * 5).toFixed(1)}</p><p className="text-xs text-muted-foreground">Meta semanal</p></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMeta(false)}>Cancelar</Button>
            <Button onClick={() => upsertMut.mutate(formMeta)} disabled={!formMeta.nome || upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
