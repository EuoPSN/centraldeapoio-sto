import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listTrainingModules, upsertTrainingModule, deleteTrainingModule, setTrainingModuleImages } from "@/lib/training.functions";
import { listQuizzes, upsertQuiz, deleteQuiz, upsertQuizQuestion, deleteQuizQuestion, upsertQuizOption, deleteQuizOption, listQuizAttempts } from "@/lib/quiz.functions";
import { listImageLibrary } from "@/lib/imagelibrary.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2, ArrowUp, ArrowDown, Loader2, FileText, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { toast } from "sonner";

export function TreinamentosTab() {
  return (
    <Tabs defaultValue="curriculo">
      <TabsList>
        <TabsTrigger value="curriculo">Currículo</TabsTrigger>
        <TabsTrigger value="simulados">Simulados</TabsTrigger>
        <TabsTrigger value="resultados">Resultados</TabsTrigger>
      </TabsList>
      <TabsContent value="curriculo" className="mt-4"><CurriculoSubTab /></TabsContent>
      <TabsContent value="simulados" className="mt-4"><SimuladosSubTab /></TabsContent>
      <TabsContent value="resultados" className="mt-4"><ResultadosSubTab /></TabsContent>
    </Tabs>
  );
}

// ============================================================
// Currículo (módulos: título, descrição, PDF, imagens)
// ============================================================
interface ModuleRow {
  id: string; titulo: string; descricao: string | null; pdf_path: string | null; pdf_name: string | null;
  pdf_url: string | null; position: number;
  images: { position: number; image: { id: string; title: string; image_path: string } | null }[];
}
interface ImageItem { id: string; title: string; image_url: string; }

