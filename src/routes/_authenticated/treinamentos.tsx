import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listTrainingModules } from "@/lib/training.functions";
import { listQuizzesForTaking, submitQuizAttempt } from "@/lib/quiz.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, ClipboardList, Check, X, Loader2 } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/treinamentos")({
  // ?busca=<tema>: abre a página já com o tema na busca (vem do Mapa da equipe, no Admin).
  validateSearch: (s: Record<string, unknown>): { busca?: string } => ({
    busca: typeof s.busca === "string" && s.busca.trim() ? s.busca.trim().slice(0, 80) : undefined,
  }),
  component: Page,
});

const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface ModuleRow {
  id: string; titulo: string; descricao: string | null; pdf_path: string | null; pdf_name: string | null; pdf_url: string | null;
  images: { image: { id: string; title: string; image_path: string; image_url: string } | null }[];
}
interface QuestionRow { id: string; tipo: "multipla_escolha" | "aberta"; pergunta: string; position?: number | null; options: { id: string; texto: string }[]; }
interface QuizRow { id: string; titulo: string; training_module_id: string | null; questions: QuestionRow[]; }

// O visualizador de PDF embutido do Chrome tem um bug conhecido de ficar com a
// tela preta depois que a aba do navegador fica em segundo plano e volta. Forçamos
// o PDF a recarregar nesse momento específico pra contornar isso.
function useReloadKeyOnTabReturn() {
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") setReloadKey((k) => k + 1); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return reloadKey;
}

