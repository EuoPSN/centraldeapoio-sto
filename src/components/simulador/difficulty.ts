// Rótulos e cores de dificuldade compartilhados pelas telas do Simulador IA.
// No redesign OMNIA, a dificuldade aparece só como ponto + palavra (sem selos
// coloridos verde/amarelo/vermelho): Fácil = line-strong, Médio = gold, Difícil = ink.
export const DIFFICULTY_LABELS: Record<string, string> = {
  facil: "Fácil", medio: "Médio", dificil: "Difícil", especialista: "Especialista",
};

export const DIFFICULTY_DOT_CLASSES: Record<string, string> = {
  facil: "bg-line-strong", medio: "bg-gold", dificil: "bg-ink", especialista: "bg-ink",
};

export const DIFFICULTY_TEXT_CLASSES: Record<string, string> = {
  facil: "text-line-strong", medio: "text-gold-text", dificil: "text-ink", especialista: "text-ink",
};
