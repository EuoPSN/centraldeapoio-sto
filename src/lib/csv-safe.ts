/** Escapa uma célula de CSV e neutraliza fórmulas (=, +, -, @, tab, CR) no Excel/Sheets. */
export function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
