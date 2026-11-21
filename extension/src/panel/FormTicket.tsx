import { ETAPAS_FUNIL, ETAPA_NOME, PLANOS, PONTOS, PONTO_NOME, QUANDO, rotuloQuando } from "../lib/rotulos";

export interface CamposForm {
  etapa_funil: string;
  ponto_parada: string;
  plano: string;
  dependentes: string;
  observacao: string;
  quando: string;
}

export function FormTicket({ valor, onChange }: { valor: CamposForm; onChange: (v: CamposForm) => void }) {
  const set = (k: keyof CamposForm) => (e: { target: { value: string } }) => onChange({ ...valor, [k]: e.target.value });
  return (
    <div>
      <label className="campo"><span>Etapa do funil</span>
        <select value={valor.etapa_funil} onChange={set("etapa_funil")}>
          {ETAPAS_FUNIL.map((e) => <option key={e} value={e}>{ETAPA_NOME[e]}</option>)}
        </select>
      </label>
      <label className="campo"><span>Ponto de parada</span>
        <select value={valor.ponto_parada} onChange={set("ponto_parada")}>
          {PONTOS.map((p) => <option key={p} value={p}>{PONTO_NOME[p]}</option>)}
        </select>
      </label>
      <div className="linha">
        <label className="campo"><span>Plano</span>
          <select value={valor.plano} onChange={set("plano")}>
            <option value="">Não definido</option>
            {PLANOS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="campo"><span>Dependentes</span>
          <input type="number" min={0} max={20} inputMode="numeric" value={valor.dependentes} onChange={set("dependentes")} />
        </label>
      </div>
      <label className="campo"><span>Observação</span>
        <textarea maxLength={500} value={valor.observacao} onChange={set("observacao")} />
      </label>
      <label className="campo"><span>Retomar</span>
        <select value={valor.quando} onChange={set("quando")}>
          {QUANDO.map((q) => <option key={q.id} value={q.id}>{rotuloQuando(q.id)}</option>)}
        </select>
      </label>
    </div>
  );
}
