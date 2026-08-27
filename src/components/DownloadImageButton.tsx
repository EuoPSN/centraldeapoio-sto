import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

// Baixa a imagem pra depois anexar em outro canal (ex: WhatsApp) — o link é
// same-origin (proxy /api/public/message-image), então o atributo `download`
// funciona sem precisar de fetch+blob.
export function DownloadImageButton({ url, filename }: { url: string; filename: string }) {
  const safeName = filename.replace(/[\\/:*?"<>|]+/g, "-");
  return (
    <a href={url} download={safeName} onClick={(e) => e.stopPropagation()}>
      <Button type="button" variant="outline" size="sm" className="gap-1.5">
        <Download className="h-3.5 w-3.5" /> Baixar imagem
      </Button>
    </a>
  );
}
