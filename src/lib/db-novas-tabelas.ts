// As tabelas da Fase D ainda não estão em src/integrations/supabase/types.ts (arquivo gerado a
// partir do banco; o Lovable o regenera depois das migrações). Até lá, o acesso a elas passa por
// este atalho sem tipos. Depois de regenerar, dá para trocar por context.supabase.from(...).
type Cliente = { from: (tabela: string) => any; rpc: (nome: string, args?: unknown) => any };
export const tabela = (supabase: unknown, nome: string) => (supabase as Cliente).from(nome);
export const rpc = (supabase: unknown, nome: string, args?: unknown) => (supabase as Cliente).rpc(nome, args);
