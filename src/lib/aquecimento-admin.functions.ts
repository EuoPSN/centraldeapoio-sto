import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import {
  AlternativaSchema, CONFIG_AQUECIMENTO_PADRAO, HORARIO, LIMITE_CORRECOES_PADRAO, TIPOS_EXERCICIO, validarExercicio,
  type Nivel, type StatusExercicio, type TipoExercicio,
} from "@/lib/aquecimento";

// Aquecimento e Mapa de domínio — funções de servidor do Admin.
// O Admin vê níveis, contagens e adesão. Nunca o texto digitado: ele não existe no banco.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
const UUID = z.string().uuid();
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
const nomeDe = (p: { display_name: string | null; email: string | null }) =>
  p.display_name?.trim() || String(p.email ?? "").split("@")[0] || "Sem nome";

/** Atendentes = quem tem perfil e não é admin. */
async function listarAtendentes(ctx: Ctx): Promise<{ id: string; nome: string }[]> {
  const s = db(ctx);
  const [perfis, admins] = await Promise.all([
    s.from("profiles").select("id, display_name, email"),
    s.from("user_roles").select("user_id").eq("role", "admin"),
  ]);
  const ehAdmin = new Set(((check(admins) ?? []) as { user_id: string }[]).map((r) => r.user_id));
  return ((check(perfis) ?? []) as { id: string; display_name: string | null; email: string | null }[])
    .filter((p) => !ehAdmin.has(p.id))
    .map((p) => ({ id: p.id, nome: nomeDe(p) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Mapa da equipe
// ---------------------------------------------------------------------------

export interface MapaEquipe {
  temas: { id: string; nome: string }[];
  atendentes: { id: string; nome: string }[];
  /** chave `${atendente_id}:${tema_id}` */
  celulas: Record<string, { nivel: Nivel; respostas: number; acertos: number }>;
  janela_dias: number;
}

export const adminMapaEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MapaEquipe> => {
    await requireAdmin(context);
    const s = db(context);
    const [mapa, temas, cfg, atendentes] = await Promise.all([
      s.rpc("aquecimento_mapa_equipe"),
      s.from("dominio_temas").select("id, nome").eq("ativo", true).order("ordem"),
      s.from("aquecimento_config").select("janela_dominio_dias").eq("id", 1).maybeSingle(),
      listarAtendentes(context),
    ]);
    const celulas: MapaEquipe["celulas"] = {};
    for (const m of (check(mapa) ?? []) as { user_id: string; tema_id: string; respostas: number; acertos: number; nivel: Nivel }[]) {
      celulas[`${m.user_id}:${m.tema_id}`] = { nivel: m.nivel, respostas: m.respostas, acertos: m.acertos };
    }
    return {
      temas: (check(temas) ?? []) as { id: string; nome: string }[],
      atendentes, celulas,
      janela_dias: Number(cfg.data?.janela_dominio_dias ?? CONFIG_AQUECIMENTO_PADRAO.janela_dominio_dias),
    };
  });

// ---------------------------------------------------------------------------
// Banco de exercícios
// ---------------------------------------------------------------------------

export interface ExercicioAdmin {
  id: string; tema_id: string; tema_nome: string; tipo: TipoExercicio; titulo: string; pergunta: string; contexto: string;
  alternativas: { texto: string; correta: boolean }[]; resposta_aprovada: string; habito_chave: string | null;
  explicacao: string; fonte: string; objecao_id: string | null; status: StatusExercicio; criado_por: "ia" | "admin"; created_at: string;
}

export const adminListExercicios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ exercicios: ExercicioAdmin[]; temas: { id: string; nome: string }[] }> => {
    await requireAdmin(context);
    const s = db(context);
    const [ex, temas] = await Promise.all([
      s.from("aquecimento_exercicios").select("*").neq("status", "arquivado").order("created_at", { ascending: false }).limit(500),
      s.from("dominio_temas").select("id, nome").order("ordem"),
    ]);
    const lista = (check(temas) ?? []) as { id: string; nome: string }[];
    const nome = new Map(lista.map((t) => [t.id, t.nome]));
    const exercicios = ((check(ex) ?? []) as Record<string, any>[]).map((r) => ({
      id: String(r.id), tema_id: String(r.tema_id), tema_nome: nome.get(r.tema_id) ?? "", tipo: r.tipo, titulo: String(r.titulo ?? ""),
      pergunta: String(r.pergunta), contexto: String(r.contexto ?? ""),
      alternativas: Array.isArray(r.alternativas) ? r.alternativas : [], resposta_aprovada: String(r.resposta_aprovada ?? ""),
      habito_chave: r.habito_chave ?? null, explicacao: String(r.explicacao ?? ""), fonte: String(r.fonte ?? ""),
      objecao_id: r.objecao_id ?? null, status: r.status, criado_por: r.criado_por, created_at: String(r.created_at),
    })) as ExercicioAdmin[];
    // Rascunhos primeiro.
    exercicios.sort((a, b) => Number(b.status === "rascunho") - Number(a.status === "rascunho") || b.created_at.localeCompare(a.created_at));
    return { exercicios, temas: lista };
  });

const EditSchema = z.object({
  id: UUID,
  titulo: z.string().trim().max(120),
  pergunta: z.string().trim().min(1, "Escreva a pergunta.").max(800),
  contexto: z.string().trim().max(400),
  alternativas: z.array(AlternativaSchema).max(5),
  resposta_aprovada: z.string().trim().max(1000),
  habito_chave: z.string().trim().max(60).nullable(),
  explicacao: z.string().trim().max(800),
  fonte: z.string().trim().max(200),
  acao: z.enum(["salvar", "aprovar"]),
});

export const adminSalvarExercicio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EditSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; mensagem: string }> => {
    await requireAdmin(context);
    const s = db(context);
    const atual = check(await s.from("aquecimento_exercicios").select("tipo").eq("id", data.id).maybeSingle()) as { tipo: TipoExercicio } | null;
    if (!atual) return { ok: false, mensagem: "Exercício não encontrado." };
    const { acao, id, ...campos } = data;
    const erro = validarExercicio({ tipo: atual.tipo, alternativas: campos.alternativas, resposta_aprovada: campos.resposta_aprovada, contexto: campos.contexto, habito_chave: campos.habito_chave });
    if (erro && acao === "aprovar") return { ok: false, mensagem: erro };
    check(await s.from("aquecimento_exercicios").update({
      ...campos,
      alternativas: atual.tipo === "multipla_escolha" ? campos.alternativas : [],
      ...(acao === "aprovar" ? { status: "aprovado", aprovado_por: context.userId } : {}),
    }).eq("id", id));
    return { ok: true };
  });

