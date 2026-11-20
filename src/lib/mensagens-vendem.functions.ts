import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import {
  LIMITE_BAIXO_PADRAO, MIN_ENVIOS_PADRAO, VARIAVEIS_PERMITIDAS, pct, toLinha, toSugestao, variaveisOk,
  type LinhaDesempenho, type MensagensSeloBase, type SugestaoMensagem,
} from "@/lib/mensagens-vendem";
import { PONTO_CURTO, ETAPA_LABEL, type EtapaRetomada, type PontoCadencia } from "@/lib/retomada";
import { PAPEL_LABEL, type Papel } from "@/lib/retomada";

// Mensagens que vendem — funções de servidor.
//
// As contas (atribuição à "última mensagem enviada", médias da etapa e selo) rodam no banco:
// `mensagens_desempenho(p_dias)` (só Admin) e `mensagens_selo()` (qualquer pessoa logada, sem
// percentuais). Aqui só se lê o resultado, se pede a sugestão à IA e se decide (aprovar/ignorar).

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
const UUID = z.string().uuid();

// ---------------------------------------------------------------------------
// Atendente: selo e "usada N vezes pela equipe"
// ---------------------------------------------------------------------------

/** Se a migração ainda não rodou (ou der erro), devolve vazio: a tela segue sem selo. */
export const getMensagensSelo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MensagensSeloBase> => {
    const s = db(context);
    const vazio: MensagensSeloBase = { selos: {}, versoesBoas: {} };
    try {
      const [sel, boas] = await Promise.all([s.rpc("mensagens_selo"), s.rpc("mensagens_versao_boa")]);
      if (sel.error) throw new Error(sel.error.message);
      const selos: MensagensSeloBase["selos"] = {};
      for (const r of (sel.data ?? []) as { origem: string; mensagem_id: string; versao: number; envios: number; selo: string | null }[]) {
        selos[`${r.origem}:${r.mensagem_id}:${r.versao}`] = {
          envios: Number(r.envios),
          selo: r.selo === "funciona_bem" || r.selo === "vale_testar" ? r.selo : null,
        };
      }
      const versoesBoas: MensagensSeloBase["versoesBoas"] = {};
      for (const r of (boas.data ?? []) as { mensagem_id: string; versao: number; texto: string }[]) {
        versoesBoas[r.mensagem_id] = { versao: Number(r.versao), texto: r.texto };
      }
      return { selos, versoesBoas };
    } catch (err) {
      console.error("Selo das mensagens indisponível (migração pendente?):", err instanceof Error ? err.message : "erro");
      return vazio;
    }
  });

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface MensagemInfo {
  texto: string;
  versao: number;
  canal: "texto" | "audio";
  /** Fechamento: título do item. */
  titulo?: string;
  papel?: string;
}

export interface AntesDepois {
  mensagem_id: string;
  rotulo: string;
  de: { versao: number; enviadas: number; resposta: number | null; fechamento: number | null };
  para: { versao: number; enviadas: number; resposta: number | null; fechamento: number | null };
}

export interface MensagensVendemAdmin {
  dias: number | null;
  config: { min_envios: number; limite_baixo: number };
  linhas: LinhaDesempenho[];
  /** Por mensagem_id (cadência: versão atual; fechamento: o item). */
  mensagens: Record<string, MensagemInfo>;
  sugestoes: SugestaoMensagem[];
  antesDepois: AntesDepois[];
  /** Sugestões pendentes (faixa dourada). */
  pendentes: number;
}

