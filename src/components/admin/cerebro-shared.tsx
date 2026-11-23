import { toast } from "sonner";

export const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar.");


export const Carregando = () => <p className="py-6 text-[14px] text-ink-muted">Carregando…</p>;