function Page() {
  const modFn = useServerFn(listTrainingModules);
  const pdfReloadKey = useReloadKeyOnTabReturn();
  const quizFn = useServerFn(listQuizzesForTaking);
  const modQ = useQuery({ queryKey: ["training-modules"], queryFn: () => modFn({}), refetchOnWindowFocus: false, staleTime: 10 * 60 * 1000 });
  const quizQ = useQuery({ queryKey: ["quizzes-taking"], queryFn: () => quizFn({}) });

  const modules = (modQ.data ?? []) as ModuleRow[];
  const quizzes = (quizQ.data ?? []) as QuizRow[];
  const [activeQuiz, setActiveQuiz] = useState<QuizRow | null>(null);
  const { busca: buscaInicial } = Route.useSearch();
  const [busca, setBusca] = useState(buscaInicial ?? "");
  useEffect(() => { setBusca(buscaInicial ?? ""); }, [buscaInicial]);
  const termo = norm(busca.trim());
  const visiveis = modules
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => !termo || norm(`${m.titulo} ${m.descricao ?? ""}`).includes(termo));

  const quizForModule = (moduleId: string) => quizzes.find((q) => q.training_module_id === moduleId);
  const quizzesAvulsos = quizzes.filter((q) => !q.training_module_id);

  const loading = modQ.isLoading || quizQ.isLoading;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-5 lg:px-8 lg:py-7">
      <header className="mb-5">
        <h1 className="text-2xl font-medium">Treinamentos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Currículo de treinamento e simulados da equipe.</p>
      </header>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar treinamento…"
        aria-label="Buscar treinamento"
        data-tour="treinamentos-1"
        className="mb-5 h-10 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-gold"
      />

      {loading && <div className="grid gap-4 sm:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>}
      {!loading && modules.length === 0 && (
        <Card className="p-10 text-center"><p className="text-muted-foreground">Nenhum módulo de treinamento cadastrado ainda.</p></Card>
      )}

      {!loading && modules.length > 0 && visiveis.length === 0 && (
        <Card className="p-8 text-center"><p className="text-muted-foreground">Nenhum treinamento com "{busca.trim()}". Limpe a busca para ver todos.</p></Card>
      )}

      <div className="space-y-5">
        {visiveis.map(({ m, idx }, pos) => {
          const quiz = quizForModule(m.id);
          const primeiroComSimulado = quiz && visiveis.findIndex((v) => quizForModule(v.m.id)) === pos;
          return (
            <Card key={m.id} data-tour={pos === 0 ? "treinamentos-2" : undefined} className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-gold-text text-sm font-semibold shrink-0">{idx + 1}</span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg">{m.titulo}</h2>
                  {m.descricao && <p className="text-sm text-muted-foreground mt-0.5">{m.descricao}</p>}
                </div>
              </div>

              {m.pdf_url && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {m.pdf_name || "Material do módulo"}</span>
                    <a href={m.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gold-text hover:underline">Abrir em nova aba</a>
                  </div>
                  <iframe
                    key={`${m.id}-${pdfReloadKey}`}
                    src={`${m.pdf_url}#toolbar=0&navpanes=0&view=FitH`}
                    title={m.pdf_name ?? m.titulo}
                    className="w-full h-[75vh] min-h-[560px] rounded-md border border-border"
                  />
                </div>
              )}

              {(m.images ?? []).filter((l) => l.image).length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                  {m.images.filter((l) => l.image).map((l) => (
                    <div key={l.image!.id} className="shrink-0 w-28 text-center">
                      <img src={l.image!.image_url} alt={l.image!.title} className="w-28 h-20 object-cover rounded-md border border-border" />
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">{l.image!.title}</p>
                    </div>
                  ))}
                </div>
              )}

              {quiz && (
                <Button size="sm" className="gap-2" data-tour={primeiroComSimulado ? "treinamentos-3" : undefined} onClick={() => setActiveQuiz(quiz)}>
                  <ClipboardList className="h-4 w-4" /> Fazer simulado
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {quizzesAvulsos.length > 0 && (
        <div data-tour="treinamentos-4" className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Outros simulados</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {quizzesAvulsos.map((quiz) => (
              <Card key={quiz.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{quiz.titulo}</p>
                  <p className="text-xs text-muted-foreground">{quiz.questions?.length ?? 0} pergunta(s)</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setActiveQuiz(quiz)}>
                  <ClipboardList className="h-4 w-4" /> Fazer
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!activeQuiz} onOpenChange={(v) => !v && setActiveQuiz(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {activeQuiz && <QuizRunner quiz={activeQuiz} onClose={() => setActiveQuiz(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuizRunner({ quiz, onClose }: { quiz: QuizRow; onClose: () => void }) {
  const submitFn = useServerFn(submitQuizAttempt);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<null | { score: number; total_questions: number; respostas: { question_id: string; correta: boolean; feedback?: string }[] }>(null);

  const questions = (quiz.questions ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const allAnswered = questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  const submitMut = useMutation({
    mutationFn: () => submitFn({ data: { quiz_id: quiz.id, respostas: Object.entries(answers).map(([question_id, resposta_dada]) => ({ question_id, resposta_dada })) } }),
    onSuccess: (data) => setResult(data as any),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar o simulado."),
  });

  if (result) {
    const pct = result.total_questions > 0 ? Math.round((result.score / result.total_questions) * 100) : 0;
    return (
      <div className="space-y-4">
        <DialogHeader><DialogTitle>Resultado — {quiz.titulo}</DialogTitle></DialogHeader>
        <div className="text-center">
          <p className={`text-4xl font-bold ${pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-yellow-600" : "text-red-600"}`}>{result.score}/{result.total_questions}</p>
          <p className="text-sm text-muted-foreground mt-1">{pct}% de acerto</p>
        </div>
        <div className="space-y-2">
          {questions.map((q) => {
            const r = result.respostas.find((x) => x.question_id === q.id);
            return (
              <div key={q.id} className="p-3 rounded-md border border-border flex items-start gap-2">
                {r?.correta ? <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> : <X className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
                <div>
                  <p className="text-sm font-medium">{q.pergunta}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Sua resposta: {answers[q.id]}</p>
                  {r?.feedback && <p className="text-xs text-muted-foreground mt-1 italic">{r.feedback}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <Button className="w-full" onClick={onClose}>Fechar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DialogHeader><DialogTitle>{quiz.titulo}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id}>
            <p className="text-sm font-medium mb-2">{idx + 1}. {q.pergunta}</p>
            {q.tipo === "multipla_escolha" ? (
              <div className="space-y-1.5">
                {q.options.map((opt) => (
                  <label key={opt.id} className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer text-sm ${answers[q.id] === opt.id ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name={q.id} checked={answers[q.id] === opt.id} onChange={() => setAnswers({ ...answers, [q.id]: opt.id })} />
                    {opt.texto}
                  </label>
                ))}
              </div>
            ) : (
              <Textarea rows={2} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder="Digite sua resposta..." />
            )}
          </div>
        ))}
      </div>
      <Button className="w-full gap-2" disabled={!allAnswered || submitMut.isPending} onClick={() => submitMut.mutate()}>
        {submitMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Corrigindo...</> : "Enviar respostas"}
      </Button>
    </div>
  );
}
