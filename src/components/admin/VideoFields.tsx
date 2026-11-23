import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlowCover } from "@/components/scripts/FlowCover";
import { duracaoValida, erroDoVideo, VIDEO_AJUDA } from "@/lib/video";

/** Erro do par link + duração (ou null). Use antes de salvar. */
export function erroDosCamposDeVideo(url: string, duracao: string): string | null {
  return erroDoVideo(url) ?? (duracaoValida(duracao) ? null : "A duração deve ser no formato 2:14.");
}

/**
 * "Link do vídeo (opcional)", "Duração" e "Testar vídeo". Vazio = "Vídeo em breve".
 * Mesma regra de validação do servidor (src/lib/video.ts).
 */
export function VideoFields({
  url, duracao, onUrl, onDuracao, rotulo = "Link do vídeo (opcional)", legenda = "Para quem é",
}: {
  url: string;
  duracao: string;
  onUrl: (v: string) => void;
  onDuracao: (v: string) => void;
  rotulo?: string;
  legenda?: string;
}) {
  const [teste, setTeste] = useState(false);
  const erro = erroDosCamposDeVideo(url, duracao);
  const preenchido = url.trim() !== "";
  return (
    <div className="space-y-2">
      <div>
        <Label>{rotulo}</Label>
        <Input placeholder="https://youtu.be/…" value={url} onChange={(e) => onUrl(e.target.value)} aria-invalid={!!erro} />
        <p className="mt-1 text-xs text-muted-foreground">Aceita YouTube (não listado), Vimeo ou link direto de vídeo (.mp4/.webm). Vazio = "Vídeo em breve". {VIDEO_AJUDA}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Label>Duração</Label>
          <Input placeholder="2:14" value={duracao} onChange={(e) => onDuracao(e.target.value)} />
        </div>
        <Button type="button" size="sm" variant="outline" disabled={!preenchido || !!erroDoVideo(url)} onClick={() => setTeste(true)}>
          Testar vídeo
        </Button>
      </div>
      {erro && preenchido && <p role="alert" className="text-xs text-destructive">{erro}</p>}
      <Dialog open={teste} onOpenChange={setTeste}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Testar vídeo</DialogTitle></DialogHeader>
          {teste && <FlowCover videoUrl={url} videoDuracao={duracao || null} label={legenda} height={340} emptyText="Vídeo em breve" className="rounded-lg" />}
          <p className="text-xs text-muted-foreground">É assim que a equipe vê. Clique no play para conferir se o vídeo abre.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
