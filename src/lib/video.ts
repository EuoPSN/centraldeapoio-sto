// Vídeos da Central de Ajuda e dos fluxos de Scripts.
// Aceita link do YouTube (inclusive não listado), do Vimeo ou arquivo direto (.mp4/.webm).
// Arquivo puro (sem imports): roda no formulário, no servidor e nos testes (tests/video.test.ts).

export type VideoInfo =
  | { ok: true; tipo: "youtube" | "vimeo"; embed: string }
  | { ok: true; tipo: "arquivo"; src: string }
  | { ok: false; erro: string };

export const VIDEO_AJUDA = "Use um link https do YouTube, do Vimeo ou um arquivo .mp4/.webm.";

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const ID_YT = /^[A-Za-z0-9_-]{11}$/;

export function lerVideo(entrada: string | null | undefined): VideoInfo {
  const bruto = (entrada ?? "").trim();
  if (!bruto) return { ok: false, erro: "Cole o link do vídeo." };
  if (bruto.length > 500) return { ok: false, erro: "O link é longo demais." };
  let u: URL;
  try {
    u = new URL(bruto);
  } catch {
    return { ok: false, erro: `Link inválido. ${VIDEO_AJUDA}` };
  }
  if (u.protocol !== "https:") return { ok: false, erro: `O link precisa começar com https://. ${VIDEO_AJUDA}` };
  if (u.username || u.password) return { ok: false, erro: "Link inválido." };
  const host = u.hostname.toLowerCase();
  const partes = u.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    const id = partes[0] ?? "";
    if (ID_YT.test(id)) return { ok: true, tipo: "youtube", embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    return { ok: false, erro: "Não achei o código do vídeo no link do YouTube." };
  }
  if (YT_HOSTS.has(host)) {
    let id = "";
    if (partes[0] === "watch") id = u.searchParams.get("v") ?? "";
    else if (["embed", "shorts", "live", "v"].includes(partes[0] ?? "")) id = partes[1] ?? "";
    if (ID_YT.test(id)) return { ok: true, tipo: "youtube", embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    return { ok: false, erro: "Não achei o código do vídeo no link do YouTube." };
  }
  if (VIMEO_HOSTS.has(host)) {
    // vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (não listado), player.vimeo.com/video/123456789?h=abc
    const lista = host === "player.vimeo.com" ? partes.slice(1) : partes;
    const id = lista[0] ?? "";
    if (/^\d{5,12}$/.test(id)) {
      const h = lista[1] && /^[A-Za-z0-9]{6,20}$/.test(lista[1]) ? lista[1] : u.searchParams.get("h");
      const hash = h && /^[A-Za-z0-9]{6,20}$/.test(h) ? `?h=${h}` : "";
      return { ok: true, tipo: "vimeo", embed: `https://player.vimeo.com/video/${id}${hash}` };
    }
    return { ok: false, erro: "Não achei o código do vídeo no link do Vimeo." };
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { ok: true, tipo: "arquivo", src: u.toString() };
  return { ok: false, erro: `Esse endereço não é aceito. ${VIDEO_AJUDA}` };
}

/** Vazio é permitido (= "Vídeo em breve"). Devolve a mensagem de erro ou null. */
export function erroDoVideo(entrada: string | null | undefined): string | null {
  if (!(entrada ?? "").trim()) return null;
  const r = lerVideo(entrada);
  return r.ok ? null : r.erro;
}

/** Duração opcional como "2:30" ou "12:05" (ou "1:02:03"). */
export function duracaoValida(d: string | null | undefined): boolean {
  const t = (d ?? "").trim();
  return t === "" || /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(t);
}
