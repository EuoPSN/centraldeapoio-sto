import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VideoFields, erroDosCamposDeVideo } from "@/components/admin/VideoFields";
import { setCategoryVideo } from "@/lib/taxonomy.functions";

/** Vídeo "Para quem é" do fluxo selecionado (cartão de Scripts). Vazio = capa "Para quem é". */
export function FluxoVideoCard({ categoryId, nome, videoUrl, videoDuracao }: {
  categoryId: string; nome: string; videoUrl: string | null; videoDuracao: string | null;
}) {
  const save = useServerFn(setCategoryVideo);
  const qc = useQueryClient();
  const [url, setUrl] = useState(videoUrl ?? "");
  const [dur, setDur] = useState(videoDuracao ?? "");
  useEffect(() => { setUrl(videoUrl ?? ""); setDur(videoDuracao ?? ""); }, [categoryId, videoUrl, videoDuracao]);
  const mut = useMutation({
    mutationFn: async () => {
      const e = erroDosCamposDeVideo(url, dur);
      if (e) throw new Error(e);
      return save({ data: { id: categoryId, video_url: url.trim() || null, video_duracao: dur.trim() || null } });
    },
    onSuccess: () => { toast.success("Vídeo salvo."); qc.invalidateQueries({ queryKey: ["cats", "message"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar o vídeo."),
  });
  const mudou = url.trim() !== (videoUrl ?? "") || dur.trim() !== (videoDuracao ?? "");
  return (
    <Card className="max-w-xl space-y-3 p-4">
      <div>
        <p className="text-sm font-semibold">Vídeo "Para quem é" · {nome}</p>
        <p className="text-xs text-muted-foreground">Aparece na capa do cartão deste fluxo em Scripts. Sem vídeo, a capa continua "Para quem é".</p>
      </div>
      <VideoFields url={url} duracao={dur} onUrl={setUrl} onDuracao={setDur} />
      <Button size="sm" onClick={() => mut.mutate()} disabled={!mudou || mut.isPending}>Salvar vídeo</Button>
    </Card>
  );
}
