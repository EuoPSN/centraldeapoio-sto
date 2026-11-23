import { useSyncExternalStore } from "react";
import { reais, type AmorItem } from "./model";

// Estado que vale para todas as subpáginas enquanto a pessoa estiver no
// Amor Saúde: guardado em sessionStorage (some ao fechar a aba).

function sessionStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let cache: T | undefined;
  const read = (): T => {
    if (cache !== undefined) return cache;
    try {
      const raw = sessionStorage.getItem(key);
      cache = raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      cache = fallback;
    }
    return cache;
  };
  const write = (next: T) => {
    cache = next;
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* navegador sem sessionStorage: fica só em memória */
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const use = () => useSyncExternalStore(subscribe, read, () => fallback);
  return { read, write, use };
}

// ---------------------------------------------------------------------------
// Região do cliente
// ---------------------------------------------------------------------------

const regiaoStore = sessionStore<string | null>("omnia:amor-saude:regiao", null);
export const useRegiao = regiaoStore.use;
export const setRegiao = (r: string | null) => regiaoStore.write(r);

// ---------------------------------------------------------------------------
// Orçamento
// ---------------------------------------------------------------------------

export interface OrcamentoRef { tipo: AmorItem["tipo"]; id: string }
const orcStore = sessionStore<OrcamentoRef[]>("omnia:amor-saude:orcamento", []);
export const useOrcamento = orcStore.use;

export function toggleOrcamento(ref: OrcamentoRef) {
  const cur = orcStore.read();
  const has = cur.some((r) => r.tipo === ref.tipo && r.id === ref.id);
  orcStore.write(has ? cur.filter((r) => !(r.tipo === ref.tipo && r.id === ref.id)) : [...cur, ref]);
}
export const limparOrcamento = () => orcStore.write([]);
export const noOrcamento = (lista: OrcamentoRef[], item: { tipo: string; id: string }) =>
  lista.some((r) => r.tipo === item.tipo && r.id === item.id);

/** Soma só itens com preço fixo (consultas e teleconsultas); exames e odonto entram como "consulte a clínica". */
export function resumoOrcamento(itens: AmorItem[]) {
  let total = 0, particular = 0, temFixo = false, particularCompleto = true;
  itens.forEach((i) => {
    if ((i.tipo !== "consulta" && i.tipo !== "telemedicina") || i.cartao == null) return;
    temFixo = true;
    total += i.cartao;
    if (i.particular == null) particularCompleto = false;
    else particular += i.particular;
  });
  const economia = temFixo && particularCompleto && particular > total ? particular - total : null;
  return { total: temFixo ? total : null, particular: temFixo && particularCompleto ? particular : null, economia };
}

export function textoOrcamento(itens: AmorItem[]) {
  const { total, particular, economia } = resumoOrcamento(itens);
  const linhas = itens.map((i) => {
    if (i.tipo === "consulta") {
      if (i.cartao == null) return `• ${i.nome}: consulte a clínica`;
      return `• ${i.nome}: *${reais(i.cartao)}*${i.particular != null ? ` (particular ${reais(i.particular)})` : ""}`;
    }
    if (i.tipo === "telemedicina") {
      const rot = i.modalidade === "pa_digital" ? "PA digital" : "Teleconsulta";
      if (i.cartao == null) return `• ${rot} – ${i.nome}: consulte a clínica`;
      return `• ${rot} – ${i.nome}: *${reais(i.cartao)}*${i.particular != null ? ` (particular ${reais(i.particular)})` : ""}`;
    }
    if (i.tipo === "exame") return `• ${i.nome}: consulte a clínica${i.media != null ? ` (média de ${reais(i.media)})` : ""}`;
    return `• ${i.nome}: valor após avaliação odontológica`;
  });
  return [
    "*Seu orçamento pelo Cartão de TODOS* 💚",
    ...linhas,
    total != null ? `*Total no Cartão de TODOS: ${reais(total)}*` : null,
    particular != null && economia != null ? `No particular: ${reais(particular)} · você economiza *${reais(economia)}*` : null,
  ].filter(Boolean).join("\n");
}
