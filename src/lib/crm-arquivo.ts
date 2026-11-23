// Lê o arquivo da planilha (.xlsx ou .csv) NO NAVEGADOR com SheetJS e devolve só a matriz de células.
// Nada é enviado ao servidor e o arquivo não é guardado. Carregado sob demanda (o SheetJS é grande).

const TAMANHO_MAX = 15 * 1024 * 1024;

export async function arquivoParaMatriz(arquivo: File): Promise<unknown[][]> {
  if (arquivo.size > TAMANHO_MAX) throw new Error("A planilha é grande demais (máximo 15 MB).");
  const nome = arquivo.name.toLowerCase();
  if (!/\.(xlsx|csv)$/.test(nome)) throw new Error("Envie um arquivo .xlsx ou .csv exportado do CRM.");
  const XLSX = await import("xlsx");
  let wb;
  if (nome.endsWith(".csv")) {
    let texto = await arquivo.text();
    if (texto.includes("�")) texto = new TextDecoder("latin1").decode(await arquivo.arrayBuffer()); // CSV em Windows-1252
    // raw: as células ficam como texto (datas dd/mm/aaaa não são reinterpretadas no padrão americano).
    wb = XLSX.read(texto, { type: "string", raw: true });
  } else {
    wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: false });
  }
  const aba = wb.Sheets[wb.SheetNames[0]];
  if (!aba) throw new Error("A planilha está vazia.");
  return XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: null, blankrows: false });
}
