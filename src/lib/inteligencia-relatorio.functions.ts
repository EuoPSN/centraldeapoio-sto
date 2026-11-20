import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import { diaBR, inicioDiaBR, somarDias } from "@/lib/retomada";
import { limparTextoExport, type DadosInteligencia, type RaioxLinha, type UsoLinha } from "@/lib/inteligencia-relatorio";

// Relatório Excel da Inteligência: dados do Raio-X e do uso das IAs.
//
// Atendente: só os próprios dados (filtro por user_id aqui e RLS no banco).
// Admin: equipe toda ou um atendente. O servidor já devolve os textos limpos e só os
// campos permitidos: onde_perdeu, a explicação das técnicas e a descrição do hábito
// nunca saem daqui. Telefone, e-mail e nome do cliente nunca são selecionados.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

const MAX_DIAS = 90;
const PAGINA = 1000;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** PostgREST devolve no máximo 1000 linhas por consulta: lê em páginas. */
async function lerTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < 100; i++) {
    const rows = check(await consulta(i * PAGINA, i * PAGINA + PAGINA - 1)) ?? [];
    out.push(...rows);
    if (rows.length < PAGINA) break;
  }
  return out;
}

const nomeDe = (p: { display_name: string | null; email: string | null }) =>
  p.display_name?.trim() || String(p.email ?? "").split("@")[0] || "Sem nome";

