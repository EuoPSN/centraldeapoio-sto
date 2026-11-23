import { toast } from "sonner";

export const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
