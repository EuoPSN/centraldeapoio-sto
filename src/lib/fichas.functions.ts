import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import { calcularUso, mensagemLimite, prepararConversaTxt, type UsoStatus } from "@/lib/cerebro";
import {
  CamposFichaSchema, ERRO_FICHA, MAX_CARACTERES_CONVERSA, dataISO, diasEntre, tituloFicha, toFicha, validarFicha,
  type Ficha, type FichaBiblioteca, type FichaGerada,
} from "@/lib/fichas";
import { PONTOS, type Ponto } from "@/lib/retomada";

// Conversas que fecharam — funções de servidor (envio pelo atendente, Biblioteca, casos
// parecidos e Admin).
//
// PRIVACIDADE: a conversa bruta é lida no navegador, chega aqui como texto, é mascarada e
// processada em memória e descartada. Nunca é gravada em tabela, log, Storage nem devolvida
// (nem nas mensagens de erro). Só a ficha revisada vai para `conversas_fichas`.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const UUID = z.string().uuid();

async function nomeCompleto(userId: string): Promise<string> {
  const a = await adminDb();
  const { data } = await a.from("profiles").select("display_name, email").eq("id", userId).maybeSingle();
  return (data?.display_name as string | null)?.trim() || String(data?.email ?? "").split("@")[0] || "";
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] ?? "";

/** Nome mostrado nas fichas ("por Carla"): só o primeiro nome. */
async function autoresPorId(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (!ids.length) return mapa;
  const a = await adminDb();
  const { data } = await a.from("profiles").select("id, display_name, email").in("id", [...new Set(ids)]);
  for (const p of (data ?? []) as { id: string; display_name: string | null; email: string | null }[]) {
    mapa.set(p.id, primeiroNome(p.display_name?.trim() || String(p.email ?? "").split("@")[0] || "") || "Equipe");
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// Gerar a ficha (atendente na janela da retomada; Admin em "+ Enviar conversa")
// ---------------------------------------------------------------------------

export type GerarFichaResultado =
  | { ok: true; ficha: FichaGerada; uso: UsoStatus }
  | { ok: false; motivo: "limite" | "erro" | "sem_atendente" | "vazia"; mensagem: string; uso?: UsoStatus };

export const gerarFichaConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    /** Conteúdo do .txt, como lido no navegador. Só existe nesta chamada. */
    texto: z.string().max(MAX_CARACTERES_CONVERSA),
    retomada_id: UUID.nullable().default(null),
    /** Só o Admin: gerar em nome de outro atendente. */
    autor_id: UUID.nullable().default(null),
  }).parse(d))
  .handler(async ({ data, context }): Promise<GerarFichaResultado> => {
    const { statusUso, registrarUso, gerarFichaIA } = await import("@/lib/cerebro.server");
    const antes = await statusUso(context, "biblioteca");
    if (antes.bloqueado) return { ok: false, motivo: "limite", mensagem: mensagemLimite("biblioteca"), uso: antes };

    let autorId = context.userId;
    if (data.autor_id && data.autor_id !== context.userId) { await requireAdmin(context); autorId = data.autor_id; }

    // Nome da cliente na retomada (só o dono do ticket enxerga; o RLS garante).
    let nomesExtras: string[] = [];
    if (data.retomada_id) {
      const { data: r } = await db(context).from("retomadas").select("primeiro_nome").eq("id", data.retomada_id).eq("user_id", context.userId).maybeSingle();
      if (r?.primeiro_nome) nomesExtras = [String(r.primeiro_nome)];
    }

    // Lê e mascara em memória: telefone, CPF, e-mail, "Cliente <número>" -> "Cliente", nomes -> [nome].
    const conv = prepararConversaTxt(data.texto, await nomeCompleto(autorId), { trocaNome: "[nome]", nomesExtras });
    if (!conv.mensagens) return { ok: false, motivo: "vazia", mensagem: "Não achei mensagens nesse arquivo. Envie o .txt exportado da conversa." };
    if (conv.doAtendente == null || !conv.textosAtendente.length) {
      return { ok: false, motivo: "sem_atendente", mensagem: "Não consegui identificar o atendente nesse arquivo. Use a exportação da Ztalk ou do WhatsApp." };
    }

    try {
      const campos = await gerarFichaIA({ texto: conv.texto, textosAtendente: conv.textosAtendente, nomes: conv.nomesCliente });
      await registrarUso(context, "biblioteca");
      const ficha: FichaGerada = {
        ...campos,
        // (d) calculado pelas datas da conversa, nunca pela IA.
        dias_ate_fechar: diasEntre(conv.primeiraEm, conv.ultimaEm),
        fechou_em: dataISO(conv.ultimaEm),
      };
      return { ok: true, ficha, uso: calcularUso("biblioteca", antes.usado + 1, antes.limite) };
    } catch {
      // Sem detalhes do erro: poderia carregar trecho da conversa.
      return { ok: false, motivo: "erro", mensagem: ERRO_FICHA };
    }
  });

