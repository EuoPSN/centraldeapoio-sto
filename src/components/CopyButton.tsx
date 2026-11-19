import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
  onCopy?: () => void;
}

/**
 * Botão Copiar: uma das duas ações principais da Central.
 * Largura fixa para ficar sempre alinhado na mesma coluna, com
 * confirmação visível ("Copiado") sem deslocar o layout.
 */
export function CopyButton({
  text,
  label = "Copiar",
  variant = "outline",
  size = "sm",
  className,
  onCopy,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const isIcon = size === "icon";
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={isIcon ? (copied ? "Copiado" : label) : undefined}
      title={isIcon ? label : undefined}
      className={cn(
        "shrink-0 gap-1.5",
        isIcon ? "h-9 w-9 rounded-lg text-gold-text" : "min-w-[6.25rem] font-semibold text-gold-text",
        copied && "border-primary bg-accent text-gold-text",
        className,
      )}
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {!isIcon && <span aria-live="polite">{copied ? "Copiado" : label}</span>}
    </Button>
  );
}
