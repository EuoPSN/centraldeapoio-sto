import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setItemEconomia, setMensalidadePlano } from "@/lib/cliente-disse.functions";
import { PLANOS, PLANO_LABEL, brl, type ItemAmor } from "@/lib/cliente-disse";
import { normalize } from "@/components/scripts/shared";
import { BASE_KEY, useClienteDisseBase } from "@/components/cliente-disse/shared";
import { inputCls } from "@/components/admin/AdminListDetail";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { erro } from "@/components/admin/cliente-disse-shared";


// ===========================================================================
// Economia
// ===========================================================================

export function EconomiaAdminTab() {
  const base = useClienteDisseBase();
  const mensalFn = useServerFn(setMensalidadePlano);
  const itemFn = useServerFn(setItemEconomia);
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: BASE_KEY });

  const salvarMensal = useMutation({
    mutationFn: (v: { plano: (typeof PLANOS)[number]; mensalidade: number | null }) => mensalFn({ data: v }),
    onSuccess: () => { toast.success("Mensalidade salva."); refresh(); },
    onError: erro,
  });
  const salvarItem = useMutation({
    mutationFn: (v: { tipo: ItemAmor["tipo"]; id: string; preco_particular_medio: number | null; usar_na_economia: boolean }) => itemFn({ data: v }),
    onSuccess: () => refresh(),
    onError: erro,
  });

  const itens = (base.data?.itensAmor ?? []).filter((i) => !busca.trim() || normalize(i.nome).includes(normalize(busca.trim())));
  const tipoLabel = { consulta: "Consulta", exame: "Exame", odontologia: "Odontologia" } as const;
  const parse = (s: string) => {
    const v = s.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    return v === "" || Number.isNaN(Number(v)) ? null : Number(v);
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-medium leading-8 text-ink">Economia</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-muted">Usado em “O que você leva”, na aba Fechar com este cliente.</p>
        <p className="mt-5 type-overline text-ink-muted">Mensalidade de cada plano</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {PLANOS.map((p) => {
            const atual = base.data?.mensalidades[p];
            return (
              <label key={`${p}-${atual ?? ""}`} className="block">
                <span className="text-[13.5px] text-ink">{PLANO_LABEL[p]}</span>
                <input
                  defaultValue={atual != null ? String(atual).replace(".", ",") : ""}
                  placeholder="R$"
                  inputMode="decimal"
                  className={cn(inputCls, "mt-1 w-32")}
                  onBlur={(e) => {
                    const v = parse(e.target.value);
                    if (v !== (atual ?? null)) salvarMensal.mutate({ plano: p, mensalidade: v });
                  }}
                />
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="type-overline text-ink-muted">Itens da Amor Saúde</p>
            <p className="mt-0.5 text-[13.5px] text-ink-muted">Preço particular médio e se o item entra no cálculo. O valor com o cartão vem do cadastro da Amor Saúde.</p>
          </div>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className={cn(inputCls, "h-8 w-56 py-1")} />
        </div>
        {base.isLoading && <p className="mt-3 text-sm text-ink-muted">Carregando…</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.12em] text-ink-muted">
                <th className="py-2 font-semibold">Item</th>
                <th className="py-2 font-semibold">Tipo</th>
                <th className="py-2 font-semibold">Com o cartão</th>
                <th className="py-2 font-semibold">Preço particular médio</th>
                <th className="py-2 font-semibold">Usar no cálculo de economia</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={`${i.tipo}-${i.id}`} className="border-b border-line">
                  <td className="py-2 pr-3 text-ink">{i.nome}</td>
                  <td className="py-2 pr-3 text-ink-muted">{tipoLabel[i.tipo]}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink">{i.cartao != null ? brl(i.cartao) : <span className="text-ink-muted">—</span>}</td>
                  <td className="py-2 pr-3">
                    <input
                      key={`${i.id}-${i.particularMedio ?? ""}`}
                      defaultValue={i.particularMedio != null ? String(i.particularMedio).replace(".", ",") : ""}
                      placeholder="R$"
                      inputMode="decimal"
                      className={cn(inputCls, "w-28 py-1")}
                      onBlur={(e) => {
                        const v = parse(e.target.value);
                        if (v !== i.particularMedio) salvarItem.mutate({ tipo: i.tipo, id: i.id, preco_particular_medio: v, usar_na_economia: i.usarNaEconomia });
                      }}
                    />
                  </td>
                  <td className="py-2">
                    <Switch
                      checked={i.usarNaEconomia}
                      aria-label={`Usar ${i.nome} no cálculo de economia`}
                      onCheckedChange={(c) => salvarItem.mutate({ tipo: i.tipo, id: i.id, preco_particular_medio: i.particularMedio, usar_na_economia: c })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!base.isLoading && itens.length === 0 && <p className="py-4 text-sm text-ink-muted">Nenhum item encontrado.</p>}
        </div>
        <p className="mt-2 text-[12.5px] text-ink-muted">Itens sem valor com o cartão (como os de odontologia) não entram no cálculo, mesmo marcados.</p>
      </section>
    </div>
  );
}
