import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { lerVideo } from "@/lib/video";

/**
 * Capa escura no gradiente da marca.
 * - Sem vídeo: "Para quem é" + nome do fluxo (Scripts) ou `emptyText` ("Vídeo em breve",
 *   Central de Ajuda), como sempre foi.
 * - Com `videoUrl` válido: botão de play e duração; ao clicar, o vídeo toca no lugar da capa
 *   (iframe do YouTube/Vimeo em modo sem cookies ou <video> para arquivo direto).
 * Link inválido guardado no banco é tratado como "sem vídeo", nunca quebra a página.
 */
export function FlowCover({
  name, videoUrl, videoDuracao, label, className, height = 120, emptyText,
}: {
  /** Nome do fluxo (Scripts). Ignorado quando `emptyText` é passado (Central de Ajuda). */
  name?: string;
  videoUrl?: string | null;
  videoDuracao?: string | null;
  /** Texto dourado no canto da capa com vídeo (padrão: "Para quem é"). */
  label?: string;
  className?: string;
  /** Altura da capa em px (120 nos fluxos de Scripts, 300 no artigo da Central de Ajuda). */
  height?: number;
  /** Texto central para quando ainda não há vídeo nem "para quem é" (ex.: "Vídeo em breve"). */
  emptyText?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const info = useMemo(() => (videoUrl ? lerVideo(videoUrl) : null), [videoUrl]);
  const video = info && info.ok ? info : null;
  const titulo = emptyText ? "o vídeo" : name ? `o vídeo do fluxo ${name}` : "o vídeo";

  if (video && playing) {
    const box = cn("w-full overflow-hidden bg-[#0B0B0B]", className);
    if (video.tipo === "arquivo") {
      return <video src={video.src} controls autoPlay playsInline style={{ height: `${height}px` }} className={cn(box, "object-contain")} />;
    }
    const sep = video.embed.includes("?") ? "&" : "?";
    return (
      <div className={box} style={{ height: `${height}px` }}>
        <iframe
          src={`${video.embed}${sep}autoplay=1`}
          title={`Vídeo: ${name ?? "passo a passo"}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden px-4",
        emptyText && !video ? "items-center justify-center" : "justify-end pb-3",
        className,
      )}
      style={{ height: `${height}px`, background: "linear-gradient(to bottom right, #0B0B0B 0%, #17131F 58%, #2A1A42 100%)" }}
    >
      {video ? (
        <>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
            {label ?? (emptyText ? "Passo a passo em vídeo" : "Para quem é")}
          </span>
          <button
            type="button"
            aria-label={`Assistir ${titulo}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPlaying(true);
            }}
            className="absolute left-1/2 top-[42%] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#D4AF37] text-[#0B0B0B] shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F5F0]"
          >
            <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={1.5} />
          </button>
          {videoDuracao && (
            <span className="absolute bottom-3 right-4 rounded bg-black/50 px-1.5 py-px text-[11px] tabular-nums text-[#F5F5F0]">{videoDuracao}</span>
          )}
        </>
      ) : emptyText ? (
        <span className="text-sm" style={{ color: "#B8B2A6" }}>{emptyText}</span>
      ) : (
        <>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">Para quem é</span>
          <p className="mt-1 line-clamp-2 font-display text-[19px] font-medium uppercase leading-6 tracking-[0.08em] text-[#F5F5F0]">
            {name}
          </p>
        </>
      )}
    </div>
  );
}
