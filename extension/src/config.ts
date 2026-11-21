// ÚNICO lugar com endereços e chaves da extensão.
// Se a hospedagem mudar (oficialização), mude só este arquivo e publique nova versão.
// Mantenha este arquivo sem sintaxe específica de TypeScript (enum etc.): o script
// de build do manifest o importa diretamente.

export const CONFIG = {
  /** Backend (Lovable Cloud / Supabase): login e tabelas protegidas por RLS. */
  SUPABASE_URL: "https://qkvqwzwqlaqmepdnmyxs.supabase.co",
  /** Chave pública (anon/publishable). Pode ficar na extensão; não é segredo. */
  SUPABASE_ANON_KEY: "sb_publishable_d1pRHM_YMp9KEtwH6gAPfw_x-gB7Kpw",
  /** Endereço do app da Omnia: funções de IA e ticket (/api/extensao/*) e links do painel. */
  OMNIA_URL: "https://CONFIGURAR-ENDERECO-DA-OMNIA.lovable.app",
  /** Versão do texto "O que a extensão faz" que o atendente confirma. */
  VERSAO_ACEITE: "1",
};
