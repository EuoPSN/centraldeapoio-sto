import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const isAdmin = await isAdminUser(ctx.supabase, ctx.userId);
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
}

export const listProblemScenarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("problem_scenarios")
      .select("*, category:categories(id,name,color,slug)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Escopo de treino: qualquer autenticado. Os dados fictícios (nome, cpf, região,
// gênero, faixa etária) são inventados pelo admin pra simulação e vão junto — só
// solucao_esperada é o "gabarito" de verdade e nunca entra aqui.
export const listProblemScenariosForTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("problem_scenarios")
      .select(`id, name, enredo, personalidade, difficulty, category_id, category:categories(id,name,slug),
        cliente_nome, cliente_cpf, cliente_regiao, cliente_genero, faixa_etaria, created_at`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const FaixaEtaria = z.enum(["20-30", "30-40", "40-60", "60-80"]);

const ScenarioInput = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  enredo: z.string().min(1),
  personalidade: z.string().default(""),
  solucao_esperada: z.string().min(1),
  difficulty: z.string().min(1).max(50),
  cliente_nome: z.string().optional().nullable(),
  cliente_cpf: z.string().optional().nullable(),
  cliente_regiao: z.string().optional().nullable(),
  cliente_genero: z.string().optional().nullable(),
  faixa_etaria: FaixaEtaria.nullable().optional(),
});

export const upsertProblemScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScenarioInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const row = {
      category_id: data.category_id ?? null,
      name: data.name,
      enredo: data.enredo,
      personalidade: data.personalidade,
      solucao_esperada: data.solucao_esperada,
      difficulty: data.difficulty,
      cliente_nome: data.cliente_nome ?? null,
      cliente_cpf: data.cliente_cpf ?? null,
      cliente_regiao: data.cliente_regiao ?? null,
      cliente_genero: data.cliente_genero ?? "masculino",
      faixa_etaria: data.faixa_etaria ?? null,
    };
    const { data: result, error } = data.id
      ? await db.from("problem_scenarios").update(row).eq("id", data.id).select().single()
      : await db.from("problem_scenarios").insert(row).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteProblemScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("problem_scenarios").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Chat e avaliação rodam no servidor: são os únicos lugares que leem
// solucao_esperada, que nunca pode chegar ao navegador do atendente ----

interface ScenarioFull {
  name: string; enredo: string; personalidade: string; solucao_esperada: string;
  cliente_nome: string | null; cliente_regiao: string | null; faixa_etaria: string | null;
}

async function loadScenarioServerSide(id: string): Promise<ScenarioFull> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("problem_scenarios").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as ScenarioFull;
}

// A faixa etária muda o "registro" do cliente: quão técnico, paciente ou
// desconfiado ele soa — não é só um detalhe decorativo do avatar.
function faixaEtariaGuidance(faixa: string | null): string {
  switch (faixa) {
    case "20-30":
      return "Cliente jovem (20-30 anos): familiarizado com tecnologia e aplicativos, mas pode ser mais impaciente e direto, quer resolver rápido pelo celular.";
    case "30-40":
      return "Cliente adulto (30-40 anos): equilíbrio entre paciência e praticidade, entende bem instruções técnicas simples.";
    case "40-60":
      return "Cliente de meia-idade (40-60 anos): pode ter menos intimidade com tecnologia, prefere confirmação verbal clara em vez de só instruções técnicas, gosta de sentir que está sendo bem explicado.";
    case "60-80":
      return "Cliente idoso (60-80 anos): pode ter dificuldade com termos técnicos e telas de celular/aplicativo, precisa de instruções bem simples e repetidas com paciência; se sentir que o atendente está enrolando ou usando termos difíceis, fica desconfiado ou levemente bravo.";
    default:
      return "Sem perfil etário específico definido — comporte-se de forma neutra.";
  }
}

const HistoryItem = z.object({
  role: z.enum(["atendente", "cliente"]),
  content: z.string(),
});

export const problemScenarioChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ scenario_id: z.string().uuid(), history: z.array(HistoryItem) }).parse(d)
  )
  .handler(async ({ data }) => {
    const s = await loadScenarioServerSide(data.scenario_id);
    const isStart = data.history.length === 0;
    const nomeCliente = s.cliente_nome || s.name;
    const systemPrompt = `Você é um cliente virtual chamado ${nomeCliente}, cliente do Cartão de Todos, entrando em contato com o suporte por um problema real.
${s.cliente_regiao ? `Você mora em ${s.cliente_regiao}.` : ""}
${faixaEtariaGuidance(s.faixa_etaria)}

O QUE ACONTECEU (só você sabe disso, o atendente ainda não): ${s.enredo}
Como você se comporta durante a conversa: ${s.personalidade || "normal, educado"}.
A solução correta pro seu problema, que o atendente precisa chegar (NUNCA revele isso diretamente, só reaja quando ele acertar ou errar): ${s.solucao_esperada}.

Responda APENAS como o cliente — nunca quebre o personagem, nunca mencione que isso é uma simulação.
Respostas curtas e naturais, estilo WhatsApp, condizentes com o seu perfil etário acima. Pode quebrar em até 3 mensagens curtas separadas por ||BREAK||.
${isStart
  ? "Esta é a PRIMEIRA mensagem da conversa: você está entrando em contato agora, contando o que aconteceu (ainda não foi atendido)."
  : "Reaja à última mensagem do atendente: se a proposta dele bater com a solução correta, demonstre alívio/satisfação e considere o problema resolvido; se não bater, continue explicando ou insistindo no problema, sem nunca revelar a solução."}`;

    const history = data.history.map((h) => ({
      role: h.role === "atendente" ? ("user" as const) : ("assistant" as const),
      content: h.content,
    }));
    const messages = isStart
      ? [{ role: "system" as const, content: systemPrompt }, { role: "user" as const, content: "Inicie a conversa." }]
      : [{ role: "system" as const, content: systemPrompt }, ...history];

    const { chatCompletion } = await import("@/lib/ai-gateway.server");
    const reply = await chatCompletion({ model: "google/gemini-2.5-flash", messages, temperature: 0.7 });
    return { content: reply };
  });

export const evaluateProblemScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ scenario_id: z.string().uuid(), transcript: z.string() }).parse(d)
  )
  .handler(async ({ data }) => {
    const s = await loadScenarioServerSide(data.scenario_id);
    const evalPrompt = `Você é um avaliador especialista em atendimentos de suporte do Cartão de Todos.

O QUE REALMENTE ACONTECEU COM O CLIENTE: ${s.enredo}
PERFIL DO CLIENTE: ${faixaEtariaGuidance(s.faixa_etaria)}
A SOLUÇÃO CORRETA pra esse caso: ${s.solucao_esperada}

Avalie a conversa abaixo entre o atendente e o cliente. Considere:
- O atendente se apresentou e entendeu o problema corretamente?
- Ele chegou na solução correta descrita acima (mesmo com palavras diferentes)?
- Teve empatia e clareza — inclusive se adaptando ao perfil do cliente acima (ex: mais paciência e menos jargão técnico com um cliente idoso ou leigo)?
- Cometeu algum erro de informação ou de processo?

Responda APENAS com um JSON válido, sem texto extra, sem markdown, neste formato exato:
{"nota": 0-100, "pontos_fortes": ["..."], "pontos_melhoria": ["..."], "erros": ["..."], "resumo": "..."}`;

    const { chatCompletion } = await import("@/lib/ai-gateway.server");
    const reply = await chatCompletion({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: evalPrompt }, { role: "user", content: data.transcript }],
      temperature: 0.3,
    });
    return { content: reply };
  });
