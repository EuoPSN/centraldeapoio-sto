import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CONFIG_AQUECIMENTO_PADRAO, type Nivel } from "@/lib/aquecimento";

// Meu mapa: o nível de cada tema vem de `aquecimento_meu_mapa()` (SECURITY DEFINER, só
// devolve os dados de quem chama). Só conta o aquecimento: as avaliações do Simulador
// (simulator_results) não têm tema nem objeção ligados, então não entram no cálculo.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;

export interface TemaMapa {
  tema_id: string;
  nome: string;
  descricao: string;
  respostas: number;
  acertos: number;
  nivel: Nivel;
}
export interface MeuMapa {
  temas: TemaMapa[];
  janela_dias: number;
  min_respostas: number;
}

export const getMeuMapa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeuMapa> => {
    const s = db(context);
    const [mapa, temas, cfg] = await Promise.all([
      s.rpc("aquecimento_meu_mapa"),
      s.from("dominio_temas").select("id, nome, descricao, ordem").eq("ativo", true).order("ordem"),
      s.from("aquecimento_config").select("janela_dominio_dias, min_respostas").eq("id", 1).maybeSingle(),
    ]);
    if (mapa.error) throw new Error(mapa.error.message);
    if (temas.error) throw new Error(temas.error.message);
    const por = new Map(((mapa.data ?? []) as { tema_id: string; respostas: number; acertos: number; nivel: Nivel }[]).map((m) => [m.tema_id, m]));
    return {
      temas: ((temas.data ?? []) as { id: string; nome: string; descricao: string }[]).map((t) => {
        const m = por.get(t.id);
        return { tema_id: t.id, nome: t.nome, descricao: t.descricao, respostas: m?.respostas ?? 0, acertos: m?.acertos ?? 0, nivel: m?.nivel ?? "nao_testado" };
      }),
      janela_dias: Number(cfg.data?.janela_dominio_dias ?? CONFIG_AQUECIMENTO_PADRAO.janela_dominio_dias),
      min_respostas: Number(cfg.data?.min_respostas ?? CONFIG_AQUECIMENTO_PADRAO.min_respostas),
    };
  });
