/** Traduz erros de login para português simples. */
export function mensagemDeLogin(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Este e-mail ainda não foi confirmado na Omnia.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão com a Omnia. Confira a internet.";
  return "Não consegui entrar agora. Tente de novo.";
}
