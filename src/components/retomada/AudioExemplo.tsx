import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const AUDIO_BUCKET = "cadencia-audios";

/** Player do áudio de exemplo (arquivo privado no Storage, tocado por URL assinada). */
export function AudioExemplo({ path }: { path: string }) {
  const q = useQuery({
    queryKey: ["cadencia-audio", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 30 * 60_000,
  });
  if (q.isError) return <p className="text-[13px] text-ink-muted">Não consegui carregar o áudio de exemplo.</p>;
  if (!q.data) return <div className="h-10 animate-pulse rounded-lg bg-surface-2" aria-hidden />;
  return <audio controls preload="none" src={q.data} className="h-10 w-full max-w-[420px]" aria-label="Áudio de exemplo" />;
}
