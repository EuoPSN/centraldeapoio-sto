// Funções puras da Teleconsulta e PA digital (usadas no Admin, na página e nos testes).

/** Uma especialidade por linha: tira marcadores, espaços e repetidas (ignora maiúsculas). */
export function linhasDoColar(texto: string): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const nome = bruta.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim().slice(0, 150);
    if (!nome) continue;
    const k = nome.toLowerCase();
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(nome);
  }
  return out;
}
