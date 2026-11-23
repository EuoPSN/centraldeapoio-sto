// Comparativo "60 dias antes × 60 dias depois" da extensão, por atendente (só o Admin vê).
// Compara as vendas do CRM (crm_fechamentos) por semana antes e depois da data de início.
import { somarDias } from "@/lib/retomada";

export const JANELA_DIAS = 60;

export interface Cobertura { min: string | null; max: string | null }
export interface Janela { ini: string; fim: string; diasComDados: number; vendas: number; porSemana: number | null }

export interface ResultadoAntesDepois {
  inicio: string;
  antes: Janela;
  depois: Janela;
  /** Dias que ainda faltam para completar 60 (por falta de dados do CRM ou porque o período ainda não passou). */
  faltamAntes: number;
  faltamDepois: number;
  /** Variação % das vendas por semana (depois sobre antes). Nulo se não der para comparar. */
  variacaoPct: number | null;
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400_000);

function janela(ini: string, fim: string, hoje: string, cob: Cobertura, vendasPorDia: Record<string, number>): Janela {
  const f = fim > hoje ? hoje : fim;
  let dias = 0, vendas = 0;
  if (cob.min && cob.max && f >= ini) {
    const a = ini > cob.min ? ini : cob.min;
    const b = f < cob.max ? f : cob.max;
    dias = b >= a ? diasEntre(a, b) + 1 : 0;
    for (const [dia, n] of Object.entries(vendasPorDia)) if (dia >= ini && dia <= f) vendas += n;
  }
  return { ini, fim: f, diasComDados: dias, vendas, porSemana: dias > 0 ? Math.round((vendas / (dias / 7)) * 10) / 10 : null };
}

/** `vendasPorDia`: vendas do atendente por dia (AAAA-MM-DD). `cobertura`: primeiro e último dia com planilha enviada (de toda a equipe). */
export function compararAntesDepois(a: { inicio: string; hoje: string; vendasPorDia: Record<string, number>; cobertura: Cobertura }): ResultadoAntesDepois {
  const { inicio, hoje, vendasPorDia, cobertura } = a;
  const antes = janela(somarDias(inicio, -JANELA_DIAS), somarDias(inicio, -1), hoje, cobertura, vendasPorDia);
  const depois = janela(inicio, somarDias(inicio, JANELA_DIAS - 1), hoje, cobertura, vendasPorDia);
  const variacaoPct = antes.porSemana != null && depois.porSemana != null && antes.porSemana > 0
    ? Math.round(((depois.porSemana - antes.porSemana) / antes.porSemana) * 100) : null;
  return {
    inicio, antes, depois,
    faltamAntes: Math.max(0, JANELA_DIAS - antes.diasComDados),
    faltamDepois: Math.max(0, JANELA_DIAS - depois.diasComDados),
    variacaoPct,
  };
}
