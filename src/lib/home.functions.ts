import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Contagens da linha "Pendências" da Início (só admin). Só conta, não traz linhas.
// O "sem check-list hoje" vem do resumo do check-list do admin
// (getChecklistSummaryForDate), chamado direto pela página.
export const getAdminPendencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [drafts, suggestions] = await Promise.all([
      // Fila do Criar Script: rascunhos aguardando aprovação.
      db.from("message_drafts").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      // Sugestões que o admin ainda não abriu nem respondeu.
      db.from("suggestions").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    ]);
    if (drafts.error) throw new Error(drafts.error.message);
    if (suggestions.error) throw new Error(suggestions.error.message);
    return {
      scriptsParaAprovar: (drafts.count ?? 0) as number,
      sugestoesNovas: (suggestions.count ?? 0) as number,
    };
  });
