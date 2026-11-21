import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import { removerDadosPessoais } from "@/lib/cliente-disse";
import {
  CONFIG_PADRAO, conferirVariaveis, toLinhaDesempenho, toSugestao,
  type ConfigMensagensVendem, type LinhaDesempenho, type SeloMensagem, type SugestaoMensagem, type VersaoAnterior,
} from "@/lib/mensagens-vendem";

// "Mensagens que vendem" — funções de servidor.
//
// O atendente só recebe o selo e a contagem de uso da equipe (`mensagens_selo()`), nunca
// percentuais nem dados de outros atendentes. O Admin lê `mensagens_desempenho()`.
// Tudo calculado no banco (SECURITY DEFINER, papel conferido dentro da função).

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

async function lerConfig(ctx: Ctx): Promise<ConfigMensagensVendem> {
  const { data } = await db(ctx).from("config_mensagens_vendem").select("min_envios, limite_baixo").eq("id", 1).maybeSingle();
  return data ? { min_envios: Number(data.min_envios), limite_baixo: Number(data.limite_baixo) } : CONFIG_PADRAO;
}

// ---------------------------------------------------------------------------
// Atendente: selo e versão anterior
// ---------------------------------------------------------------------------

export interface MensagensSelo {
  selos: SeloMensagem[];
  anteriores: VersaoAnterior[];
  min_envios: number;
}

export const getMensagensSelo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MensagensSelo> => {
    const s = db(context);
    // Migração pendente ou erro: a página segue sem selo.
    const [sel, ant, cfg] = await Promise.all([
      s.rpc("mensagens_selo"),
      s.rpc("mensagens_versao_anterior"),
      lerConfig(context),
    ]);
    if (sel.error) console.error("Selo das mensagens indisponível:", sel.error.message);
    return {
      selos: ((sel.data ?? []) as Record<string, unknown>[]).map((r) => ({
        origem: r.origem === "fechamento" ? "fechamento" : "cadencia",
        mensagem_id: String(r.mensagem_id),
        versao: r.versao == null ? null : Number(r.versao),
        envios: Number(r.envios ?? 0),
        selo: r.selo === "funciona_bem" || r.selo === "vale_testar_outra" ? r.selo : null,
      })),
      anteriores: ant.error ? [] : ((ant.data ?? []) as VersaoAnterior[]),
      min_envios: cfg.min_envios,
    };
  });

// ---------------------------------------------------------------------------
// Admin: painel "Mensagens que vendem"
// ---------------------------------------------------------------------------

export interface TextoVersao { mensagem_id: string; versao: number; texto: string; ponto_parada: string; etapa: string; canal: string; atual: boolean }

export interface MensagensVendemAdmin {
  /** Linhas do período escolhido. */
  linhas: LinhaDesempenho[];
  /** Linhas desde o começo (para o antes e depois). */
  linhasTotais: LinhaDesempenho[];
  sugestoes: SugestaoMensagem[];
  textos: TextoVersao[];
  config: ConfigMensagensVendem;
}

