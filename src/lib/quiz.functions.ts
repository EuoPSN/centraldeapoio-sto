import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion } from "@/lib/ai-gateway.server";
import { z } from "zod";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

// ============ Quizzes ============
export const listQuizzes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("quizzes")
      .select(`*, training_module:training_modules(id,titulo),
        questions:quiz_questions(*, options:quiz_options(*))`)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const QuizInput = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(200),
  training_module_id: z.string().uuid().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuizInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("quizzes").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("quizzes").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("quizzes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Perguntas ============
const QuestionInput = z.object({
  id: z.string().uuid().optional(),
  quiz_id: z.string().uuid(),
  tipo: z.enum(["multipla_escolha", "aberta"]).default("multipla_escolha"),
  pergunta: z.string().min(1),
  resposta_esperada: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertQuizQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuestionInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("quiz_questions").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("quiz_questions").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteQuizQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("quiz_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Alternativas ============
const OptionInput = z.object({
  id: z.string().uuid().optional(),
  question_id: z.string().uuid(),
  texto: z.string().min(1),
  is_correct: z.boolean().default(false),
  position: z.number().int().default(0),
});

export const upsertQuizOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OptionInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("quiz_options").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("quiz_options").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteQuizOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("quiz_options").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Fazer o simulado (qualquer autenticado) ============
const AttemptInput = z.object({
  quiz_id: z.string().uuid(),
  respostas: z.array(z.object({
    question_id: z.string().uuid(),
    // Para múltipla escolha: id da alternativa escolhida. Para aberta: o texto digitado.
    resposta_dada: z.string(),
  })),
});

export const submitQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AttemptInput.parse(d))
  .handler(async ({ data, context }) => {
    // Busca as perguntas/alternativas direto do banco — nunca confia no que o cliente diz que é "certo".
    const { data: questions, error: qErr } = await context.supabase
      .from("quiz_questions")
      .select("*, options:quiz_options(*)")
      .eq("quiz_id", data.quiz_id);
    if (qErr) throw new Error(qErr.message);

    const resultados: { question_id: string; resposta_dada: string; correta: boolean; feedback?: string }[] = [];

    for (const resp of data.respostas) {
      const question = (questions ?? []).find((q: any) => q.id === resp.question_id);
      if (!question) continue;

      if (question.tipo === "multipla_escolha") {
        const opcao = (question.options ?? []).find((o: any) => o.id === resp.resposta_dada);
        resultados.push({ question_id: resp.question_id, resposta_dada: resp.resposta_dada, correta: !!opcao?.is_correct });
      } else {
        // Pergunta aberta: pede pra IA comparar a resposta digitada com a resposta esperada.
        try {
          const prompt = `Você corrige uma resposta de simulado de treinamento. Compare a RESPOSTA DO ATENDENTE com a RESPOSTA ESPERADA e diga se ela está correta, mesmo que use palavras diferentes (sinônimos, outra ordem, etc.) — o importante é o conteúdo bater, não o texto exato.

Pergunta: ${question.pergunta}
Resposta esperada: ${question.resposta_esperada ?? "(não definida)"}
Resposta do atendente: ${resp.resposta_dada}

Responda APENAS com um JSON no formato exato: {"correta": true ou false, "feedback": "uma frase curta explicando o motivo"}. Sem markdown, sem texto fora do JSON.`;
          const raw = await chatCompletion({ model: "google/gemini-2.5-flash", temperature: 0.2, messages: [{ role: "user", content: prompt }] });
          const clean = raw.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(clean);
          resultados.push({ question_id: resp.question_id, resposta_dada: resp.resposta_dada, correta: !!parsed.correta, feedback: parsed.feedback });
        } catch {
          resultados.push({ question_id: resp.question_id, resposta_dada: resp.resposta_dada, correta: false, feedback: "Não foi possível avaliar automaticamente esta resposta." });
        }
      }
    }

    const score = resultados.filter((r) => r.correta).length;
    const { data: attempt, error: insErr } = await context.supabase
      .from("quiz_attempts")
      .insert({
        quiz_id: data.quiz_id,
        user_id: context.userId,
        score,
        total_questions: resultados.length,
        respostas: resultados,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);
    return attempt;
  });

export const listQuizAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("quiz_attempts")
      .select("*, quiz:quizzes(titulo)")
      .order("completed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