// ---------------------------------------------------------------------------
// Enviar a ficha revisada
// ---------------------------------------------------------------------------

const EnvioInput = CamposFichaSchema.extend({
  retomada_id: UUID.nullable().default(null),
  dias_ate_fechar: z.number().int().min(0).max(365).nullable().default(null),
  fechou_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  /** Só o Admin: atendente da venda. */
  autor_id: UUID.nullable().default(null),
});

export const enviarFicha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnvioInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; id: string } | { ok: false; mensagem: string }> => {
    const { autor_id, ...campos } = data;
    const eAdmin = await isAdminUser(context.supabase, context.userId);
    if (autor_id && autor_id !== context.userId && !eAdmin) throw new Error("Apenas administradores.");

    // A conversa já foi descartada, então a mensagem-chave não pode ser conferida de novo; os
    // dados pessoais e o nome da cliente da retomada, sim.
    let nomes: string[] = [];
    if (campos.retomada_id) {
      const { data: r } = await db(context).from("retomadas").select("primeiro_nome").eq("id", campos.retomada_id).eq("user_id", context.userId).maybeSingle();
      if (r?.primeiro_nome) nomes = [String(r.primeiro_nome)];
    }
    const problemas = validarFicha({ ...campos, objecao_id: campos.objecao_id }, { nomes });
    if (problemas.length) {
      return { ok: false, mensagem: "A ficha ainda tem telefone, CPF, e-mail, nome da cliente ou citação da fala dela. Tire e envie de novo." };
    }

    let objecaoId = campos.objecao_id;
    if (objecaoId) {
      const { data: o } = await db(context).from("objecoes").select("id").eq("id", objecaoId).maybeSingle();
      if (!o) objecaoId = null;
    }
    const { data: row, error } = await db(context)
      .from("conversas_fichas")
      .insert({ ...campos, objecao_id: objecaoId, autor_id: autor_id ?? context.userId, status: "enviada" })
      .select("id")
      .single();
    if (error) throw new Error("Não consegui enviar a ficha agora. Tente de novo.");
    return { ok: true, id: (row as { id: string }).id };
  });

/** Situação das fichas enviadas a partir dos tickets do atendente ("Enviada para aprovação"). */
export const getFichasDasRetomadas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, { status: string; motivo_recusa: string | null }>> => {
    const rows = check(await db(context).from("conversas_fichas").select("retomada_id, status, motivo_recusa, created_at").eq("autor_id", context.userId).not("retomada_id", "is", null).order("created_at", { ascending: false }).limit(500)) ?? [];
    const mapa: Record<string, { status: string; motivo_recusa: string | null }> = {};
    for (const r of rows as { retomada_id: string; status: string; motivo_recusa: string | null }[]) {
      if (!mapa[r.retomada_id]) mapa[r.retomada_id] = { status: r.status, motivo_recusa: r.motivo_recusa };
    }
    return mapa;
  });

// ---------------------------------------------------------------------------
// Biblioteca > Conversas que fecharam
// ---------------------------------------------------------------------------

export interface BibliotecaConversas {
  fichas: FichaBiblioteca[];
  objecoes: { id: string; nome: string }[];
}

