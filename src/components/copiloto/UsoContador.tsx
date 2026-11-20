import { mensagemLimite, type UsoStatus } from "@/lib/cerebro";

/** "N de M hoje" no canto da página + aviso discreto a partir de 80% e bloqueio no limite. */
export function UsoContador({ uso }: { uso: UsoStatus | undefined }) {
  if (!uso || uso.limite == null) return null;
  return (
    <div className="text-right">
      <p className="text-[13.5px] text-ink-muted">{Math.min(uso.usado, uso.limite)} de {uso.limite} hoje</p>
    </div>
  );
}

export function UsoAviso({ uso }: { uso: UsoStatus | undefined }) {
  if (!uso || uso.limite == null) return null;
  if (uso.bloqueado) return <p role="status" className="mt-3 text-[13.5px] text-ink">{mensagemLimite(uso.ferramenta)}</p>;
  if (uso.aviso) return <p role="status" className="mt-3 text-[13px] text-ink-muted">Você já usou {uso.usado} de {uso.limite} hoje.</p>;
  return null;
}
