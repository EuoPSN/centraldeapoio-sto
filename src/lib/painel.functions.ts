import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERFIS_MATURIDADE = ["Técnico", "Comercial", "Investigativo", "Empático", "Rápido", "Detalhista"];
const NIVEIS_LIDERANCA = ["P1", "P2", "P3", "P4"];

export const getDashboardOperacional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { dataInicio?: string; dataFim?: string })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const inicio = data.dataInicio ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const fim = data.dataFim ?? new Date().toISOString().slice(0, 10);

    const [simResults, relatorios, profiles] = await Promise.all([
      db.from("simulator_results").select("user_id, nota, difficulty, created_at, pontos_fortes, pontos_melhoria, erros")
        .gte("created_at", inicio).lte("created_at", fim + "T23:59:59"),
      db.from("relatorio_prospeccao").select("user_id, area, tentativas, oportunidades, vendas, data")
        .gte("data", inicio).lte("data", fim),
      db.from("profiles").select("id, display_name, email, cargo, xp, perfis_maturidade, nivel_lideranca"),
    ]);

    const sims = simResults.data ?? [];
    const rels = relatorios.data ?? [];
    const profs = profiles.data ?? [];

    const profMap: Record<string, any> = {};
    for (const p of profs) profMap[p.id] = p;

    // Stats por usuário
    const userStats: Record<string, any> = {};
    for (const s of sims) {
      if (!userStats[s.user_id]) userStats[s.user_id] = { simulacoes: 0, somaNota: 0, notas: [], nome: profMap[s.user_id]?.display_name ?? "—", cargo: profMap[s.user_id]?.cargo ?? "—" };
      userStats[s.user_id].simulacoes++;
      userStats[s.user_id].somaNota += s.nota;
      userStats[s.user_id].notas.push({ data: s.created_at.slice(0, 10), nota: s.nota });
    }

    const userRel: Record<string, any> = {};
    for (const r of rels) {
      if (!userRel[r.user_id]) userRel[r.user_id] = { tentativas: 0, oportunidades: 0, vendas: 0 };
      userRel[r.user_id].tentativas += r.tentativas;
      userRel[r.user_id].oportunidades += r.oportunidades;
      userRel[r.user_id].vendas += r.vendas;
    }

    const totalSims = sims.length;
    const mediaNota = totalSims > 0 ? Math.round(sims.reduce((s: number, r: any) => s + r.nota, 0) / totalSims) : 0;
    const totalVendas = rels.reduce((s: number, r: any) => s + r.vendas, 0);
    const totalTentativas = rels.reduce((s: number, r: any) => s + r.tentativas, 0);

    const ranking = Object.entries(userStats).map(([uid, s]: any) => ({
      userId: uid,
      nome: s.nome,
      cargo: s.cargo,
      simulacoes: s.simulacoes,
      media: s.simulacoes > 0 ? Math.round(s.somaNota / s.simulacoes) : 0,
      vendas: userRel[uid]?.vendas ?? 0,
      xp: profMap[uid]?.xp ?? 0,
      nivel_lideranca: profMap[uid]?.nivel_lideranca ?? null,
      perfis_maturidade: profMap[uid]?.perfis_maturidade ?? [],
    })).sort((a, b) => b.media - a.media);

    // Evolução diária de notas
    const evolucaoPorDia: Record<string, number[]> = {};
    for (const s of sims) {
      const dia = s.created_at.slice(0, 10);
      if (!evolucaoPorDia[dia]) evolucaoPorDia[dia] = [];
      evolucaoPorDia[dia].push(s.nota);
    }
    const serieNotas = Object.entries(evolucaoPorDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, notas]: any) => ({
        dia,
        media: Math.round(notas.reduce((s: number, n: number) => s + n, 0) / notas.length)
      }));

    // Quem está evoluindo vs estagnado
    const evolucao = Object.entries(userStats).map(([uid, s]: any) => {
      const notas = s.notas.sort((a: any, b: any) => a.data.localeCompare(b.data));
      if (notas.length < 2) return null;
      const primeira = notas[0].nota;
      const ultima = notas[notas.length - 1].nota;
      return { userId: uid, nome: s.nome, delta: ultima - primeira };
    }).filter(Boolean).sort((a: any, b: any) => b.delta - a.delta);

    return {
      cards: { totalSims, mediaNota, totalVendas, totalTentativas, totalFuncionarios: profs.length },
      ranking,
      serieNotas,
      evolucao,
    };
  });

export const getPerfilFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { userId: string })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const [profile, sims, rels, meta] = await Promise.all([
      db.from("profiles").select("*").eq("id", data.userId).single(),
      db.from("simulator_results").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(20),
      db.from("relatorio_prospeccao").select("*").eq("user_id", data.userId).order("data", { ascending: false }).limit(30),
      db.from("funcionarios_metas").select("*").eq("nome", data.userId).order("created_at", { ascending: false }).limit(1),
    ]);
    return {
      profile: profile.data,
      simulacoes: sims.data ?? [],
      relatorios: rels.data ?? [],
      meta: meta.data?.[0] ?? null,
    };
  });