export const getDadosInteligencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    de: z.string().regex(DIA),
    ate: z.string().regex(DIA),
    atendente_id: z.string().uuid().nullish(),
    equipe: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }): Promise<DadosInteligencia> => {
    if (data.de > data.ate) throw new Error("A data inicial vem depois da final.");
    if (somarDias(data.de, MAX_DIAS - 1) < data.ate) throw new Error(`O período máximo é de ${MAX_DIAS} dias.`);
    const hoje = diaBR(new Date());
    if (data.ate > hoje) throw new Error("A data final não pode ser no futuro.");

    const s = db(context);
    const ehAdmin = await isAdminUser(context.supabase, context.userId);
    const equipe = data.equipe && ehAdmin;
    // Atendente (ou Admin sem escopo de equipe): sempre e só o próprio id, ignorando qualquer filtro enviado.
    const filtroUser = equipe ? (data.atendente_id ?? null) : context.userId;
    const ini = inicioDiaBR(data.de).toISOString();
    const fim = inicioDiaBR(somarDias(data.ate, 1)).toISOString();

    // Raio-X: só colunas permitidas; onde_perdeu NÃO é lido.
    const brutoRaiox = await lerTudo<{
      user_id: string; retomada_id: string | null; etapa: string | null; faltou: unknown; reescrita: unknown; escrita: unknown; habito: unknown; created_at: string;
    }>((a, b) => {
      let q = s.from("raiox_resultados").select("user_id, retomada_id, etapa, faltou, reescrita, escrita, habito, created_at")
        .gte("created_at", ini).lt("created_at", fim).order("created_at").order("id").range(a, b);
      if (filtroUser) q = q.eq("user_id", filtroUser);
      return q;
    });

    // Uso das IAs (só quem usou qual ferramenta e quando).
    const brutoUso = await lerTudo<{ user_id: string; ferramenta: string; created_at: string }>((a, b) => {
      let q = s.from("ia_uso").select("user_id, ferramenta, created_at").gte("created_at", ini).lt("created_at", fim).order("created_at").order("id").range(a, b);
      if (filtroUser) q = q.eq("user_id", filtroUser);
      return q;
    });

    const ids = [...new Set([context.userId, ...brutoRaiox.map((r) => r.user_id), ...brutoUso.map((u) => u.user_id)])];
    const atendentes: Record<string, string> = {};
    if (ids.length) {
      const perfis = check(await s.from("profiles").select("id, display_name, email").in("id", ids)) as { id: string; display_name: string | null; email: string | null }[];
      for (const p of perfis ?? []) atendentes[p.id] = nomeDe(p);
    }

    // Primeiro nome dos clientes dos tickets ligados: usado só para limpar o texto, nunca exportado.
    const nomeCliente = new Map<string, string>();
    const retIds = [...new Set(brutoRaiox.map((r) => r.retomada_id).filter(Boolean))] as string[];
    for (let i = 0; i < retIds.length; i += 200) {
      const rows = check(await s.from(equipe ? "retomadas_admin" : "retomadas").select("id, primeiro_nome").in("id", retIds.slice(i, i + 200))) as { id: string; primeiro_nome: string | null }[];
      for (const r of rows ?? []) if (r.primeiro_nome) nomeCliente.set(r.id, r.primeiro_nome);
    }

    const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const txt = (v: unknown) => (typeof v === "string" ? v : "");
    const raiox: RaioxLinha[] = brutoRaiox.map((r) => {
      const nome = r.retomada_id ? nomeCliente.get(r.retomada_id) : null;
      const rw = (r.reescrita ?? {}) as { original?: string; sugerida?: string };
      const hb = (r.habito ?? {}) as { titulo?: string };
      return {
        data_hora: r.created_at,
        user_id: r.user_id,
        etapa: r.etapa,
        tecnicas: arr<{ tecnica?: string }>(r.faltou).map((f) => txt(f?.tecnica)).filter(Boolean),
        reescrita_original: limparTextoExport(txt(rw.original), nome),
        reescrita_sugerida: limparTextoExport(txt(rw.sugerida), nome),
        erros: arr<{ errado?: string; certo?: string; regra?: string }>(r.escrita).map((e) => ({
          errado: limparTextoExport(txt(e?.errado), nome), certo: limparTextoExport(txt(e?.certo), nome), regra: txt(e?.regra),
        })),
        habito: limparTextoExport(txt(hb.titulo), nome),
        veio_de_retomada: !!r.retomada_id,
      };
    });

    // Limite diário: ia_limites (hoje) + extras do Admin válidos no dia. Admin não tem limite.
    const uso = await montarUso(s, brutoUso, ehAdmin);

    const a = await adminClient();
    const [funil, blocos] = await Promise.all([
      a.from("funil_etapas").select("etapa, nome, definicao, sinais, ordem").order("ordem"),
      a.from("cerebro_blocos").select("chave, titulo").eq("ativo", true),
    ]);
    return {
      de: data.de, ate: data.ate, escopo: equipe ? "equipe" : "atendente",
      exportadoPor: atendentes[context.userId] ?? "",
      exportadoEm: new Date().toISOString(),
      atendentes, raiox, uso,
      funil: ((funil.data ?? []) as { etapa: string; nome: string; definicao: string | null; sinais: string[] | null }[])
        .map((f) => ({ etapa: f.etapa, nome: f.nome, definicao: f.definicao ?? "", sinais: f.sinais ?? [] })),
      blocosCerebro: (blocos.data ?? []) as { chave: string; titulo: string }[],
    };
  });

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function montarUso(s: any, bruto: { user_id: string; ferramenta: string; created_at: string }[], ehAdmin: boolean): Promise<UsoLinha[]> {
  if (!bruto.length) return [];
  const porChave = new Map<string, UsoLinha>();
  for (const u of bruto) {
    const dia = diaBR(u.created_at);
    const k = `${dia}|${u.user_id}|${u.ferramenta}`;
    const atual = porChave.get(k) ?? porChave.set(k, { dia, user_id: u.user_id, ferramenta: u.ferramenta, quantidade: 0, limite_diario: null }).get(k)!;
    atual.quantidade++;
  }
  const linhas = [...porChave.values()];
  try {
    const usuarios = [...new Set(linhas.map((l) => l.user_id))];
    const dias = linhas.map((l) => l.dia).sort();
    const iniPeriodo = inicioDiaBR(dias[0]).toISOString();
    const [lim, extras, admins] = await Promise.all([
      s.from("ia_limites").select("ferramenta, limite_diario"),
      s.from("ia_limites_extra").select("user_id, ferramenta, extra, valido_ate, created_at").in("user_id", usuarios).gte("valido_ate", iniPeriodo),
      ehAdmin ? s.from("user_roles").select("user_id").eq("role", "admin").in("user_id", usuarios) : Promise.resolve({ data: [] }),
    ]);
    if (lim.error || extras.error) throw new Error(lim.error?.message ?? extras.error?.message);
    const base = new Map(((lim.data ?? []) as { ferramenta: string; limite_diario: number | null }[]).map((l) => [l.ferramenta, l.limite_diario]));
    const donosAdmin = new Set(((admins.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const ex = (extras.data ?? []) as { user_id: string; ferramenta: string; extra: number; valido_ate: string; created_at: string }[];
    for (const l of linhas) {
      const b = base.get(l.ferramenta);
      if (b == null || donosAdmin.has(l.user_id)) continue;
      const ini = inicioDiaBR(l.dia).getTime();
      const fimDia = inicioDiaBR(somarDias(l.dia, 1)).getTime();
      const soma = ex
        .filter((x) => x.user_id === l.user_id && x.ferramenta === l.ferramenta && new Date(x.created_at).getTime() < fimDia && new Date(x.valido_ate).getTime() >= ini)
        .reduce((acc, x) => acc + x.extra, 0);
      l.limite_diario = b + soma;
    }
  } catch (err) {
    console.error("Limites de uso indisponíveis; relatório sem limite_diario:", err);
  }
  return linhas;
}

/** Lista de atendentes para o filtro do Admin. */
export const adminListAtendentesInteligencia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const rows = check(await db(context).from("profiles").select("id, display_name, email")) as { id: string; display_name: string | null; email: string | null }[];
    return (rows ?? []).map((p) => ({ id: p.id, nome: nomeDe(p) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });
