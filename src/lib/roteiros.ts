// Roteiros (áudio e ligação): funções puras usadas nas páginas, no Admin e nos testes.

export interface Parte { texto: string; marca: boolean }

/** Separa o roteiro em pedaços, marcando [nome], (pausa curta), (sorria) e {nome} para destaque. */
export function partesDoRoteiro(texto: string): Parte[] {
  const out: Parte[] = [];
  const re = /\[[^\]\n]{1,60}\]|\([^)\n]{1,60}\)|\{[^}\n]{1,40}\}/g;
  let i = 0;
  for (const m of texto.matchAll(re)) {
    const ini = m.index ?? 0;
    if (ini > i) out.push({ texto: texto.slice(i, ini), marca: false });
    out.push({ texto: m[0], marca: true });
    i = ini + m[0].length;
  }
  if (i < texto.length) out.push({ texto: texto.slice(i), marca: false });
  return out;
}

export const AUDIO_MAX_BYTES = 5 * 1024 * 1024;
const AUDIO_EXT = /\.(mp3|m4a|ogg|wav)$/i;

/** Erro de um arquivo de áudio para o upload (mp3/m4a/ogg/wav, até 5 MB) ou null. */
export function erroDoArquivoDeAudio(f: { name: string; size: number }): string | null {
  if (!AUDIO_EXT.test(f.name)) return "Envie um arquivo mp3, m4a, ogg ou wav.";
  if (f.size > AUDIO_MAX_BYTES) return "O áudio passa de 5 MB.";
  return null;
}

/** Nome seguro para o Storage (sem acento, espaço nem símbolo). */
export function nomeSeguroDeArquivo(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
}

export const CATEGORIAS_AUDIO = ["Retomada", "Objeção", "Fechamento", "Pós-venda"] as const;
export const ETAPAS_LIGACAO = ["Abertura", "Sondagem", "Apresentação", "Objeções", "Fechamento"] as const;
