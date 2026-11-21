import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import { diaBR, inicioDiaBR, somarDias } from "@/lib/retomada";
import { limparTextoExport, type AquecimentoLinha, type DadosInteligencia, type MapaDominioLinha, type RaioxLinha, type UsoLinha } from "@/lib/inteligencia-relatorio";
import { CONFIG_AQUECIMENTO_PADRAO, calcularNivel } from "@/lib/aquecimento";

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

    // Aquecimento e Mapa de domínio. Se a migração do bloco 2 ainda não rodou, o relatório sai sem essas abas.
    const aq = await lerAquecimento(s, { ini, fim, filtroUser, equipeToda: equipe && !data.atendente_id, ehAdmin, userId: context.userId });

    const ids = [...new Set([context.userId, ...brutoRaiox.map((r) => r.user_id), ...brutoUso.map((u) => u.user_id), ...(aq?.usuarios ?? [])])];
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
      ...(aq ? { aquecimento: aq.linhas, mapa: aq.mapa, aquecimentoConfig: aq.config } : {}),
      funil: ((funil.data ?? []) as { etapa: string; nome: string; definicao: string | null; sinais: string[] | null }[])
        .map((f) => ({ etapa: f.etapa, nome: f.nome, definicao: f.definicao ?? "", sinais: f.sinais ?? [] })),
      blocosCerebro: (blocos.data ?? []) as { chave: string; titulo: string }[],
    };
  });

/** Respostas do aquecimento no período e nível por tema (janela de domínio terminada no fim do período).
 * Só acerto e nota: o texto digitado nunca foi guardado. O atendente só lê as próprias linhas (RLS e filtro). */
async function lerAquecimento(
  s: any,
  o: { ini: string; fim: string; filtroUser: string | null; equipeToda: boolean; ehAdmin: boolean; userId: string },
): Promise<{ linhas: AquecimentoLinha[]; mapa: MapaDominioLinha[]; usuarios: string[]; config: NonNullable<DadosInteligencia["aquecimentoConfig"]> } | null> {
  try {
    const cfgR = await s.from("aquecimento_config").select("nota_acerto, janela_dominio_dias, min_respostas, limiar_dominando").eq("id", 1).maybeSingle();
    if (cfgR.error) throw new Error(cfgR.error.message);
    const cfg = {
      nota_acerto: Number(cfgR.data?.nota_acerto ?? CONFIG_AQUECIMENTO_PADRAO.nota_acerto),
      janela_dominio_dias: Number(cfgR.data?.janela_dominio_dias ?? CONFIG_AQUECIMENTO_PADRAO.janela_dominio_dias),
      min_respostas: Number(cfgR.data?.min_respostas ?? CONFIG_AQUECIMENTO_PADRAO.min_respostas),
      limiar_dominando: Number(cfgR.data?.limiar_dominando ?? CONFIG_AQUECIMENTO_PADRAO.limiar_dominando),
    };
    const janelaIni = new Date(new Date(o.fim).getTime() - cfg.janela_dominio_dias * 86400_000).toISOString();
    const de = janelaIni < o.ini ? janelaIni : o.ini;

    const brutas = await lerTudo<{ sessao_id: string; user_id: string; tema_id: string | null; tipo: string; acertou: boolean; nota: number | null; created_at: string }>((a, b) => {
      let q = s.from("aquecimento_respostas").select("sessao_id, user_id, tema_id, tipo, acertou, nota, created_at")
        .gte("created_at", de).lt("created_at", o.fim).order("created_at").order("id").range(a, b);
      if (o.filtroUser) q = q.eq("user_id", o.filtroUser);
      return q;
    });
    const temasR = check(await s.from("dominio_temas").select("id, nome, ativo, ordem").order("ordem")) as { id: string; nome: string; ativo: boolean }[];
    const nomeTema = new Map(temasR.map((t) => [t.id, t.nome]));

    const noPeriodo = brutas.filter((r) => r.created_at >= o.ini);
    const sessIds = [...new Set(noPeriodo.map((r) => r.sessao_id))];
    const tipoSessao = new Map<string, string>();
    for (let i = 0; i < sessIds.length; i += 200) {
      const rows = check(await s.from("aquecimento_sessoes").select("id, tipo").in("id", sessIds.slice(i, i + 200))) as { id: string; tipo: string }[];
      for (const r of rows ?? []) tipoSessao.set(r.id, r.tipo);
    }
    const linhas: AquecimentoLinha[] = noPeriodo.map((r) => ({
      data_hora: r.created_at, user_id: r.user_id, tema: r.tema_id ? nomeTema.get(r.tema_id) ?? "" : "", tipo_cartao: r.tipo,
      tipo_sessao: tipoSessao.get(r.sessao_id) ?? "diaria", acertou: r.acertou, nota: r.nota,
    }));

    // Quem entra no mapa: a equipe toda (Admin sem filtro) ou só a pessoa filtrada / o próprio atendente.
    let usuarios: string[];
    if (o.equipeToda) {
      const [perfis, admins] = await Promise.all([s.from("profiles").select("id"), s.from("user_roles").select("user_id").eq("role", "admin")]);
      const adm = new Set(((check(admins) ?? []) as { user_id: string }[]).map((r) => r.user_id));
      usuarios = ((check(perfis) ?? []) as { id: string }[]).map((p) => p.id).filter((id) => !adm.has(id));
    } else {
      usuarios = [o.filtroUser ?? o.userId];
    }
    usuarios = [...new Set([...usuarios, ...brutas.map((r) => r.user_id)])];

    const ativos = temasR.filter((t) => t.ativo);
    const noJanela = brutas.filter((r) => r.created_at >= janelaIni);
    const mapa: MapaDominioLinha[] = [];
    for (const u of usuarios) {
      for (const t of ativos) {
        const rs = noJanela.filter((r) => r.user_id === u && r.tema_id === t.id);
        const acertos = rs.filter((r) => r.acertou).length;
        mapa.push({ user_id: u, tema: t.nome, nivel: calcularNivel(rs.length, acertos, cfg), respostas: rs.length, acertos });
      }
    }
    return { linhas, mapa, usuarios, config: cfg };
  } catch (err) {
    console.error("Aquecimento indisponível no relatório (migração pendente?):", err);
    return null;
  }
}

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