export const getBibliotecaConversas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BibliotecaConversas> => {
    const s = db(context);
    const [fs, obs, votos] = await Promise.all([
      s.from("conversas_fichas").select("*").eq("status", "publicada").order("publicada_em", { ascending: false }).limit(500),
      s.from("objecoes").select("id, nome").eq("status", "publicada").order("prioridade").order("nome"),
      s.from("conversas_fichas_feedback").select("ficha_id, util").eq("user_id", context.userId),
    ]);
    const fichas = ((check(fs) ?? []) as Record<string, unknown>[]).map(toFicha);
    const autores = await autoresPorId(fichas.map((f) => f.autor_id));
    const meus = new Map(((check(votos) ?? []) as { ficha_id: string; util: boolean }[]).map((v) => [v.ficha_id, v.util]));
    return {
      fichas: fichas.map((f) => ({ ...f, autor: autores.get(f.autor_id) ?? "Equipe", meu_voto: meus.get(f.id) ?? null })),
      objecoes: (check(obs) ?? []) as { id: string; nome: string }[],
    };
  });

export const votarFicha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ficha_id: UUID, util: z.boolean(), motivo: z.string().trim().max(300).nullable().default(null) }).parse(d))
  .handler(async ({ data, context }) => {
    check(await db(context).from("conversas_fichas_feedback").upsert(
      { ficha_id: data.ficha_id, user_id: context.userId, util: data.util, motivo: data.util ? null : data.motivo || null },
      { onConflict: "ficha_id,user_id" },
    ));
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Casos parecidos (O cliente disse… e Copiloto): só busca por etiquetas, sem IA
// ---------------------------------------------------------------------------

export interface CasoParecido {
  id: string;
  objecao_id: string | null;
  objecao_rotulo: string;
  ponto_parada: Ponto;
  titulo: string;
  autor: string;
  plano: string;
  perfil_cliente: string;
  uma_linha: string;
}

export const getCasosParecidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    objecao_ids: z.array(UUID).max(5).default([]),
    ponto_parada: z.enum(PONTOS).nullable().default(null),
  }).parse(d))
  .handler(async ({ data, context }): Promise<CasoParecido[]> => {
    const s = db(context);
    let rows: Record<string, unknown>[] = [];
    if (data.objecao_ids.length) {
      rows = (check(await s.from("conversas_fichas").select("*").eq("status", "publicada").in("objecao_id", data.objecao_ids).order("publicada_em", { ascending: false }).limit(20)) ?? []) as Record<string, unknown>[];
    }
    if (!rows.length && data.ponto_parada) {
      rows = (check(await s.from("conversas_fichas").select("*").eq("status", "publicada").eq("ponto_parada", data.ponto_parada).order("publicada_em", { ascending: false }).limit(20)) ?? []) as Record<string, unknown>[];
    }
    // Até 2, uma por objeção quando possível (varia os casos mostrados).
    const fichas = rows.map(toFicha);
    const vistos = new Set<string>();
    const escolhidas: Ficha[] = [];
    for (const f of fichas) { const k = f.objecao_id ?? f.id; if (!vistos.has(k)) { vistos.add(k); escolhidas.push(f); } }
    for (const f of fichas) { if (escolhidas.length >= 2) break; if (!escolhidas.includes(f)) escolhidas.push(f); }
    const final = escolhidas.slice(0, 2);
    const autores = await autoresPorId(final.map((f) => f.autor_id));
    return final.map((f) => ({
      id: f.id, objecao_id: f.objecao_id, objecao_rotulo: f.objecao_rotulo, ponto_parada: f.ponto_parada,
      titulo: tituloFicha(f), autor: autores.get(f.autor_id) ?? "Equipe", plano: f.plano === "outro" ? "" : f.plano,
      perfil_cliente: f.perfil_cliente, uma_linha: f.o_que_fez[0] ?? "",
    }));
  });

// ---------------------------------------------------------------------------
// Admin: Conversas enviadas
// ---------------------------------------------------------------------------

export interface FichaAdmin extends Ficha { autor: string }

export const adminListFichas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FichaAdmin[]> => {
    await requireAdmin(context);
    const rows = check(await db(context).from("conversas_fichas").select("*").order("created_at", { ascending: false }).limit(1000)) ?? [];
    const fichas = (rows as Record<string, unknown>[]).map(toFicha);
    const autores = await autoresPorId(fichas.map((f) => f.autor_id));
    return fichas.map((f) => ({ ...f, autor: autores.get(f.autor_id) ?? "Equipe" }));
  });

