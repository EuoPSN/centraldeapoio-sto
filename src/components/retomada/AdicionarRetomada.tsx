import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { criarRetomada } from "@/lib/retomada.functions";
import {
  PONTOS, PONTO_LABEL, QUANDO, mascaraTelefone, soDigitos, type QuandoId, type Ponto, type Retomada,
} from "@/lib/retomada";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { ChoicePill, Overline } from "@/components/cliente-disse/shared";
import { RETOMADA_BASE_KEY, RETOMADA_CONTAGEM_KEY } from "@/components/retomada/hooks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { inputCls } from "@/components/admin/AdminListDetail";

/** Botão "+ Adicionar à retomada" com o painel de cadastro. */
export function AdicionarRetomada({ onCriada, inicial, trigger }: {
  onCriada?: (r: Retomada) => void;
  /** Dados que já vêm preenchidos (ex.: do Copiloto). O telefone nunca vem daqui. */
  inicial?: { nome?: string | null; ponto?: Ponto | null };
  /** Botão que abre o painel (padrão: "+ Adicionar à retomada"). */
  trigger?: ReactNode;
}) {
  const [open, setOpenState] = useState(false);
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [ponto, setPonto] = useState<Ponto>("nao_respondeu_primeira");
  const [quando, setQuando] = useState<QuandoId>("amanha");
  const [obs, setObs] = useState("");
  const fn = useServerFn(criarRetomada);
  const qc = useQueryClient();

  const setOpen = (v: boolean) => {
    if (v && inicial) {
      setNome((inicial.nome ?? "").slice(0, 40));
      if (inicial.ponto) setPonto(inicial.ponto);
    }
    setOpenState(v);
  };

  const reset = () => { setNome(""); setTel(""); setPonto("nao_respondeu_primeira"); setQuando("amanha"); setObs(""); };

  const criar = useMutation({
    mutationFn: () => fn({ data: { primeiro_nome: nome, telefone: soDigitos(tel) || null, observacao: obs, ponto_parada: ponto, quando } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: RETOMADA_BASE_KEY });
      qc.invalidateQueries({ queryKey: RETOMADA_CONTAGEM_KEY });
      toast.success(`${r.primeiro_nome} entrou na retomada.`);
      onCriada?.(r);
      reset();
      setOpen(false);
    },
    onError: () => toast.error("Não consegui adicionar agora. Tente de novo."),
  });

  const telOk = !tel || (soDigitos(tel).length >= 10 && soDigitos(tel).length <= 11);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? <GoldButton className="h-11 px-5">+ Adicionar à retomada</GoldButton>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(440px,calc(100vw-2rem))] rounded-2xl border-line bg-surface p-5 shadow-xl">
        <form
          onSubmit={(e) => { e.preventDefault(); if (nome.trim() && telOk && !criar.isPending) criar.mutate(); }}
          className="space-y-4"
        >
          <h2 className="text-[18px] font-medium leading-6 text-ink">Adicionar à retomada</h2>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Overline className="mb-1 text-ink-muted">Primeiro nome</Overline>
              <input className={inputCls} value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} autoFocus required />
            </label>
            <label className="block">
              <Overline className="mb-1 text-ink-muted">WhatsApp</Overline>
              <input
                className={inputCls} inputMode="tel" placeholder="(31) 9 0000-0000" value={tel}
                aria-invalid={!telOk}
                onChange={(e) => setTel(mascaraTelefone(e.target.value))}
              />
            </label>
          </div>

          <fieldset>
            <Overline className="mb-1.5 text-ink-muted">Onde parou</Overline>
            <div className="flex flex-wrap gap-1.5">
              {PONTOS.map((p) => (
                <ChoicePill key={p} active={p === ponto} onClick={() => setPonto(p)}>{PONTO_LABEL[p]}</ChoicePill>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <Overline className="mb-1.5 text-ink-muted">Quando retomar</Overline>
            <div className="flex flex-wrap gap-1.5">
              {QUANDO.map((q) => (
                <ChoicePill key={q.id} active={q.id === quando} onClick={() => setQuando(q.id)}>{q.label}</ChoicePill>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <Overline className="mb-1 text-ink-muted">Observação</Overline>
            <input className={inputCls} value={obs} maxLength={500} placeholder="Ex.: veio do anúncio de odontologia" onChange={(e) => setObs(e.target.value)} />
          </label>

          <p className="text-[12.5px] leading-5 text-ink-muted">
            O número fica visível só para você e é apagado quando o cliente sai da fila ou em 30 dias.
          </p>

          <div className="flex gap-2">
            <GoldButton type="submit" className="h-10" disabled={!nome.trim() || !telOk || criar.isPending}>Adicionar</GoldButton>
            <OutlineButton className="h-10" onClick={() => { reset(); setOpen(false); }}>Cancelar</OutlineButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
