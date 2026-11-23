import { useCopy, GoldButton } from "@/components/scripts/shared";
import { reais, useAmorSaude, type AmorItem } from "./model";
import { limparOrcamento, resumoOrcamento, textoOrcamento, useOrcamento } from "./store";

// ---------------------------------------------------------------------------
// Barra do orçamento (fixa no rodapé do Amor Saúde)
// ---------------------------------------------------------------------------

export function OrcamentoBar() {
  const lista = useOrcamento();
  const { consultas, exames, procedimentos, telemedicina } = useAmorSaude();
  const { copied, copy } = useCopy();

  const itens: AmorItem[] = lista
    .map((r) => (r.tipo === "consulta" ? consultas : r.tipo === "exame" ? exames : r.tipo === "telemedicina" ? telemedicina : procedimentos).find((i: AmorItem) => i.id === r.id))
    .filter((i): i is AmorItem => !!i);
  if (!itens.length) return null;

  const { total, economia } = resumoOrcamento(itens);
  const n = itens.length;

  return (
    <div className="sticky bottom-0 z-20 shrink-0 px-3 pb-3 sm:px-7 sm:pb-4">
      <div
        role="region"
        aria-label="Orçamento"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl lg:flex-nowrap border border-transparent bg-[#0b0b0b] px-4 py-3 text-[#f5f5f0] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.45)] dark:border-line dark:bg-surface-2 sm:px-5"
      >
        <p className="shrink-0 text-sm font-semibold text-[#d4af37]">
          Orçamento · {n} {n === 1 ? "item" : "itens"}
        </p>
        <p className="min-w-0 flex-1 basis-40 truncate text-sm text-[#b8b2a6] lg:basis-0" title={itens.map((i) => i.nome).join(", ")}>
          {itens.map((i) => i.nome).join(", ")}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
          {total != null ? (
            <p className="whitespace-nowrap text-sm tabular-nums text-[#b8b2a6]">
              Total Cartão <span className="font-semibold text-[#d4af37]">{reais(total)}</span>
              {economia != null && <> · economia de {reais(economia)}</>}
            </p>
          ) : (
            <p className="text-sm text-[#b8b2a6]">Valores: consulte a clínica</p>
          )}
          <button
            type="button"
            onClick={limparOrcamento}
            className="rounded-md px-1.5 py-1 text-[13px] text-[#b8b2a6] underline-offset-4 hover:text-[#f5f5f0] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4af37]"
          >
            Limpar
          </button>
          <GoldButton onClick={() => copy(textoOrcamento(itens))} aria-live="polite" className="h-9 min-w-[156px] bg-[#d4af37] px-4 text-sm">
            {copied ? "Copiado" : "Copiar orçamento"}
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
