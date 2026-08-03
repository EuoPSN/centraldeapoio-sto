// Interpreta formatação estilo WhatsApp em texto puro: *negrito*, _itálico_, ~riscado~,
// preservando quebras de linha. Usado nas bolhas de mensagem do Simulador.
export function WhatsAppText({ text }: { text: string }) {
  const linhas = text.split("\n");
  return (
    <>
      {linhas.map((linha, i) => (
        <span key={i}>
          {formatarLinha(linha)}
          {i < linhas.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function formatarLinha(linha: string) {
  const partes = linha.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return partes.map((parte, i) => {
    if (parte.startsWith("*") && parte.endsWith("*") && parte.length > 2) {
      return <strong key={i}>{parte.slice(1, -1)}</strong>;
    }
    if (parte.startsWith("_") && parte.endsWith("_") && parte.length > 2) {
      return <em key={i}>{parte.slice(1, -1)}</em>;
    }
    if (parte.startsWith("~") && parte.endsWith("~") && parte.length > 2) {
      return <s key={i}>{parte.slice(1, -1)}</s>;
    }
    return <span key={i}>{parte}</span>;
  });
}
