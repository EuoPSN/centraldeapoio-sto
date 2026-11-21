import { useEffect, useState } from "react";
import { gerarDiagnostico } from "../lib/diagnostico";
import type { Relatorio } from "../lib/mensagens";

/** Relatório só de ESTRUTURA do WhatsApp Web (sem nomes, números nem mensagens), para copiar e enviar ao suporte. */
export function Diagnostico({ onVoltar }: { onVoltar: () => void }) {
  const [rel, setRel] = useState<Relatorio | null>(null);
  const [copiado, setCopiado] = useState<"sim" | "erro" | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function gerar() {
    setCarregando(true);
    setCopiado(null);
    setRel(await gerarDiagnostico());
    setCarregando(false);
  }
  useEffect(() => { void gerar(); }, []);

  const texto = rel ? JSON.stringify(rel, null, 2) : "";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado("sim");
    } catch {
      setCopiado("erro");
    }
  }

  return (
    <div>
      <button className="pilula" onClick={onVoltar} style={{ marginBottom: 10 }}>← Voltar</button>
      <div className="card">
        <h2>Diagnóstico</h2>
        <p className="suave">Mostra só a estrutura da página do WhatsApp Web (tipos de elemento e quais partes foram encontradas). Não inclui nomes, números nem mensagens.</p>
        {rel && (
          <p className="suave">
            Resultado: <strong>{rel.deteccao.decisao === "le" ? "leria esta conversa" : "não leria esta conversa"}</strong> · {rel.deteccao.motivo}
          </p>
        )}
        <div className="linha">
          <button className="btn primario" onClick={copiar} disabled={!rel || carregando}>Copiar diagnóstico</button>
          <button className="btn" onClick={gerar} disabled={carregando}>{carregando ? "Gerando…" : "Gerar de novo"}</button>
        </div>
        {copiado === "sim" && <p className="suave" role="status">Copiado. Cole na conversa com o suporte.</p>}
        {copiado === "erro" && <p className="erro" role="alert">Não consegui copiar sozinho. Abra “Ver o texto”, selecione tudo e copie.</p>}
        {rel && (
          <details>
            <summary className="suave" style={{ cursor: "pointer" }}>Ver o texto</summary>
            <textarea readOnly value={texto} rows={12} style={{ width: "100%", fontSize: 11 }} onFocus={(e) => e.currentTarget.select()} />
          </details>
        )}
      </div>
    </div>
  );
}