function CurriculoSubTab() {
  const list = useServerFn(listTrainingModules);
  const upsert = useServerFn(upsertTrainingModule);
  const del = useServerFn(deleteTrainingModule);
  const setImagesFn = useServerFn(setTrainingModuleImages);
  const imgListFn = useServerFn(listImageLibrary);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["training-modules"], queryFn: () => list({}) });
  const imgQ = useQuery({ queryKey: ["image-library"], queryFn: () => imgListFn({}) });
  const modules = (q.data ?? []) as ModuleRow[];
  const images = (imgQ.data ?? []) as ImageItem[];

  const [edit, setEdit] = useState<null | { id?: string; titulo: string; descricao: string; pdf_path: string; pdf_name: string; imageIds: string[] }>(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadPdf = async (file: File) => {
    if (!edit) return;
    if (file.type !== "application/pdf") { toast.error("Envie um arquivo PDF."); return; }
    if (file.size > 30 * 1024 * 1024) { toast.error("PDF excede 30MB."); return; }
    setUploading(true);
    try {
      const path = `treinamento/${crypto.randomUUID()}.pdf`;
      const { error } = await supabase.storage.from("knowledge-files").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setEdit({ ...edit, pdf_path: path, pdf_name: file.name });
      toast.success("PDF enviado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload.");
    } finally {
      setUploading(false);
    }
  };

  const upsertMut = useMutation({
    mutationFn: async () => {
      const saved = await upsert({ data: {
        id: edit!.id, titulo: edit!.titulo, descricao: edit!.descricao || null,
        pdf_path: edit!.pdf_path || null, pdf_name: edit!.pdf_name || null, position: 0,
      } });
      const moduleId = edit!.id ?? saved.id;
      await setImagesFn({ data: { training_module_id: moduleId, image_library_item_ids: edit!.imageIds } });
    },
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["training-modules"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["training-modules"] }); },
  });

  const openEdit = (m: ModuleRow) => {
    const ids = (m.images ?? []).filter((l) => l.image).map((l) => l.image!.id);
    setEdit({ id: m.id, titulo: m.titulo, descricao: m.descricao ?? "", pdf_path: m.pdf_path ?? "", pdf_name: m.pdf_name ?? "", imageIds: ids });
  };

  const moveModule = async (idx: number, dir: -1 | 1) => {
    const arr = [...modules];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await Promise.all(arr.map((m, i) => upsert({ data: { id: m.id, titulo: m.titulo, descricao: m.descricao, pdf_path: m.pdf_path, pdf_name: m.pdf_name, position: i * 10 } })));
    qc.invalidateQueries({ queryKey: ["training-modules"] });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Módulos do currículo ({modules.length})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ titulo: "", descricao: "", pdf_path: "", pdf_name: "", imageIds: [] })}>
          <Plus className="h-4 w-4" /> Novo módulo
        </Button>
      </div>
      <div className="divide-y divide-border">
        {modules.map((m, idx) => (
          <div key={m.id} className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{m.titulo}</h4>
                {m.pdf_name && <Badge variant="outline" className="gap-1 text-xs"><FileText className="h-3 w-3" /> {m.pdf_name}</Badge>}
              </div>
              {m.descricao && <p className="text-sm text-muted-foreground mt-0.5">{m.descricao}</p>}
              {(m.images ?? []).length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{m.images.length} imagem(ns) vinculada(s)</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => moveModule(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === modules.length - 1} onClick={() => moveModule(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => confirm("Excluir este módulo?") && delMut.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {modules.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum módulo cadastrado ainda.</p>}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar módulo" : "Novo módulo"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea rows={3} value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></div>
              <div>
                <Label>PDF do módulo</Label>
                {edit.pdf_name ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded border border-border mt-1">
                    <span className="text-sm flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" /> {edit.pdf_name}</span>
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, pdf_path: "", pdf_name: "" })}>Remover</Button>
                  </div>
                ) : (
                  <div className="mt-1">
                    <input type="file" accept="application/pdf" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && handleUploadPdf(e.target.files[0])} />
                    {uploading && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</p>}
                  </div>
                )}
              </div>
              <div>
                <Label>Imagens da Biblioteca vinculadas</Label>
                {images.length === 0 && <p className="text-xs text-muted-foreground mt-1">Nenhuma imagem cadastrada na Biblioteca ainda.</p>}
                <div className="grid grid-cols-4 gap-2 mt-1 max-h-48 overflow-y-auto">
                  {images.map((img) => {
                    const selected = edit.imageIds.includes(img.id);
                    return (
                      <button key={img.id} type="button"
                        onClick={() => setEdit({ ...edit, imageIds: selected ? edit.imageIds.filter((id) => id !== img.id) : [...edit.imageIds, img.id] })}
                        className={`relative rounded overflow-hidden border-2 ${selected ? "border-primary" : "border-transparent"}`}>
                        <img src={img.image_url} alt={img.title} className="h-16 w-full object-cover" />
                        {selected && <span className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full p-0.5"><Check className="h-3 w-3" /></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending || !edit?.titulo.trim()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// Simulados (quiz)
// ============================================================
interface OptionRow { id: string; texto: string; is_correct: boolean; position: number; }
interface QuestionRow { id: string; tipo: "multipla_escolha" | "aberta"; pergunta: string; resposta_esperada: string | null; position: number; options: OptionRow[]; }
interface QuizRow { id: string; titulo: string; training_module_id: string | null; training_module: { id: string; titulo: string } | null; questions: QuestionRow[]; }

function SimuladosSubTab() {
  const list = useServerFn(listQuizzes);
  const upsert = useServerFn(upsertQuiz);
  const del = useServerFn(deleteQuiz);
  const modulesFn = useServerFn(listTrainingModules);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["quizzes"], queryFn: () => list({}) });
  const modulesQ = useQuery({ queryKey: ["training-modules"], queryFn: () => modulesFn({}) });
  const quizzes = (q.data ?? []) as QuizRow[];
  const modules = (modulesQ.data ?? []) as ModuleRow[];

  const [edit, setEdit] = useState<null | { id?: string; titulo: string; training_module_id: string }>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const upsertMut = useMutation({
    mutationFn: () => upsert({ data: { id: edit!.id, titulo: edit!.titulo, training_module_id: edit!.training_module_id || null, position: 0 } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["quizzes"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["quizzes"] }); },
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold">Simulados ({quizzes.length})</h3>
        <Button size="sm" className="gap-2" onClick={() => setEdit({ titulo: "", training_module_id: "" })}>
          <Plus className="h-4 w-4" /> Novo simulado
        </Button>
      </div>
      <div className="divide-y divide-border">
        {quizzes.map((quiz) => (
          <div key={quiz.id}>
            <div className="p-4 flex items-center justify-between gap-3">
              <button className="flex items-center gap-2 text-left flex-1 min-w-0" onClick={() => setExpanded(expanded === quiz.id ? null : quiz.id)}>
                {expanded === quiz.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium">{quiz.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {quiz.training_module ? `Módulo: ${quiz.training_module.titulo} · ` : ""}{quiz.questions?.length ?? 0} pergunta(s)
                  </p>
                </div>
              </button>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => setEdit({ id: quiz.id, titulo: quiz.titulo, training_module_id: quiz.training_module_id ?? "" })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Excluir este simulado?") && delMut.mutate(quiz.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            {expanded === quiz.id && <QuizEditor quiz={quiz} />}
          </div>
        ))}
        {quizzes.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum simulado cadastrado ainda.</p>}
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar simulado" : "Novo simulado"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></div>
              <div>
                <Label>Vincular a um módulo (opcional)</Label>
                <Select value={edit.training_module_id || "none"} onValueChange={(v) => setEdit({ ...edit, training_module_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.titulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending || !edit?.titulo.trim()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function QuizEditor({ quiz }: { quiz: QuizRow }) {
  const upsertQ = useServerFn(upsertQuizQuestion);
  const delQ = useServerFn(deleteQuizQuestion);
  const upsertO = useServerFn(upsertQuizOption);
  const delO = useServerFn(deleteQuizOption);
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["quizzes"] });

  const addQuestion = async (tipo: "multipla_escolha" | "aberta") => {
    await upsertQ({ data: { quiz_id: quiz.id, tipo, pergunta: "Nova pergunta", position: (quiz.questions?.length ?? 0) * 10 } });
    invalidate();
  };

  const questions = (quiz.questions ?? []).slice().sort((a, b) => a.position - b.position);

  return (
    <div className="px-4 pb-4 space-y-3 bg-muted/20">
      {questions.map((question) => (
        <Card key={question.id} className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{question.tipo === "aberta" ? "Aberta" : "Múltipla escolha"}</Badge>
              </div>
              <Input
                defaultValue={question.pergunta}
                className="font-medium"
                onBlur={(e) => { if (e.target.value.trim() && e.target.value !== question.pergunta) { upsertQ({ data: { id: question.id, quiz_id: quiz.id, tipo: question.tipo, pergunta: e.target.value, resposta_esperada: question.resposta_esperada, position: question.position } }).then(invalidate); } }}
              />
            </div>
            <Button size="icon" variant="ghost" onClick={() => confirm("Excluir esta pergunta?") && delQ({ data: { id: question.id } }).then(invalidate)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          {question.tipo === "aberta" ? (
            <div>
              <Label className="text-xs">Resposta esperada (a IA compara com o que o atendente digitar)</Label>
              <Textarea rows={2} defaultValue={question.resposta_esperada ?? ""}
                onBlur={(e) => upsertQ({ data: { id: question.id, quiz_id: quiz.id, tipo: question.tipo, pergunta: question.pergunta, resposta_esperada: e.target.value, position: question.position } }).then(invalidate)} />
            </div>
          ) : (
            <div className="space-y-1.5 pl-2">
              {(question.options ?? []).slice().sort((a, b) => a.position - b.position).map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <button type="button" title="Marcar como correta"
                    onClick={() => upsertO({ data: { id: opt.id, question_id: question.id, texto: opt.texto, is_correct: !opt.is_correct, position: opt.position } }).then(invalidate)}
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${opt.is_correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"}`}>
                    {opt.is_correct && <Check className="h-3 w-3" />}
                  </button>
                  <Input defaultValue={opt.texto} className="h-8 text-sm"
                    onBlur={(e) => { if (e.target.value.trim() && e.target.value !== opt.texto) upsertO({ data: { id: opt.id, question_id: question.id, texto: e.target.value, is_correct: opt.is_correct, position: opt.position } }).then(invalidate); }} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => delO({ data: { id: opt.id } }).then(invalidate)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" className="gap-1 text-xs h-7"
                onClick={() => upsertO({ data: { question_id: question.id, texto: "Nova alternativa", is_correct: false, position: (question.options?.length ?? 0) * 10 } }).then(invalidate)}>
                <Plus className="h-3 w-3" /> Adicionar alternativa
              </Button>
            </div>
          )}
        </Card>
      ))}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => addQuestion("multipla_escolha")}><Plus className="h-4 w-4" /> Pergunta de múltipla escolha</Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => addQuestion("aberta")}><Plus className="h-4 w-4" /> Pergunta aberta</Button>
      </div>
    </div>
  );
}

// ============================================================
// Resultados (quem fez, qual nota — sem ligação com Funcionários/P1-P4)
// ============================================================
interface AttemptRow { id: string; user_id: string; score: number; total_questions: number; completed_at: string; quiz: { titulo: string } | null; }

function ResultadosSubTab() {
  const fn = useServerFn(listQuizAttempts);
  const q = useQuery({ queryKey: ["quiz-attempts"], queryFn: () => fn({}) });
  const rows = (q.data ?? []) as AttemptRow[];

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">Resultados dos simulados ({rows.length})</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Só visibilidade — não alimenta nenhuma classificação automática.</p>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Simulado</TableHead><TableHead>Nota</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.quiz?.titulo ?? "—"}</TableCell>
              <TableCell>{r.score}/{r.total_questions}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{new Date(r.completed_at).toLocaleString("pt-BR")}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum simulado feito ainda.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}
