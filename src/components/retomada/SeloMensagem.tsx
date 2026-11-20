import { useState } from "react";
import { SELO_LABEL, type SeloAtendente } from "@/lib/mensagens-vendem";
import { CopyText, Overline } from "@/components/cliente-disse/shared";
import { cn } from "@/lib/utils";

/** Selo de uma mensagem ("Funciona bem" com ponto dourado; "Vale testar outra" tracejado) e
 * "Usada N vezes pela equipe". O atendente nunca vê percentuais. "Ver outra versão →" só aparece
 * quando existe uma versão anterior da mesma mensagem com selo "Funciona bem". */
export function SeloMensagem({ selo, versaoBoa, montar, onCopiou, comLinkOutraVersao = true }: {
  selo?: SeloAtendente;
  versaoBoa?: { versao: number; texto: string };
  /** Preenche as variáveis ({nome}…) do texto da versão anterior. */
  montar?: (texto: string) => string;
  onCopiou?: () => void;
  comLinkOutraVersao?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  if (!selo || (!selo.selo && selo.envios === 0)) return null;
  const podeVer = comLinkOutraVersao && !!versaoBoa && selo.selo !== "funciona_bem" && !!montar;
  const anterior = podeVer && versaoBoa ? montar!(versaoBoa.texto) : "";

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {selo.selo && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[12.5px] font-semibold",
              selo.selo === "funciona_bem" ? "border-gold text-gold-text" : "border-dashed border-ink-muted text-ink",
            )}
          >
            {selo.selo === "funciona_bem" && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />}
            {SELO_LABEL[selo.selo]}
          </span>
        )}
        {selo.envios > 0 && (
          <span className="text-[13px] text-ink-muted">Usada {selo.envios} {selo.envios === 1 ? "vez" : "vezes"} pela equipe.</span>
        )}
        {podeVer && (
          <button type="button" onClick={() => setAberta((a) => !a)} aria-expanded={aberta} className="ml-auto text-[13.5px] font-semibold text-gold-text hover:underline">
            {aberta ? "Esconder versão anterior" : "Ver outra versão →"}
          </button>
        )}
      </div>
      {aberta && podeVer && versaoBoa && (
        <div className="mt-3 rounded-xl bg-surface-2 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <Overline>Versão anterior · Funciona bem</Overline>
            <CopyText text={anterior} variant="link" onCopied={onCopiou} />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[15.5px] leading-[1.55] text-ink [overflow-wrap:anywhere]">{anterior}</p>
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-ink-muted">O selo só aparece depois de alguns envios da mensagem na equipe. Os percentuais ficam só com o Paulo.</p>
    </>
  );
}