export const adminMensagensVendem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ periodo_dias: z.number().int().min(1).max(3650).nullable().default(null) }).parse(d))
  .handler(async ({ data, context }): Promise<MensagensVendemAdmin> => {
    await requireAdmin(context);
    const s = db(context);
    const [per, tot, sug, cfg] = await Promise.all([
      s.rpc("mensagens_desempenho", { periodo_dias: data.periodo_dias }),
      data.periodo_dias == null ? Promise.resolve(null) : s.rpc("mensagens_desempenho", { periodo_dias: null }),
      s.from("mensagens_sugestoes").select("*").order("created_at", { ascending: false }).limit(500),
      lerConfig(context),
    ]);
    const linhas = ((check(per) ?? []) as Record<string, unknown>[]).map(toLinhaDesempenho);
    const linhasTotais = tot ? ((check(tot) ?? []) as Record<string, unknown>[]).map(toLinhaDesempenho) : linhas;

    const ids = [...new Set(linhasTotais.filter((l) => l.origem === "cadencia").map((l) => l.mensagem_id))];
    const textos: TextoVersao[] = [];
    if (ids.length) {
      const [atuais, vers] = await Promise.all([
        s.from("cadencia_mensagens").select("id, versao, texto, ponto_parada, etapa, canal").in("id", ids),
        s.from("cadencia_mensagens_versoes").select("mensagem_id, versao, texto, ponto_parada, etapa, canal").in("mensagem_id", ids),
      ]);
      for (const r of (check(atuais) ?? []) as Record<string, unknown>[]) {
        textos.push({ mensagem_id: String(r.id), versao: Number(r.versao), texto: String(r.texto), ponto_parada: String(r.ponto_parada), etapa: String(r.etapa), canal: String(r.canal), atual: true });
      }
      for (const r of (check(vers) ?? []) as Record<string, unknown>[]) {
        textos.push({ mensagem_id: String(r.mensagem_id), versao: Number(r.versao), texto: String(r.texto), ponto_parada: String(r.ponto_parada), etapa: String(r.etapa), canal: String(r.canal), atual: false });
      }
    }
    return { linhas, linhasTotais, sugestoes: ((check(sug) ?? []) as Record<string, unknown>[]).map(toSugestao), textos, config: cfg };
  });

export const adminSalvarConfigMensagens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    min_envios: z.number().int().min(1).max(1000),
    limite_baixo: z.number().min(0.1).max(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("config_mensagens_vendem").upsert({ id: 1, ...data }, { onConflict: "id" }));
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Sugestões da IA
// ---------------------------------------------------------------------------

const MAX_SUGESTOES_POR_VERIFICACAO = 5;

/** Roda ao abrir o Admin (no máximo a cada 6 horas): para cada mensagem publicada com selo
 * "Vale testar outra" e sem sugestão para a versão atual, pede à IA uma nova versão. */
export const verificarMensagensAbaixoDoEsperado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rodou: boolean; criadas: number }> => {
    await requireAdmin(context);
    const s = db(context);

    // "Reserva" a vez: só um Admin por janela de 6 horas passa daqui.
    const corte = new Date(Date.now() - 6 * 3600_000).toISOString();
    await s.from("config_mensagens_vendem").upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });
    const claim = await s.from("config_mensagens_vendem")
      .update({ ultima_verificacao: new Date().toISOString() })
      .eq("id", 1).or(`ultima_verificacao.is.null,ultima_verificacao.lt.${corte}`).select("id");
    if (claim.error || !(claim.data ?? []).length) return { rodou: false, criadas: 0 };

    const linhas = ((check(await s.rpc("mensagens_desempenho", { periodo_dias: null })) ?? []) as Record<string, unknown>[]).map(toLinhaDesempenho);
    const abaixo = linhas.filter((l) => l.origem === "cadencia" && l.selo === "vale_testar_outra" && l.versao != null);
    if (!abaixo.length) return { rodou: true, criadas: 0 };

    const ids = [...new Set(abaixo.map((l) => l.mensagem_id))];
    const [msgs, existentes] = await Promise.all([
      s.from("cadencia_mensagens").select("id, versao, texto, ponto_parada, etapa, canal, papel, status").in("id", ids),
      s.from("mensagens_sugestoes").select("mensagem_id, versao_base").in("mensagem_id", ids),
    ]);
    const jaTem = new Set(((existentes.data ?? []) as { mensagem_id: string; versao_base: number }[]).map((x) => `${x.mensagem_id}:${x.versao_base}`));
    const porId = new Map(((check(msgs) ?? []) as Record<string, any>[]).map((m) => [String(m.id), m]));

    const { sugerirNovaVersao } = await import("@/lib/mensagens-vendem.server");
    let criadas = 0;
    for (const l of abaixo) {
      if (criadas >= MAX_SUGESTOES_POR_VERIFICACAO) break;
      const m = porId.get(l.mensagem_id);
      // Só a versão atual e publicada; nunca de novo para a mesma versão.
      if (!m || m.status !== "publicada" || Number(m.versao) !== l.versao || jaTem.has(`${l.mensagem_id}:${l.versao}`)) continue;
      if (!String(m.texto).trim() || String(m.texto).trim().toLowerCase() === "[escrever]") continue;
      try {
        const r = await sugerirNovaVersao(context, {
          texto: String(m.texto), ponto: String(m.ponto_parada), etapa: String(m.etapa), canal: String(m.canal), papel: String(m.papel),
          taxaResposta: l.enviadas ? (l.responderam ?? 0) / l.enviadas : 0, mediaEtapa: l.media_resposta ?? 0, envios: l.enviadas,
        });
        if (!r) continue;
        const ins = await s.from("mensagens_sugestoes").insert({
          mensagem_id: l.mensagem_id, versao_base: l.versao, texto_sugerido: r.texto, por_que_mudar: r.por_que,
        });
        if (!ins.error) criadas++;
      } catch (err) {
        console.error("Sugestão de nova versão falhou:", err instanceof Error ? err.message : "erro");
      }
    }
    return { rodou: true, criadas };
  });

