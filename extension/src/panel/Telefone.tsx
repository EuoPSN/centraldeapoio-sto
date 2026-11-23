import { ERRO_TELEFONE, numeroMascarado, validarTelefoneDigitado } from "../lib/numeros";
import type { DadosDoContato } from "../lib/mensagens";

export const AVISO_SEM_NUMERO = "Sem número, o Omnia não evita ticket duplicado nem fecha o ticket pela planilha do CRM.";

/** Número que vai para o ticket: o digitado (se válido) ou o lido da conversa. */
export function numeroEfetivo(lido: string, digitado: string): string {
  const v = validarTelefoneDigitado(digitado);
  return v.ok && v.digitos ? v.digitos : lido;
}

/** Campo "Telefone (opcional)". O número nunca vai para a IA: só para consultar/salvar o ticket. */
export function CampoTelefone({
  lido, valor, corrigindo, onChange, onCorrigir, contato, onUsarContato,
}: {
  lido: string;
  valor: string;
  corrigindo: boolean;
  onChange: (v: string) => void;
  onCorrigir: () => void;
  contato: DadosDoContato | null;
  onUsarContato: (numero: string) => void;
}) {
  const v = validarTelefoneDigitado(valor);
  const erro = !v.ok ? (v.erro || ERRO_TELEFONE) : "";
  const efetivo = numeroEfetivo(lido, valor);
  const mostrarLido = !!lido && !corrigindo;
  const numeroDoContato = contato?.numero ?? "";
  return (
    <div className="card">
      {mostrarLido ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span className="suave">Telefone lido: {numeroMascarado(lido)}</span>
          <button className="pilula" style={{ flex: "0 0 auto" }} onClick={onCorrigir}>Corrigir</button>
        </div>
      ) : (
        <label className="campo" style={{ marginBottom: 6 }}><span>Telefone (opcional)</span>
          <input type="tel" inputMode="tel" autoComplete="off" placeholder="(31) 99999-9999" value={valor} aria-invalid={!!erro} onChange={(e) => onChange(e.target.value)} />
        </label>
      )}
      {!mostrarLido && <p className="suave" style={{ margin: "0 0 6px" }}>Se quiser, digite o número do cliente para evitar ticket duplicado.</p>}
      {erro && <p className="erro" role="alert" style={{ margin: "0 0 6px" }}>{erro}</p>}
      {!mostrarLido && numeroDoContato && (
        <button className="pilula" style={{ flex: "0 0 auto" }} onClick={() => onUsarContato(numeroDoContato)}>Usar o número de Dados do contato</button>
      )}
      {!mostrarLido && !numeroDoContato && (
        <p className="suave" style={{ margin: 0 }}>Para preencher o número, abra Dados do contato no WhatsApp e clique em “Usar o número”.</p>
      )}
      {!efetivo && <p className="suave" style={{ margin: "6px 0 0" }}>{AVISO_SEM_NUMERO}</p>}
    </div>
  );
}