export const adminMensagensVendem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dias: z.number().int().min(1).max(3650).nullable().default(30) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<MensagensVendemAdmin> => {
    await requireAdmin(context);
    const s = db(context);
    const [periodo, tudo, cfg, cad, itens, sug] = await Promise.all([
      s.rpc("mensagens_desempenho", { p_dias: data.dias }),
      s.rpc("mensagens_desempenho", { p_dias: null }),
      s.from("config_mensagens_vendem").select("min_envios, limite_baixo").eq("id", 1).maybeSingle(),
      s.from("cadencia_mensagens").select("id, ponto_parada, etapa, canal, papel, texto, versao, status"),
      s.from("fechamento_itens").select("id, titulo, etapa, mensagem").eq("tipo", "mensagem_etapa"),
      s.from("mensagens_sugestoes").select("*").order("created_at", { ascending: false }).limit(300),
    ]);
    const config = {
      min_envios: Number(cfg.data?.min_envios ?? MIN_ENVIOS_PADRAO),
      limite_baixo: Number(cfg.data?.limite_baixo ?? LIMITE_BAIXO_PADRAO),
    };
    const rowsPeriodo = ((check(periodo) ?? []) as Record<string, unknown>[]).map(toLinha);
    const rowsTudo = ((check(tudo) ?? []) as Record<string, unknown>[]).map(toLinha);

    const mensagens: Record<string, MensagemInfo> = {};
    const publicadas = ((check(cad) ?? []) as { id: string; ponto_parada: string; etapa: string; canal: "texto" | "audio"; papel: string; texto: string; versao: number; status: string }[])
      .filter((m) => m.status === "publicada");
    for (const m of publicadas) mensagens[m.id] = { texto: m.texto, versao: m.versao, canal: m.canal, papel: m.papel };
    for (const i of (check(itens) ?? []) as { id: string; titulo: string; mensagem: string | null }[]) {
      mensagens[i.id] = { texto: i.mensagem ?? "", versao: 1, canal: "texto", titulo: i.titulo };
    }

    // Mensagens publicadas sem nenhum envio ainda também aparecem (com zeros).
    const linhas = [...rowsPeriodo];
    for (const m of publicadas) {
      if (m.texto.trim() && m.texto.trim() !== "[escrever]" && !linhas.some((l) => l.origem === "cadencia" && l.mensagem_id === m.id && l.versao === m.versao)) {
        linhas.push({ origem: "cadencia", mensagem_id: m.id, versao: m.versao, ponto_parada: m.ponto_parada, etapa: m.etapa, enviadas: 0, responderam: 0, fecharam: 0, media_taxa: 0, selo: null });
      }
    }

    const sugestoes = ((check(sug) ?? []) as Record<string, unknown>[]).map(toSugestao);

    // Antes e depois: versão aprovada que já tem envios suficientes.
    const antesDepois: AntesDepois[] = [];
    for (const g of sugestoes.filter((x) => x.status === "aprovada" && x.versao_criada != null)) {
      const novo = rowsTudo.find((l) => l.origem === "cadencia" && l.mensagem_id === g.mensagem_id && l.versao === g.versao_criada);
      const velho = rowsTudo.find((l) => l.origem === "cadencia" && l.mensagem_id === g.mensagem_id && l.versao === g.versao_base);
      if (!novo || !velho || novo.enviadas < config.min_envios) continue;
      const num = (l: LinhaDesempenho) => ({ versao: l.versao, enviadas: l.enviadas, resposta: pct(l.responderam, l.enviadas), fechamento: pct(l.fecharam, l.enviadas) });
      antesDepois.push({ mensagem_id: g.mensagem_id, rotulo: `${PONTO_CURTO[novo.ponto_parada as PontoCadencia] ?? novo.ponto_parada} · ${ETAPA_LABEL[novo.etapa as EtapaRetomada] ?? novo.etapa}`, de: num(velho), para: num(novo) });
    }

    return { dias: data.dias, config, linhas, mensagens, sugestoes, antesDepois, pendentes: sugestoes.filter((x) => x.status === "pendente").length };
  });

export const adminSalvarRegrasSelo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ min_envios: z.number().int().min(1).max(10000), limite_baixo: z.number().min(0.05).max(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("config_mensagens_vendem").upsert({ id: 1, ...data, updated_at: new Date().toISOString(), updated_by: context.userId }, { onConflict: "id" }));
    return { ok: true };
  });

/** Aprovar (com o texto editado ou não) cria a versão seguinte em `cadencia_mensagens`; o gatilho do
 * banco guarda a anterior em `cadencia_mensagens_versoes`. Ignorar marca e não sugere de novo a mesma versão. */