export const adminListAutoresFicha = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; nome: string }[]> => {
    await requireAdmin(context);
    const a = await adminDb();
    const { data } = await a.from("profiles").select("id, display_name, email").order("display_name");
    return ((data ?? []) as { id: string; display_name: string | null; email: string | null }[])
      .map((p) => ({ id: p.id, nome: p.display_name?.trim() || String(p.email ?? "").split("@")[0] }))
      .filter((p) => p.nome);
  });

const AdminFichaInput = CamposFichaSchema.extend({
  id: UUID,
  autor_id: UUID,
  dias_ate_fechar: z.number().int().min(0).max(365).nullable().default(null),
  acao: z.enum(["salvar", "publicar", "recusar", "despublicar"]),
  motivo_recusa: z.string().trim().max(500).nullable().default(null),
});

/** Salva a edição e, conforme a ação, publica, recusa (com motivo) ou despublica. */
export const adminSalvarFicha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AdminFichaInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; ficha: Ficha } | { ok: false; mensagem: string }> => {
    await requireAdmin(context);
    const { id, acao, motivo_recusa, ...campos } = data;
    if (acao === "recusar" && !motivo_recusa) return { ok: false, mensagem: "Escreva o motivo da recusa: o atendente vai ler." };

    const problemas = validarFicha(campos, { nomes: [] });
    if (acao !== "recusar" && problemas.length) {
      return { ok: false, mensagem: "A ficha tem telefone, CPF, e-mail ou citação da fala da cliente. Tire antes de publicar." };
    }

    const agora = new Date().toISOString();
    const patch: Record<string, unknown> = { ...campos };
    if (acao === "publicar") Object.assign(patch, { status: "publicada", aprovada_por: context.userId, publicada_em: agora, motivo_recusa: null });
    else if (acao === "recusar") Object.assign(patch, { status: "recusada", motivo_recusa, publicada_em: null });
    else if (acao === "despublicar") Object.assign(patch, { status: "enviada", publicada_em: null });

    const antes = check(await db(context).from("conversas_fichas").select("status").eq("id", id).single()) as { status: string };
    const row = check(await db(context).from("conversas_fichas").update(patch).eq("id", id).select("*").single()) as Record<string, unknown>;
    const ficha = toFicha(row);

    // Aprovar e publicar cria um item em Novidades, com crédito ao autor (só na primeira publicação).
    if (acao === "publicar" && antes.status !== "publicada") {
      try {
        const autor = (await autoresPorId([ficha.autor_id])).get(ficha.autor_id) ?? "a equipe";
        check(await db(context).from("changelog_entries").insert({
          title: `Nova conversa que fechou: ${tituloFicha(ficha)}`,
          summary: `Já está na Biblioteca, em Conversas que fecharam. Crédito: ${autor}.`,
          published: true,
        }));
      } catch (err) {
        console.error("Não consegui criar o item em Novidades:", err instanceof Error ? err.message : "erro");
      }
    }
    return { ok: true, ficha };
  });

export const adminApagarFicha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("conversas_fichas").delete().eq("id", data.id));
    return { ok: true };
  });

/** Quantas fichas esperam revisão (o que precisa de você). */
export async function contarFichasNovas(supabase: unknown): Promise<{ count: number; recente: string | null }> {
  const { data, error } = await (supabase as any).from("conversas_fichas").select("created_at").eq("status", "enviada").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { count: (data ?? []).length, recente: (data?.[0]?.created_at as string | undefined) ?? null };
}

/** Voto "útil / não útil" por ficha (Admin e relatório). */
export async function votosPorFicha(supabase: unknown): Promise<Map<string, { util: number; naoUtil: number }>> {
  const { data } = await (supabase as any).from("conversas_fichas_feedback").select("ficha_id, util");
  const m = new Map<string, { util: number; naoUtil: number }>();
  for (const v of (data ?? []) as { ficha_id: string; util: boolean }[]) {
    const x = m.get(v.ficha_id) ?? { util: 0, naoUtil: 0 };
    if (v.util) x.util++; else x.naoUtil++;
    m.set(v.ficha_id, x);
  }
  return m;
}