export const gerarAnaliseIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { userId: string; nomeUsuario: string })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;

    const [sims, profile] = await Promise.all([
      db.from("simulator_results").select("nota, difficulty, pontos_fortes, pontos_melhoria, erros, profile_name, created_at")
        .eq("user_id", data.userId).order("created_at", { ascending: false }).limit(15),
      db.from("profiles").select("xp, cargo, perfis_maturidade, nivel_lideranca").eq("id", data.userId).single(),
    ]);

    const simList = sims.data ?? [];
    const prof = profile.data;

    if (simList.length === 0) {
      return { analise: "Sem simulações suficientes para análise.", sugestao_perfis: [], sugestao_nivel: null, recomendacoes: "Complete pelo menos uma simulação para gerar a análise." };
    }

    const mediaGeral = Math.round(simList.reduce((s: number, r: any) => s + r.nota, 0) / simList.length);
    const pontosFortesAgregados = simList.flatMap((s: any) => s.pontos_fortes ?? []).slice(0, 10);
    const pontosMelhoriaAgregados = simList.flatMap((s: any) => s.pontos_melhoria ?? []).slice(0, 10);
    const errosAgregados = simList.flatMap((s: any) => s.erros ?? []).slice(0, 10);

    const contexto = `
Atendente: ${data.nomeUsuario}
Cargo: ${prof?.cargo ?? "não definido"}
XP acumulado: ${prof?.xp ?? 0}
Total de simulações analisadas: ${simList.length}
Nota média geral: ${mediaGeral}/100
Perfis atuais: ${prof?.perfis_maturidade?.join(", ") || "nenhum"}
Nível de liderança atual: ${prof?.nivel_lideranca || "não classificado"}

Pontos fortes recorrentes: ${pontosFortesAgregados.join("; ")}
Pontos de melhoria recorrentes: ${pontosMelhoriaAgregados.join("; ")}
Erros recorrentes: ${errosAgregados.join("; ")}

Contexto: Essa análise é para um atendente de vendas do Cartão de Todos, empresa de cartão de descontos.
`;

    const prompt = `${contexto}

Você é um especialista em gestão de pessoas e desenvolvimento de equipes comerciais.
Analise os dados de desempenho desse atendente de vendas do Cartão de Todos 
(empresa de cartão de descontos com foco em saúde e bem-estar).

Responda APENAS com um JSON válido, sem texto extra, sem markdown, sem blocos de código.

Os perfis de maturidade disponíveis e seus significados são:
- Técnico: Domina os processos, regras e informações do produto. Responde com precisão.
- Comercial: Foco em resultados, argumenta bem, contorna objeções com facilidade.
- Investigativo: Faz perguntas para entender o cliente antes de oferecer solução.
- Empático: Conexão emocional com o cliente, escuta ativa e linguagem acolhedora.
- Rápido: Resolve com agilidade, direto ao ponto, não enrola.
- Detalhista: Explica cada etapa com cuidado, não deixa dúvidas, muito preciso.

Um atendente pode ter múltiplos perfis cumulativos — escolha os que mais se destacam.

Os níveis de liderança situacional (Hersey-Blanchard):
- P1: Baixa competência técnica, alto entusiasmo. Precisa de direcionamento claro.
- P2: Competência em desenvolvimento, entusiasmo variável. Precisa de coaching.
- P3: Alta competência técnica, mas inseguro ou desmotivado. Precisa de suporte.
- P4: Alta competência e alto comprometimento. Pode trabalhar com autonomia.

{
  "analise": "Análise detalhada em 4-6 frases sobre o perfil comportamental desse atendente, seus pontos fortes, padrões observados nas simulações e como ele se relaciona com clientes virtuais",
  "sugestao_perfis": ["array com os perfis mais adequados dentre: Técnico, Comercial, Investigativo, Empático, Rápido, Detalhista — mínimo 1, máximo 4"],
  "justificativa_perfis": "Explique em 2-3 frases por que esses perfis foram escolhidos com base nos dados",
  "sugestao_nivel": "P1, P2, P3 ou P4",
  "justificativa_nivel": "Explique em 1-2 frases por que esse nível foi escolhido",
  "recomendacoes": "4 a 6 recomendações práticas e específicas de desenvolvimento, separadas por ponto e vírgula. Seja concreto: indique exercícios, abordagens ou situações específicas de atendimento do Cartão de Todos"
}`;

    const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
      }),
    });

    const apiData = await apiResponse.json();
    const text = apiData.choices?.[0]?.message?.content ?? "{}";
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return { analise: "Erro ao processar análise.", sugestao_perfis: [], sugestao_nivel: null, recomendacoes: "" };
    }
  });

export const salvarClassificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    userId: string;
    perfis_maturidade: string[];
    nivel_lideranca: string | null;
    recomendacoes: string;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { error } = await db.from("profiles").update({
      perfis_maturidade: data.perfis_maturidade,
      nivel_lideranca: data.nivel_lideranca,
    }).eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });
