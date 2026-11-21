/** "21/11" a partir de uma data (AAAA-MM-DD) ou de um instante ISO, no fuso de Brasília. */
export function diaMes(v: string): string {
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? v
    : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(v));
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}
