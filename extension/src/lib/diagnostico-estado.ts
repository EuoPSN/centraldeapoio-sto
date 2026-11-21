// Guarda, só na memória do painel, o motivo do último resultado de leitura (sem conteúdo da conversa).
// O diagnóstico inclui esse motivo para eu entender o que o atendente viu.
export interface UltimoResultado { codigo: string; motivo: string }

let ultimo: UltimoResultado | null = null;

export function registrarResultado(codigo: string, motivo: string): void { ultimo = { codigo, motivo }; }
export function ultimoResultado(): UltimoResultado | null { return ultimo; }
