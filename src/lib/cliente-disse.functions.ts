import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import { chamarIAJson, consumirUso, montarInstrucoes } from "@/lib/cerebro.server";
import { CLIENTE_DISSE_MODEL } from "@/lib/ai-models";
import {
  CasoUsoSchema, ETAPAS, ITEM_TIPOS, ObjecaoConteudoSchema, PLANOS,
  removerDadosPessoais, toCaso, toFechamentoItem, toObjecao,
  type ItemAmor, type Mensalidades, type ObjecaoConteudo,
} from "@/lib/cliente-disse";

// "O cliente disse…" — funções de servidor da página (/scripts/cliente-disse)
// e das seções do Painel Admin (Objeções, Objeções novas, Fechamento, Economia).

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

// ---------------------------------------------------------------------------
// IA
// ---------------------------------------------------------------------------

// As regras fixas (pagamento, "não é plano de saúde", não inventar dados…) e os
// blocos marcados para esta ferramenta vêm do Cérebro (montarInstrucoes).
const CONTEXTO_NEGOCIO = `Contexto: venda B2C do Cartão de TODOS pelo WhatsApp (Ribeirão das Neves e região).
Funil do CRM: Novo lead → Lead qualificado → Proposta enviada → Fechamento → Venda concluída.`;

async function instrucoes(): Promise<string> {
  return (await montarInstrucoes("cliente_disse", CONTEXTO_NEGOCIO)).texto;
}

async function perguntarJson(system: string, user: string, temperature = 0.2): Promise<unknown> {
  return chamarIAJson({
    model: CLIENTE_DISSE_MODEL,
    temperature,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
}

// ---------------------------------------------------------------------------
// Página: dados base
// ---------------------------------------------------------------------------

/** Tudo que a página precisa de uma vez: objeções e itens publicados, contagens
 * de uso, mensalidades e itens da Amor Saúde. Aproveita para limpar casos velhos. */
export const getClienteDisseBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = db(context);
    await s.rpc("limpar_fechamento_casos").then(() => undefined, () => undefined);
    const [obj, itens, cont, eco, consultas, exames, odonto] = await Promise.all([
      s.from("objecoes").select("*").eq("status", "publicada").order("prioridade").order("nome"),
      s.from("fechamento_itens").select("*").eq("status", "publicada").order("ordem"),
      s.rpc("cliente_disse_contagens", { _dias: null }),
      s.from("config_economia").select("plano, mensalidade"),
      s.from("pricing_items").select("id, specialty, cartao_price, preco_particular_medio, usar_na_economia").order("specialty"),
      s.from("exames").select("id, nome, media_referencia, preco_particular_medio, usar_na_economia").order("nome"),
      s.from("procedimentos_odontologicos").select("id, nome, preco_particular_medio, usar_na_economia").order("nome"),
    ]);
    const contagens: Record<string, Record<string, number>> = {};
    for (const r of (cont.data ?? []) as { objecao_id: string; angulo: string | null; total: number }[]) {
      (contagens[r.objecao_id] ??= {})[r.angulo ?? ""] = Number(r.total);
    }
    const mensalidades: Mensalidades = {};
    for (const r of (eco.data ?? []) as { plano: string; mensalidade: number | null }[]) {
      if ((PLANOS as readonly string[]).includes(r.plano)) mensalidades[r.plano as (typeof PLANOS)[number]] = r.mensalidade == null ? null : Number(r.mensalidade);
    }
    const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
    const itensAmor: ItemAmor[] = [
      ...((consultas.data ?? []) as any[]).map((r) => ({ tipo: "consulta" as const, id: r.id, nome: r.specialty, cartao: num(r.cartao_price), particularMedio: num(r.preco_particular_medio), usarNaEconomia: !!r.usar_na_economia })),
      ...((exames.data ?? []) as any[]).map((r) => ({ tipo: "exame" as const, id: r.id, nome: r.nome, cartao: num(r.media_referencia), particularMedio: num(r.preco_particular_medio), usarNaEconomia: !!r.usar_na_economia })),
      ...((odonto.data ?? []) as any[]).map((r) => ({ tipo: "odontologia" as const, id: r.id, nome: r.nome, cartao: null, particularMedio: num(r.preco_particular_medio), usarNaEconomia: !!r.usar_na_economia })),
    ];
    return {
      objecoes: ((check(obj) ?? []) as Record<string, unknown>[]).map(toObjecao),
      itens: ((check(itens) ?? []) as Record<string, unknown>[]).map(toFechamentoItem),
      contagens,
      mensalidades,
      itensAmor,
    };
  });

// ---------------------------------------------------------------------------
// Página: classificar a fala
// ---------------------------------------------------------------------------

const ClassificacaoSchema = z.object({
  itens: z.array(z.object({
    tipo: z.enum(["objecao", "sinal", "travamento"]),
    id: z.string(),
    ordem: z.coerce.number().default(0),
    motivo_ordem: z.string().nullable().optional(),
  })).default([]),
  nova: z.boolean().default(false),
});
export type Classificacao = z.infer<typeof ClassificacaoSchema> & { pendente_id: string | null };

export const classificarFala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ fala: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }): Promise<Classificacao> => {
    const s = db(context);
    const fala = removerDadosPessoais(data.fala);
    const [obj, itens] = await Promise.all([
      s.from("objecoes").select("id, nome, exemplos_de_fala").eq("status", "publicada"),
      s.from("fechamento_itens").select("id, tipo, etapa, titulo, exemplos_de_fala").eq("status", "publicada").in("tipo", ["sinal", "travamento"]),
    ]);
    const objecoes = (check(obj) ?? []) as { id: string; nome: string; exemplos_de_fala: string[] }[];
    const fech = (check(itens) ?? []) as { id: string; tipo: string; etapa: string; titulo: string; exemplos_de_fala: string[] }[];

    await consumirUso(context, "cliente_disse");
    const system = `${await instrucoes()}

Você classifica a fala de um cliente no WhatsApp. Compare com a lista de OBJEÇÕES, SINAIS DE COMPRA e TRAVAMENTOS aprovados abaixo e devolva só os que de fato aparecem na fala.
- Uma fala pode ter várias objeções. Ordene na ordem em que o atendente deve tratar (ordem 1 = primeiro) e explique em uma frase curta por que a primeira vem antes (motivo_ordem, só no item de ordem 1).
- Use SOMENTE ids da lista. Nunca invente id.
- "nova": true quando a fala traz uma objeção que não corresponde a nenhuma objeção da lista. Se não houver nenhuma objeção, sinal ou travamento, devolva itens vazio e nova conforme o caso.
Responda APENAS com JSON no formato: {"itens":[{"tipo":"objecao|sinal|travamento","id":"...","ordem":1,"motivo_ordem":"..."}],"nova":false}`;
    const user = JSON.stringify({
      fala,
      objecoes: objecoes.map((o) => ({ id: o.id, nome: o.nome, exemplos: o.exemplos_de_fala })),
      sinais_de_compra: fech.filter((f) => f.tipo === "sinal").map((f) => ({ id: f.id, titulo: f.titulo, etapa: f.etapa, exemplos: f.exemplos_de_fala })),
      travamentos: fech.filter((f) => f.tipo === "travamento").map((f) => ({ id: f.id, titulo: f.titulo, etapa: f.etapa, exemplos: f.exemplos_de_fala })),
    });

    const parsed = ClassificacaoSchema.parse(await perguntarJson(system, user));
    const valid = new Set<string>([
      ...objecoes.map((o) => `objecao:${o.id}`),
      ...fech.map((f) => `${f.tipo}:${f.id}`),
    ]);
    const seen = new Set<string>();
    const out = parsed.itens
      .filter((i) => valid.has(`${i.tipo}:${i.id}`) && !seen.has(i.id) && seen.add(i.id))
      .sort((a, b) => a.ordem - b.ordem)
      .map((i, idx) => ({ ...i, ordem: idx + 1, motivo_ordem: i.motivo_ordem ?? null }));
    const nova = parsed.nova;

    let pendente_id: string | null = null;
    if (nova) pendente_id = await registrarPendente(fala, context.userId).catch(() => null);
    return { itens: out, nova, pendente_id };
  });

/** Põe a fala na fila de objeções novas, somando a um grupo parecido quando houver. */
async function registrarPendente(fala: string, _userId: string): Promise<string> {
  const a = await admin();
  const { data: pend } = await a
    .from("objecoes_pendentes")
    .select("id, fala_exemplo, falas_parecidas, ocorrencias, ocorrencias_em")
    .eq("status", "pendente")
    .order("ultima_ocorrencia", { ascending: false })
    .limit(60);
  const grupos = (pend ?? []) as { id: string; fala_exemplo: string; falas_parecidas: string[]; ocorrencias: number; ocorrencias_em: string[] | null }[];

  let grupoId: string | null = null;
  if (grupos.length) {
    try {
      const r = (await perguntarJson(
        `Você agrupa falas de clientes por semelhança de sentido (a mesma objeção dita de jeitos diferentes).
Receba uma fala nova e grupos existentes (id + falas). Se a fala nova expressa a MESMA objeção de um grupo, devolva o id dele; senão devolva null.
Responda APENAS com JSON: {"grupo_id": "..." | null}`,
        JSON.stringify({ fala_nova: fala, grupos: grupos.map((g) => ({ id: g.id, falas: [g.fala_exemplo, ...g.falas_parecidas].slice(0, 6) })) }),
        0,
      )) as { grupo_id?: string | null };
      if (r?.grupo_id && grupos.some((g) => g.id === r.grupo_id)) grupoId = r.grupo_id;
    } catch {
      grupoId = null;
    }
  }

  const agora = new Date().toISOString();
  if (grupoId) {
    const g = grupos.find((x) => x.id === grupoId)!;
    const parecidas = g.fala_exemplo === fala || g.falas_parecidas.includes(fala) ? g.falas_parecidas : [...g.falas_parecidas, fala].slice(-30);
    const datas = [...(g.ocorrencias_em ?? []), agora].slice(-200);
    check(await a.from("objecoes_pendentes").update({
      ocorrencias: g.ocorrencias + 1, ultima_ocorrencia: agora, falas_parecidas: parecidas, ocorrencias_em: datas,
    }).eq("id", grupoId));
    return grupoId;
  }
  const novo = check(await a.from("objecoes_pendentes").insert({ fala_exemplo: fala, ocorrencias_em: [agora] }).select("id").single()) as { id: string };
  return novo.id;
}

/** Segunda chamada: sugestão da IA para uma objeção nova (não aprovada). */
export const sugerirRespostaObjecao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ fala: z.string().trim().min(1).max(2000), pendente_id: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }): Promise<ObjecaoConteudo> => {
    const fala = removerDadosPessoais(data.fala);
    const { data: obj } = await db(context).from("objecoes").select("nome").eq("status", "publicada");
    const system = `${await instrucoes()}

Você escreve uma SUGESTÃO de resposta para uma objeção nova de cliente, que o atendente vai conferir antes de usar.
Regras obrigatórias:
- Português do Brasil, tom acolhedor de WhatsApp, frases simples.
- Sem valores em reais, carências, regras ou benefícios que não estejam neste contexto. Se precisar citar um número, use "X".
- Cada ângulo com no máximo 3 frases.
- leituras: 2 ou 3 possíveis intenções do cliente, cada uma com uma pergunta curta para confirmar.
- angulos: exatamente 3, tipos "logico", "emocional" e "prova" (rotulo curto, ex.: "a conta").
Responda APENAS com JSON:
{"nome":"...","exemplos_de_fala":["..."],"leituras":[{"titulo":"...","pergunta":"..."}],"angulos":[{"tipo":"logico","rotulo":"...","texto":"..."},{"tipo":"emocional","rotulo":"...","texto":"..."},{"tipo":"prova","rotulo":"...","texto":"..."}],"pergunta_avancar":"...","evite_dizer":"..."}`;
    const user = JSON.stringify({ fala, objecoes_ja_aprovadas: ((obj ?? []) as { nome: string }[]).map((o) => o.nome) });
    const raw = (await perguntarJson(system, user, 0.5)) as Record<string, unknown>;
    const sug = ObjecaoConteudoSchema.parse({
      ...raw,
      exemplos_de_fala: Array.isArray(raw.exemplos_de_fala) && raw.exemplos_de_fala.length ? raw.exemplos_de_fala : [fala],
    });
    sug.angulos = sug.angulos.map((an) => ({ ...an, texto: an.texto.replace(/n[ãa]o [ée] plano de sa[úu]de/gi, "").trim() }));
    if (data.pendente_id) {
      const a = await admin();
      await a.from("objecoes_pendentes").update({ sugestao_ia: sug }).eq("id", data.pendente_id).is("sugestao_ia", null);
    }
    return sug;
  });

/** "Enviar para o Paulo": marca quem sugeriu (prioriza o grupo na fila). */
export const enviarObjecaoParaPaulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pendente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await admin();
    const g = check(await a.from("objecoes_pendentes").select("sugerida_por").eq("id", data.pendente_id).maybeSingle()) as { sugerida_por: string | null } | null;
    if (!g) throw new Error("Objeção não encontrada na fila.");
    if (!g.sugerida_por) check(await a.from("objecoes_pendentes").update({ sugerida_por: context.userId }).eq("id", data.pendente_id));
    return { ok: true };
  });

/** "Contar o que respondi": guarda a resposta do atendente no grupo. */
export const contarRespostaObjecao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pendente_id: z.string().uuid(), texto: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await admin();
    const g = check(await a.from("objecoes_pendentes").select("respostas_atendentes").eq("id", data.pendente_id).maybeSingle()) as { respostas_atendentes: unknown[] } | null;
    if (!g) throw new Error("Objeção não encontrada na fila.");
    const respostas = [...(Array.isArray(g.respostas_atendentes) ? g.respostas_atendentes : []), {
      user_id: context.userId, texto: removerDadosPessoais(data.texto), created_at: new Date().toISOString(),
    }].slice(-50);
    check(await a.from("objecoes_pendentes").update({ respostas_atendentes: respostas }).eq("id", data.pendente_id));
    return { ok: true };
  });

/** Registra cada "Copiar". */
export const registrarUsoClienteDisse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    objecao_id: z.string().uuid().nullable().default(null),
    fechamento_item_id: z.string().uuid().nullable().default(null),
    angulo: z.string().max(40).nullable().default(null),
    /** Caso de "Fechar com este cliente" em que a mensagem foi copiada (para "levou ao fechamento"). */
    caso_id: z.string().uuid().nullable().default(null),
  }).refine((v) => v.objecao_id || v.fechamento_item_id).parse(d))
  .handler(async ({ data, context }) => {
    const { caso_id, ...uso } = data;
    check(await db(context).from("cliente_disse_uso").insert({ ...uso, user_id: context.userId }));
    // Mensagens que vendem: cada "Copiar" do Fechar com este cliente. Falha aqui não derruba o "Copiar".
    if (data.fechamento_item_id) {
      const r = await db(context).from("mensagens_usos").insert({
        user_id: context.userId, origem: "fechamento", item_id: data.fechamento_item_id, caso_id,
      });
      if (r?.error) console.error("Uso da mensagem não registrado (migração pendente?):", r.error.message);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Página: casos de fechamento (só os do próprio atendente, via RLS)
// ---------------------------------------------------------------------------

export const listMeusCasos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rows = check(await db(context).from("fechamento_casos").select("*").eq("user_id", context.userId).neq("etapa", "venda_concluida").order("updated_at", { ascending: false })) ?? [];
    return (rows as Record<string, unknown>[]).map(toCaso);
  });

const CasoInput = z.object({
  id: z.string().uuid().optional(),
  // Só o primeiro nome: corta tudo depois do primeiro espaço.
  primeiro_nome: z.string().max(80).transform((v) => removerDadosPessoais(v.trim().split(/\s+/)[0] ?? "").slice(0, 40)),
  dependentes: z.coerce.number().int().min(0).max(20),
  plano: z.enum(PLANOS).nullable(),
  usos: z.array(CasoUsoSchema).max(12),
  etapa: z.enum([...ETAPAS, "venda_concluida"] as [string, ...string[]]),
});

export const salvarCaso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CasoInput.parse(d))
  .handler(async ({ data, context }) => {
    const s = db(context);
    const { id, ...rest } = data;
    const usos = rest.usos.map((u) => ({ ...u, rotulo: removerDadosPessoais(u.rotulo) }));
    const row = id
      ? check(await s.from("fechamento_casos").update({ ...rest, usos }).eq("id", id).eq("user_id", context.userId).select("*").single())
      : check(await s.from("fechamento_casos").insert({ ...rest, usos, user_id: context.userId }).select("*").single());
    return toCaso(row as Record<string, unknown>);
  });

/** "Venda concluída": encerra e apaga o caso. */
export const concluirCaso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Antes de apagar o caso: as mensagens copiadas nele "levaram ao fechamento".
    const marca = await db(context).rpc("mensagens_usos_marcar_fechamento", { _caso_id: data.id });
    if (marca?.error) console.error("Fechamento não marcado nas mensagens (migração pendente?):", marca.error.message);
    check(await db(context).from("fechamento_casos").delete().eq("id", data.id).eq("user_id", context.userId));
    return { ok: true };
  });

