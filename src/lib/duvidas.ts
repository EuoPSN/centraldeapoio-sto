// Dúvidas frequentes: funções puras (página, Admin e testes). Sem imports de servidor.
import { removerDadosPessoais } from "./extensao-sanitizar.ts";

export const TEMAS_PADRAO = ["Planos", "Pagamento", "Cancelamento", "Amor Saúde", "Clínicas"] as const;

export function normalizarPergunta(t: string): string {
  return t
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PerguntaDita { texto: string; usuario: string }
export interface GrupoPergunta { pergunta: string; vezes: number; pessoas: number }

/**
 * "Mais perguntadas": agrupa só perguntas IGUAIS depois de normalizar (sem acento, caixa e
 * pontuação). Não tenta juntar perguntas parecidas, porque sem leitura semântica isso erra.
 * Privacidade: só entra pergunta curta, que tenha sido feita por 2 pessoas ou mais, sem dado
 * pessoal (telefone, CPF, e-mail, link, número longo) e sem dígitos soltos.
 */
export function maisPerguntadas(msgs: PerguntaDita[], opts: { minPessoas?: number; limite?: number } = {}): GrupoPergunta[] {
  const minPessoas = opts.minPessoas ?? 2;
  const limite = opts.limite ?? 10;
  const grupos = new Map<string, { exemplos: Map<string, number>; vezes: number; pessoas: Set<string> }>();
  for (const m of msgs) {
    const texto = (m.texto ?? "").replace(/\s+/g, " ").trim();
    if (texto.length < 8 || texto.length > 140) continue;
    if (removerDadosPessoais(texto) !== texto) continue;
    if (/\d{3,}/.test(texto)) continue;
    const chave = normalizarPergunta(texto);
    if (chave.split(" ").length < 2) continue;
    const g = grupos.get(chave) ?? { exemplos: new Map(), vezes: 0, pessoas: new Set() };
    g.vezes += 1;
    g.pessoas.add(m.usuario);
    g.exemplos.set(texto, (g.exemplos.get(texto) ?? 0) + 1);
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .filter((g) => g.pessoas.size >= minPessoas)
    .map((g) => ({
      pergunta: [...g.exemplos.entries()].sort((a, b) => b[1] - a[1])[0][0],
      vezes: g.vezes,
      pessoas: g.pessoas.size,
    }))
    .sort((a, b) => b.vezes - a.vezes || a.pergunta.localeCompare(b.pergunta, "pt-BR"))
    .slice(0, limite);
}