export const adminDecidirSugestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.discriminatedUnion("acao", [
    z.object({ acao: z.literal("aprovar"), id: UUID, texto: z.string().trim().min(1).max(4000) }),
    z.object({ acao: z.literal("ignorar"), id: UUID }),
  ]).parse(d))
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

    const msg = check(await s.from("cadencia_mensagens").select("id, versao, texto, status").eq("id", sug.mensagem_id).single()) as { id: string; versao: number; texto: string; status: string };
    if (msg.versao !== sug.versao_base) return { ok: false, mensagem: "A mensagem mudou depois desta sugestão. Ignore e espere a próxima." };
    const v = variaveisOk(msg.texto, data.texto);
    if (v.desconhecidas.length) return { ok: false, mensagem: `Variável desconhecida: ${v.desconhecidas.map((x) => `{${x}}`).join(" ")}. Use só ${VARIAVEIS_PERMITIDAS.map((x) => `{${x}}`).join(" ")}.` };

    const nova = check(await s.from("cadencia_mensagens").update({ texto: data.texto }).eq("id", msg.id).select("versao").single()) as { versao: number };
    check(await s.from("mensagens_sugestoes").update({ status: "aprovada", decidido_por: context.userId, decidido_em: agora, versao_criada: nova.versao }).eq("id", sug.id));
    return { ok: true, versao: nova.versao };
  });

/** Roda ao abrir o Admin, no máximo a cada 6 horas: para cada mensagem da cadência com selo
 * "Vale testar outra" (na versão atual) e sem sugestão para essa versão, pede uma nova versão à IA. */
export const verificarMensagensAbaixoDoEsperado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rodou: boolean; novas: number }> => {
    await requireAdmin(context);
    const s = db(context);
    const agora = new Date();
    const limite = new Date(agora.getTime() - 6 * 3600_000).toISOString();

    // "Trava" de 6 horas: só uma pessoa/aba ganha o direito de rodar.
    const trava = await s.from("config_mensagens_vendem").update({ ultima_verificacao: agora.toISOString() }).eq("id", 1).or(`ultima_verificacao.is.null,ultima_verificacao.lt.${limite}`).select("id");
    if (trava.error || !(trava.data ?? []).length) return { rodou: false, novas: 0 };

    const { sugerirNovaVersaoMensagem, registrarUso } = await import("@/lib/cerebro.server");
    const desemp = ((check(await s.rpc("mensagens_desempenho", { p_dias: null })) ?? []) as Record<string, unknown>[]).map(toLinha)
      .filter((l) => l.origem === "cadencia" && l.selo === "vale_testar");
    if (!desemp.length) return { rodou: true, novas: 0 };

    const ids = [...new Set(desemp.map((l) => l.mensagem_id))];
    const [msgs, existentes] = await Promise.all([
      s.from("cadencia_mensagens").select("id, ponto_parada, etapa, canal, papel, texto, por_que, versao, status").in("id", ids),
      s.from("mensagens_sugestoes").select("mensagem_id, versao_base").in("mensagem_id", ids),
    ]);
    const ja = new Set(((check(existentes) ?? []) as { mensagem_id: string; versao_base: number }[]).map((e) => `${e.mensagem_id}:${e.versao_base}`));
    let novas = 0;
    for (const m of (check(msgs) ?? []) as { id: string; ponto_parada: string; etapa: string; canal: "texto" | "audio"; papel: string; texto: string; por_que: string; versao: number; status: string }[]) {
      if (novas >= 5) break; // limita a conta de IA por rodada
      const linha = desemp.find((l) => l.mensagem_id === m.id && l.versao === m.versao);
      if (!linha || m.status !== "publicada" || !m.texto.trim() || m.texto.trim() === "[escrever]" || ja.has(`${m.id}:${m.versao}`)) continue;
      const r = await sugerirNovaVersaoMensagem({
        texto: m.texto,
        contexto: `${PONTO_CURTO[m.ponto_parada as PontoCadencia] ?? m.ponto_parada}, ${ETAPA_LABEL[m.etapa as EtapaRetomada] ?? m.etapa}`,
        papel: PAPEL_LABEL[m.papel as Papel] ?? m.papel,
        canal: m.canal,
        porQue: m.por_que,
        taxaResposta: pct(linha.responderam, linha.enviadas),
        mediaEtapa: linha.media_taxa,
      });
      if (!r) continue;
      const ins = await s.from("mensagens_sugestoes").insert({ mensagem_id: m.id, versao_base: m.versao, texto_sugerido: r.texto, por_que_mudar: r.por_que_mudar });
      if (ins.error) continue; // outra aba pode ter inserido primeiro (UNIQUE)
      await registrarUso(context, "retomada");
      novas++;
    }
    return { rodou: true, novas };
  });
