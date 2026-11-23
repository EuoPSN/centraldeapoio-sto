import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ALTURAS = [10, 16, 22, 14, 26, 18, 12, 24, 20, 28, 16, 10, 22, 26, 14, 18, 24, 12, 20, 16, 28, 14, 22, 18, 10, 24, 16, 20, 12, 26];

const fmt = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/**
 * Player no estilo da marca (barra escura, play dourado). O arquivo fica num bucket privado e
 * toca por URL assinada (1 h). `duracao` (texto, ex. "0:38") aparece até o navegador ler a real.
 */
export function AudioPlayer({ bucket, path, duracao }: { bucket: string; path: string; duracao?: string | null }) {
  const q = useQuery({
    queryKey: ["audio-assinado", bucket, path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 30 * 60_000,
  });
  const el = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [total, setTotal] = useState(0);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => { setTocando(false); setAtual(0); setTotal(0); setFalhou(false); }, [path]);

  if (q.isError || falhou) return <p className="rounded-lg bg-surface-2 px-4 py-3 text-[13.5px] text-ink-muted">Não consegui carregar o áudio de exemplo agora.</p>;
  if (!q.data) return <div className="h-[60px] animate-pulse rounded-xl bg-surface-2" aria-hidden />;

  const pct = total > 0 ? Math.min(100, (atual / total) * 100) : 0;
  const alternar = () => {
    const a = el.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setFalhou(true)); else a.pause();
  };
  return (
    <div role="group" aria-label="Áudio de exemplo" className="flex h-[60px] items-center gap-4 rounded-xl bg-[#0B0B0B] px-4 text-[#F5F5F0]">
      <audio
        ref={el}
        src={q.data}
        preload="metadata"
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => { setTocando(false); setAtual(0); }}
        onTimeUpdate={(e) => setAtual(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setTotal(e.currentTarget.duration)}
        onError={() => setFalhou(true)}
      />
      <button
        type="button"
        onClick={alternar}
        aria-label={tocando ? "Pausar o áudio" : "Ouvir o áudio de exemplo"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#D4AF37] text-[#0B0B0B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F5F0]"
      >
        {tocando ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
      <div aria-hidden className="flex h-8 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
        {ALTURAS.map((h, i) => (
          <span key={i} style={{ height: h }} className={`w-[3px] shrink-0 rounded-full ${(i / ALTURAS.length) * 100 < pct ? "bg-[#D4AF37]" : "bg-[#D4AF37]/40"}`} />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={total || 1}
        step={0.1}
        value={atual}
        onChange={(e) => { const a = el.current; if (a) { a.currentTime = Number(e.target.value); setAtual(a.currentTime); } }}
        aria-label="Posição do áudio"
        className="sr-only"
      />
      <span className="shrink-0 text-sm tabular-nums">{total > 0 ? fmt(tocando || atual > 0 ? atual : total) : (duracao ?? "0:00")}</span>
    </div>
  );
}
