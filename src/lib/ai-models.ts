// Modelos de IA usados pela Central, um por uso.
// Para trocar o modelo de um recurso, mude só aqui.
// Todos passam pelo Lovable AI Gateway (src/lib/ai-gateway.server.ts).
//
// Este arquivo só tem constantes: pode ser importado tanto no servidor
// quanto nos componentes do navegador.

/** Chat da MarcIAna (assistente). É também o padrão salvo em ai_settings.model. */
export const MARCIANA_CHAT_MODEL = "google/gemini-3-flash-preview";

/** Simulador: o cliente virtual que conversa com o atendente. */
export const SIMULATOR_CLIENT_MODEL = "google/gemini-2.5-flash";

/** Simulador: avaliação do atendimento ao final (nota, pontos fortes, erros). */
export const SIMULATOR_EVALUATION_MODEL = "google/gemini-2.5-flash";

/** Geração de cenários de treino: perfis de cliente, jornadas e cenários de problema. */
export const SCENARIO_GENERATION_MODEL = "google/gemini-2.5-flash";

/** Geração de scripts (tela Criar Script). */
export const SCRIPT_GENERATION_MODEL = "google/gemini-2.5-flash";

/** Correção das respostas abertas dos simulados (provas). */
export const QUIZ_GRADING_MODEL = "google/gemini-2.5-flash";

/** Análise do painel de funcionários (perfil, nível P1–P4, recomendações). */
export const EMPLOYEE_PANEL_MODEL = "google/gemini-2.5-flash";

/** Organizador automático do Fluxo de Atendimento no Painel Admin. */
export const ADMIN_ORGANIZER_MODEL = "google/gemini-2.5-flash";

/**
 * Demais assistentes do Painel Admin: preenchimento automático de preços e
 * contatos, descrições de busca, changelog e rascunho de fatos essenciais.
 */
export const ADMIN_ASSISTANT_MODEL = "google/gemini-2.5-flash";

/** Embeddings da busca semântica (1536 dimensões). */
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * "O cliente disse…" (Scripts): classificar a fala do cliente, sugerir resposta
 * para objeção nova e agrupar falas parecidas na fila do Admin.
 */
export const CLIENTE_DISSE_MODEL = "google/gemini-2.5-flash";

/** Copiloto: lê a conversa (texto ou prints) e sugere a próxima mensagem. Precisa aceitar imagem. */
export const COPILOTO_MODEL = "google/gemini-2.5-flash";

/** Raio-X da venda: análise de uma venda perdida (técnicas que faltaram, escrita, reescrita). */
export const RAIOX_MODEL = "google/gemini-2.5-flash";