export const adminDescartarExercicio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = db(context);
    const ex = check(await s.from("aquecimento_exercicios").select("status").eq("id", data.id).maybeSingle()) as { status: StatusExercicio } | null;
    if (!ex) return { ok: true as const };
    // Rascunho some; exercício já aprovado fica arquivado (o histórico de respostas continua valendo).
    if (ex.status === "rascunho") check(await s.from("aquecimento_exercicios").delete().eq("id", data.id));
    else check(await s.from("aquecimento_exercicios").update({ status: "arquivado" }).eq("id", data.id));
    return { ok: true as const };
  });

export const adminGerarRascunhos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tema_id: UUID, tipo: z.enum(TIPOS_EXERCICIO), quantidade: z.number().int().min(1).max(5),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ criados: number; mensagem: string | null }> => {
    await requireAdmin(context);
    const s = db(context);
    const tema = check(await s.from("dominio_temas").select("id, nome, descricao").eq("id", data.tema_id).maybeSingle()) as { id: string; nome: string; descricao: string } | null;
    if (!tema) throw new Error("Tema não encontrado.");
    const objecoes = ((await s.from("objecoes").select("id, nome").eq("status", "publicada")).data ?? []) as { id: string; nome: string }[];
    const { gerarRascunhosComIA } = await import("@/lib/aquecimento.server");
    const { registrarUso } = await import("@/lib/cerebro.server");
    let r;
    try {
      r = await gerarRascunhosComIA({ tema, tipo: data.tipo, quantidade: data.quantidade, objecoes });
    } catch (err) {
      console.error("Rascunhos do aquecimento falharam:", err);
      throw new Error("Não consegui gerar os rascunhos agora. Tente de novo.");
    }
    if (r.semFatos) return { criados: 0, mensagem: `Não há fatos sobre "${tema.nome}" no Cérebro nem na base de conhecimento. Preencha o Cérebro antes de gerar.` };
    if (!r.rascunhos.length) return { criados: 0, mensagem: "A IA não trouxe nenhum exercício aproveitável. Tente de novo." };
    check(await s.from("aquecimento_exercicios").insert(r.rascunhos.map((x) => ({
      tema_id: tema.id, tipo: data.tipo, titulo: x.titulo, pergunta: x.pergunta, contexto: x.contexto,
      alternativas: data.tipo === "multipla_escolha" ? x.alternativas : [], resposta_aprovada: x.resposta_aprovada,
      habito_chave: x.habito_chave ?? null, explicacao: x.explicacao, fonte: x.fonte, objecao_id: x.objecao_id,
      status: "rascunho", criado_por: "ia",
    }))));
    await registrarUso(context, "aquecimento");
    return { criados: r.rascunhos.length, mensagem: null };
  });

