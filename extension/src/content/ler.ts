// Tipos da leitura (preenchido na seção 3).
export interface Mensagem { de: "cliente" | "atendente"; texto: string; hora: string }
export interface Identificacao { nome: string; numero: string; grupo: false; motivo?: undefined }
export interface Conversa { nome: string; numero: string; mensagens: Mensagem[] }
