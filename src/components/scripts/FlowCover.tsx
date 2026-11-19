import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Capa escura de um fluxo (gradiente da marca). Hoje mostra só "PARA QUEM É" e o
 * nome do fluxo. Preparada para um vídeo curto no futuro: com `video`, aparece o
 * botão de play (e a duração) e o vídeo toca no lugar da capa. Ainda não existe
 * campo no banco para isso.
 */
export function FlowCover({
  name, video, className,
}: {
  name: string;
  video?: { src: string; duration?: string; poster?: string };
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (video && playing) {
    return (
      <video
        src={video.src}
        poster={video.poster}
        controls
        autoPlay
        className={cn("h-[120px] w-full bg-[#0B0B0B] object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn("relative flex h-[120px] flex-col justify-end overflow-hidden px-4 pb-3", className)}
      style={{ background: "linear-gradient(to bottom right, #0B0B0B 0%, #17131F 58%, #2A1A42 100%)" }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">Para quem é</span>
      {video ? (
        <button
          type="button"
          aria-label={`Assistir: para quem é o fluxo ${name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlaying(true);
          }}
          className="absolute left-1/2 top-[38%] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#D4AF37] text-[#D4AF37] hover:bg-white/5"
        >
          <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={1.5} />
        </button>
      ) : (
        <p className="mt-1 line-clamp-2 font-display text-[19px] font-medium uppercase leading-6 tracking-[0.08em] text-[#F5F5F0]">
          {name}
        </p>
      )}
      {video?.duration && (
        <span className="absolute bottom-3 right-4 rounded bg-black/50 px-1.5 py-px text-[11px] tabular-nums text-[#F5F5F0]">{video.duration}</span>
      )}
    </div>
  );
}