/** "Retomar depois": guarda o caso para amanhã. */
export const retomarCasoDepois = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    check(await db(context).from("fechamento_casos").update({ retomar_em: data.data }).eq("id", data.id).eq("user_id", context.userId));
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admin: Objeções
// ---------------------------------------------------------------------------

export const adminListObjecoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const s = db(context);
    const [obj, cont] = await Promise.all([
      s.from("objecoes").select("*").order("prioridade").order("nome"),
      s.rpc("cliente_disse_contagens", { _dias: 30 }),
    ]);
    const uso30: Record<string, { total: number; topAngulo: string | null }> = {};
    const tally: Record<string, Record<string, number>> = {};
    for (const r of (cont.data ?? []) as { objecao_id: string; angulo: string | null; total: number }[]) {
      (tally[r.objecao_id] ??= {})[r.angulo ?? ""] = Number(r.total);
    }
    for (const [id, m] of Object.entries(tally)) {
      const entries = Object.entries(m);
      const top = entries.filter(([k]) => k).sort((a, b) => b[1] - a[1])[0];
      uso30[id] = { total: entries.reduce((n, [, v]) => n + v, 0), topAngulo: top?.[0] ?? null };
    }
    return { objecoes: ((check(obj) ?? []) as Record<string, unknown>[]).map(toObjecao), uso30 };
  });

const ObjecaoInput = ObjecaoConteudoSchema.extend({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(200),
  prioridade: z.coerce.number().int().min(0).max(1000).default(100),
  status: z.enum(["rascunho", "publicada"]),
});

export const upsertObjecao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ObjecaoInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { id, ...row } = data;
    const s = db(context);
    const r = id
      ? check(await s.from("objecoes").update(row).eq("id", id).select("*").single())
      : check(await s.from("objecoes").insert(row).select("*").single());
    return toObjecao(r as Record<string, unknown>);
  });

export const deleteObjecao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("objecoes").delete().eq("id", data.id));
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admin: Objeções novas (fila)
// ---------------------------------------------------------------------------

export interface PendenteAdmin {
  id: string;
  fala_exemplo: string;
  falas_parecidas: string[];
  ocorrencias: number;
  semana: number;
  ultima_ocorrencia: string;
  sugestao_ia: ObjecaoConteudo | null;
  respostas: { nome: string; texto: string; created_at: string }[];
  sugerida_por: string | null;
  sugerida_por_nome: string | null;
  created_at: string;
}

export const adminListPendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendenteAdmin[]> => {
    await requireAdmin(context);
    const s = db(context);
    const rows = (check(await s.from("objecoes_pendentes").select("*").eq("status", "pendente")) ?? []) as any[];
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.sugerida_por) ids.add(r.sugerida_por);
      for (const x of r.respostas_atendentes ?? []) if (x?.user_id) ids.add(x.user_id);
    }
    const nomes = new Map<string, string>();
    if (ids.size) {
      const { data: profs } = await s.from("profiles").select("id, display_name, email").in("id", [...ids]);
      for (const p of (profs ?? []) as any[]) nomes.set(p.id, (p.display_name || p.email || "").split(/[\s@]/)[0] || "Atendente");
    }
    const semanaAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const out: PendenteAdmin[] = rows.map((r) => {
      const sug = r.sugestao_ia ? ObjecaoConteudoSchema.safeParse(r.sugestao_ia) : null;
      return {
        id: r.id,
        fala_exemplo: r.fala_exemplo,
        falas_parecidas: r.falas_parecidas ?? [],
        ocorrencias: r.ocorrencias,
        semana: ((r.ocorrencias_em ?? []) as string[]).filter((d) => new Date(d).getTime() >= semanaAtras).length,
        ultima_ocorrencia: r.ultima_ocorrencia,
        sugestao_ia: sug?.success ? sug.data : null,
        respostas: ((r.respostas_atendentes ?? []) as any[]).map((x) => ({ nome: nomes.get(x.user_id) ?? "Atendente", texto: String(x.texto ?? ""), created_at: String(x.created_at ?? "") })),
        sugerida_por: r.sugerida_por,
        sugerida_por_nome: r.sugerida_por ? nomes.get(r.sugerida_por) ?? "Atendente" : null,
        created_at: r.created_at,
      };
    });
    // Mais ocorrências na semana primeiro; em empate, as enviadas por atendente.
    out.sort((a, b) => b.semana - a.semana || Number(!!b.sugerida_por) - Number(!!a.sugerida_por) || b.ocorrencias - a.ocorrencias || b.ultima_ocorrencia.localeCompare(a.ultima_ocorrencia));
    return out;
  });

