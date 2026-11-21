import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { definirAvisoAquecimento, getStatusAquecimento } from "@/lib/aquecimento.functions";
import { useAvisosPermissao } from "@/components/retomada/Avisos";

export const STATUS_AQUECIMENTO_KEY = ["aquecimento-status"] as const;

/** Status do aquecimento do dia (faixa do Início, ponto do menu e avisos do Chrome). */
export function useStatusAquecimento(enabled = true) {
  const fn = useServerFn(getStatusAquecimento);
  return useQuery({
    queryKey: STATUS_AQUECIMENTO_KEY,
    queryFn: () => fn({}),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 300_000,
  });
}

/** "Avisos do aquecimento": liga ou desliga a notificação do Chrome. Desligar não tira a faixa do Início. */
export function AvisosAquecimentoToggle() {
  const q = useStatusAquecimento();
  const qc = useQueryClient();
  const fn = useServerFn(definirAvisoAquecimento);
  const permissao = useAvisosPermissao();
  const salvar = useMutation({
    mutationFn: (notificar: boolean) => fn({ data: { notificar } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: STATUS_AQUECIMENTO_KEY }),
    onError: () => toast.error("Não consegui salvar agora. Tente de novo."),
  });
  if (!q.data) return null;
  const ligado = q.data.notificar;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
      <label className="flex cursor-pointer items-center gap-2 text-[14px] text-ink">
        <input
          type="checkbox"
          checked={ligado}
          disabled={salvar.isPending}
          onChange={(e) => salvar.mutate(e.target.checked)}
          className="h-4 w-4 accent-[var(--gold,#B8872E)]"
        />
        Avisos do aquecimento
      </label>
      <span className="text-[13px] text-ink-muted">Notificação do Chrome nos horários do dia, com a Omnia aberta.</span>
      {ligado && permissao.podePedir && (
        <button type="button" onClick={permissao.pedir} className="inline-flex items-center gap-1.5 text-[13.5px] text-ink underline underline-offset-2 hover:text-gold">
          <Bell className="h-3.5 w-3.5" strokeWidth={1.5} /> Permitir notificações no navegador
        </button>
      )}
    </div>
  );
}
