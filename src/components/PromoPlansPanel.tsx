import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPromoPlans } from "@/lib/promoplans.functions";
import { Panel, PanelRow } from "@/components/Panel";
import { PriceTag } from "@/components/PriceTag";
import { CopyButton } from "@/components/CopyButton";

interface PromoPlanRow {
  id: string; nome: string; preco_primeiro_mes: number; preco_demais_meses: number;
  cor_fundo: string; cor_fundo_2: string | null; ativo: boolean; position: number;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Planos em promoção com o preço do 1º mês e o botão Copiar.
 * Usado na aba Planos de Preços. Some quando não há plano ativo,
 * a menos que `showEmpty` peça a mensagem de lista vazia.
 */
export function PromoPlansPanel({ showEmpty = false, className }: { showEmpty?: boolean; className?: string }) {
  const promoFn = useServerFn(listPromoPlans);
  const promoQ = useQuery({ queryKey: ["promo-plans"], queryFn: () => promoFn({}) });
  const plans = ((promoQ.data ?? []) as PromoPlanRow[]).filter((p) => p.ativo).sort((a, b) => a.position - b.position);

  if (plans.length === 0) {
    if (!showEmpty || promoQ.isLoading) return null;
    return (
      <Panel title="Planos em promoção" className={className}>
        <PanelRow className="py-4 text-sm text-muted-foreground">Nenhum plano em promoção agora.</PanelRow>
      </Panel>
    );
  }

  return (
    <Panel title="Planos em promoção" className={className}>
      {plans.map((p) => (
        <PanelRow key={p.id}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.nome}</p>
            <p className="text-[12.5px] text-muted-foreground">1º mês · depois {formatBRL(p.preco_demais_meses)}</p>
          </div>
          <PriceTag value={p.preco_primeiro_mes} promo />
          <CopyButton
            size="icon"
            label={`Copiar preço do ${p.nome}`}
            text={`${p.nome}: ${formatBRL(p.preco_primeiro_mes)} no 1º mês. A partir do 2º mês, ${formatBRL(p.preco_demais_meses)}.`}
          />
        </PanelRow>
      ))}
    </Panel>
  );
}