/** Aprovar (cria a versão seguinte em cadencia_mensagens, guardando a anterior em cadencia_mensagens_versoes
 * pelo gatilho do banco) ou ignorar (não sugere de novo para a mesma versão). */
export const adminDecidirSugestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: UUID,
    acao: z.enum(["aprovar", "ignorar"]),
    texto: z.string().trim().min(1).max(4000).optional(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; versao?: number } | { ok: false; mensagem: string }> => {
    await requireAdmin(context);
    const s = db(context);
    const sug = toSugestao(check(await s.from("mensagens_sugestoes").select("*").eq("id", data.id).single()) as Record<string, unknown>);
    if (sug.status !== "pendente") return { ok: false, mensagem: "Esta sugestão já foi decidida." };
    const agora = new Date().toISOString();

    if (data.acao === "ignorar") {
      check(await s.from("mensagens_sugestoes").update({ status: "ignorada", decidido_por: context.userId, decidido_em: agora }).eq("id", sug.id));
      return { ok: true };
    }

    const atual = check(await s.from("cadencia_mensagens").select("id, versao, texto, status").eq("id", sug.mensagem_id).single()) as { id: string; versao: number; texto: string; status: string };
    if (atual.status !== "publicada" || atual.versao !== sug.versao_base) {
      return { ok: false, mensagem: "A mensagem mudou depois desta sugestão. Ignore e espere a próxima verificação." };
    }
    const texto = (data.texto ?? sug.texto_sugerido).trim();
    const problema = conferirVariaveis(atual.texto, texto);
    if (problema) return { ok: false, mensagem: `Revise o texto: ${problema}.` };
    if (removerDadosPessoais(texto) !== texto) return { ok: false, mensagem: "O texto tem telefone, CPF ou e-mail." };
    if (/n[ãa]o [ée] plano de sa[úu]de/i.test(texto)) return { ok: false, mensagem: "Não escreva “não é plano de saúde”." };

    const novo = check(await s.from("cadencia_mensagens").update({ texto }).eq("id", atual.id).select("versao").single()) as { versao: number };
    check(await s.from("mensagens_sugestoes").update({
      status: "aprovada", versao_criada: novo.versao, decidido_por: context.userId, decidido_em: agora,
    }).eq("id", sug.id));
    return { ok: true, versao: novo.versao };
  });

/** Pendência do Admin: mensagens abaixo do esperado com sugestão esperando decisão. */
export async function contarSugestoesPendentes(supabase: unknown): Promise<number> {
  const { count, error } = await (supabase as any).from("mensagens_sugestoes").select("id", { count: "exact", head: true }).eq("status", "pendente");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
