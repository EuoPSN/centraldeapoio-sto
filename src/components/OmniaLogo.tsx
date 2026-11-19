import simboloClaro from "@/assets/omnia/omnia-simbolo-fundo-claro.svg?url";
import simboloEscuro from "@/assets/omnia/omnia-simbolo-fundo-escuro.svg?url";
import nomeClaro from "@/assets/omnia/omnia-nome-fundo-claro.svg?url";
import nomeEscuro from "@/assets/omnia/omnia-nome-fundo-escuro.svg?url";
import verticalEscuro from "@/assets/omnia/omnia-vertical-fundo-escuro.svg?url";
import { cn } from "@/lib/utils";

// Marca OMNIA. Os arquivos são os oficiais (src/assets/omnia/); os
// "omnia-nome-*" são o logo horizontal sem slogan só com o recorte (viewBox)
// do nome, sem redesenhar nada. Regra da marca: nada de sombra, brilho,
// contorno ou gradiente atrás do símbolo.

/** Símbolo OMNIA. Troca a versão clara/escura junto com o tema. */
export function OmniaSymbol({ size = 32, className, tone = "auto" }: { size?: number; className?: string; tone?: "auto" | "dark" }) {
  if (tone === "dark") {
    return <img src={simboloEscuro} alt="" width={size} height={size} className={cn("shrink-0", className)} />;
  }
  return (
    <span className={cn("inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <img src={simboloClaro} alt="" width={size} height={size} className="dark:hidden" />
      <img src={simboloEscuro} alt="" width={size} height={size} className="hidden dark:block" />
    </span>
  );
}

/** Assinatura: símbolo + nome OMNIA + descritor "APOIO". */
export function OmniaLockup({ className, symbolSize = 32 }: { className?: string; symbolSize?: number }) {
  return (
    <span className={cn("flex items-center gap-3", className)} role="img" aria-label="OMNIA Apoio">
      <OmniaSymbol size={symbolSize} />
      <span className="flex flex-col gap-1.5">
        <img src={nomeClaro} alt="" className="h-[14px] w-auto dark:hidden" />
        <img src={nomeEscuro} alt="" className="hidden h-[14px] w-auto dark:block" />
        <span className="text-[10px] font-light uppercase leading-none tracking-[0.24em] text-muted-foreground">Apoio</span>
      </span>
    </span>
  );
}

/** Logo vertical (versão fundo escuro), usado no painel escuro do login. */
export function OmniaVertical({ className }: { className?: string }) {
  return <img src={verticalEscuro} alt="OMNIA — um universo de possibilidades" className={cn("h-auto", className)} />;
}