export async function contarExerciciosParaAprovar(db: any): Promise<number> {
  const r = await db.from("aquecimento_exercicios").select("id", { count: "exact", head: true }).eq("status", "rascunho");
  if (r.error) throw new Error(r.error.message);
  return r.count ?? 0;
}

// ---------------------------------------------------------------------------
// Aquecimento (adesão, avisos, limite e temas)
// ---------------------------------------------------------------------------

export interface AquecimentoAdmin {
  adesao: { id: string; nome: string; dias: number }[];
  horarios: string[];
  limite_diario: number | null;
  temas: { id: string; nome: string; descricao: string; ativo: boolean; ordem: number }[];
}

export const adminAquecimento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AquecimentoAdmin> => {
    await requireAdmin(context);
    const s = db(context);
    const [ades, cfg, lim, temas, atendentes] = await Promise.all([
      s.rpc("aquecimento_adesao_semana"),
      s.from("aquecimento_config").select("horarios").eq("id", 1).maybeSingle(),
      s.from("ia_limites").select("limite_diario").eq("ferramenta", "aquecimento").maybeSingle(),
      s.from("dominio_temas").select("id, nome, descricao, ativo, ordem").order("ordem"),
      listarAtendentes(context),
    ]);
    const dias = new Map(((check(ades) ?? []) as { user_id: string; dias: number }[]).map((a) => [a.user_id, a.dias]));
    return {
      adesao: atendentes.map((a) => ({ id: a.id, nome: a.nome, dias: dias.get(a.id) ?? 0 })).sort((x, y) => y.dias - x.dias || x.nome.localeCompare(y.nome, "pt-BR")),
      horarios: Array.isArray(cfg.data?.horarios) && cfg.data.horarios.length ? cfg.data.horarios : CONFIG_AQUECIMENTO_PADRAO.horarios,
      limite_diario: lim.data ? (lim.data.limite_diario as number | null) : LIMITE_CORRECOES_PADRAO,
      temas: (check(temas) ?? []) as AquecimentoAdmin["temas"],
    };
  });

export const adminSalvarAquecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    horarios: z.array(z.string().regex(HORARIO, "Use o formato HH:MM, como 08:30.")).min(1).max(6),
    limite_diario: z.number().int().min(1).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = db(context);
    const horarios = [...new Set(data.horarios)].sort();
    check(await s.from("aquecimento_config").upsert({ id: 1, horarios, updated_at: new Date().toISOString() }, { onConflict: "id" }));
    check(await s.from("ia_limites").upsert({ ferramenta: "aquecimento", limite_diario: data.limite_diario }, { onConflict: "ferramenta" }));
    return { ok: true as const };
  });

export const adminSalvarTema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: UUID.nullish(),
    nome: z.string().trim().min(1, "Dê um nome ao tema.").max(60),
    descricao: z.string().trim().max(200).default(""),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = db(context);
    if (data.id) {
      check(await s.from("dominio_temas").update({ nome: data.nome, descricao: data.descricao, ativo: data.ativo }).eq("id", data.id));
    } else {
      const ult = check(await s.from("dominio_temas").select("ordem").order("ordem", { ascending: false }).limit(1)) as { ordem: number }[];
      check(await s.from("dominio_temas").insert({ nome: data.nome, descricao: data.descricao, ativo: data.ativo, ordem: (ult[0]?.ordem ?? 0) + 10 }));
    }
    return { ok: true as const };
  });

export const adminReordenarTemas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(UUID).min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = db(context);
    for (let i = 0; i < data.ids.length; i++) {
      check(await s.from("dominio_temas").update({ ordem: (i + 1) * 10 }).eq("id", data.ids[i]));
    }
    return { ok: true as const };
  });