const PendenteAcaoInput = z.object({
  pendente_id: z.string().uuid(),
  objecao: ObjecaoConteudoSchema,
});

/** Aprovar e publicar: cria a objeção publicada, fecha o grupo e anuncia em Novidades. */
export const aprovarPendente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PendenteAcaoInput.extend({ objecao: ObjecaoConteudoSchema.extend({ nome: z.string().trim().min(1).max(200) }) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = db(context);
    const g = check(await s.from("objecoes_pendentes").select("fala_exemplo, sugerida_por, status").eq("id", data.pendente_id).single()) as { fala_exemplo: string; sugerida_por: string | null; status: string };
    if (g.status !== "pendente") throw new Error("Essa objeção já foi revisada.");
    const nova = check(await s.from("objecoes").insert({ ...data.objecao, status: "publicada", autor_id: g.sugerida_por }).select("id").single()) as { id: string };
    check(await s.from("objecoes_pendentes").update({ status: "aprovada", objecao_id: nova.id, sugestao_ia: data.objecao }).eq("id", data.pendente_id));
    const fala = g.fala_exemplo.length > 120 ? `${g.fala_exemplo.slice(0, 117)}…` : g.fala_exemplo;
    await s.from("changelog_entries").insert({
      title: `Nova resposta: cliente diz "${fala}"`,
      summary: `A objeção "${data.objecao.nome}" agora tem resposta aprovada em Scripts → O cliente disse…`,
      published: true,
    });
    return { ok: true, objecao_id: nova.id };
  });

export const salvarRascunhoPendente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PendenteAcaoInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("objecoes_pendentes").update({ sugestao_ia: data.objecao }).eq("id", data.pendente_id));
    return { ok: true };
  });

export const recusarPendente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pendente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("objecoes_pendentes").update({ status: "recusada" }).eq("id", data.pendente_id));
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admin: Fechamento
// ---------------------------------------------------------------------------

export const adminListFechamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const rows = check(await db(context).from("fechamento_itens").select("*").order("etapa").order("ordem")) ?? [];
    return (rows as Record<string, unknown>[]).map(toFechamentoItem);
  });

const FechamentoItemInput = z.object({
  id: z.string().uuid().optional(),
  tipo: z.enum(ITEM_TIPOS),
  etapa: z.enum(ETAPAS),
  titulo: z.string().trim().min(1).max(200),
  exemplos_de_fala: z.array(z.string().max(300)).max(30).default([]),
  mensagem: z.string().max(4000).nullable().default(null),
  passos: z.array(z.string().max(500)).max(20).default([]),
  evite: z.string().max(1000).nullable().default(null),
  ordem: z.coerce.number().int().default(0),
  status: z.enum(["rascunho", "publicada"]),
});

export const upsertFechamentoItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FechamentoItemInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { id, ...row } = data;
    const s = db(context);
    const r = id
      ? check(await s.from("fechamento_itens").update(row).eq("id", id).select("*").single())
      : check(await s.from("fechamento_itens").insert(row).select("*").single());
    return toFechamentoItem(r as Record<string, unknown>);
  });

export const deleteFechamentoItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("fechamento_itens").delete().eq("id", data.id));
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admin: Economia
// ---------------------------------------------------------------------------

export const setMensalidadePlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plano: z.enum(PLANOS), mensalidade: z.number().min(0).max(100000).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("config_economia").upsert({ plano: data.plano, mensalidade: data.mensalidade }, { onConflict: "plano" }));
    return { ok: true };
  });

const TABELA_AMOR = { consulta: "pricing_items", exame: "exames", odontologia: "procedimentos_odontologicos" } as const;

export const setItemEconomia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tipo: z.enum(["consulta", "exame", "odontologia"]),
    id: z.string().uuid(),
    preco_particular_medio: z.number().min(0).max(1000000).nullable(),
    usar_na_economia: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from(TABELA_AMOR[data.tipo]).update({
      preco_particular_medio: data.preco_particular_medio,
      usar_na_economia: data.usar_na_economia,
    }).eq("id", data.id));
    return { ok: true };
  });
