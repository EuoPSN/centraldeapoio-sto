import { useState } from "react";
import { PLANOS_FICHA, passosParaTexto, textoParaPassos, type CamposFicha } from "@/lib/fichas";
import { PONTOS, PONTO_LABEL } from "@/lib/retomada";
import { cn } from "@/lib/utils";

// Campos editáveis de uma ficha de "Conversas que fecharam".
// Usado na janela do atendente (poucos campos) e no Admin (todos os campos).

const campo = "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14.5px] leading-6 text-ink outline-none focus:border-gold";
const rotulo = "mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted";

export function FichaCampos({ valor, onChange, objecoes, completo = false, idBase = "ficha" }: {
  valor: CamposFicha;
  onChange: (v: CamposFicha) => void;
  objecoes: { id: string; nome: string }[];
  /** Mostra também "Onde travou" e "Por que funcionou" (Admin). */
  completo?: boolean;
  idBase?: string;
}) {
  // O texto dos passos fica à parte para a digitação não ser renumerada a cada tecla.
  // Quem usa o formulário troca a `key` quando a ficha muda de fora (outra ficha, nova geração).
  const [passos, setPassos] = useState(() => passosParaTexto(valor.o_que_fez));
  const set = <K extends keyof CamposFicha>(k: K, v: CamposFicha[K]) => onChange({ ...valor, [k]: v });
  const outra = !valor.objecao_id;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idBase}-obj`} className={rotulo}>Objeção</label>
          <select
            id={`${idBase}-obj`}
            className={campo}
            value={valor.objecao_id ?? ""}
            onChange={(e) => {
              const o = objecoes.find((x) => x.id === e.target.value);
              onChange({ ...valor, objecao_id: o?.id ?? null, objecao_rotulo: o ? o.nome : valor.objecao_id ? "" : valor.objecao_rotulo });
            }}
          >
            <option value="">{valor.objecao_rotulo && outra ? `Outra: ${valor.objecao_rotulo}` : "Outra / nenhuma"}</option>
            {objecoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          {outra && (
            <input
              aria-label="Nome da objeção"
              className={cn(campo, "mt-1.5")}
              value={valor.objecao_rotulo}
              maxLength={80}
              placeholder="Nome curto da objeção"
              onChange={(e) => set("objecao_rotulo", e.target.value)}
            />
          )}
        </div>
        <div>
          <label htmlFor={`${idBase}-ponto`} className={rotulo}>Parou em</label>
          <select id={`${idBase}-ponto`} className={campo} value={valor.ponto_parada} onChange={(e) => set("ponto_parada", e.target.value as CamposFicha["ponto_parada"])}>
            {PONTOS.map((p) => <option key={p} value={p}>{PONTO_LABEL[p]}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idBase}-plano`} className={rotulo}>Plano</label>
          <select id={`${idBase}-plano`} className={campo} value={valor.plano} onChange={(e) => set("plano", e.target.value as CamposFicha["plano"])}>
            {PLANOS_FICHA.map((p) => <option key={p} value={p}>{p === "outro" ? "Outro / não disse" : p}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idBase}-perfil`} className={rotulo}>Perfil</label>
          <input id={`${idBase}-perfil`} className={campo} value={valor.perfil_cliente} maxLength={160} onChange={(e) => set("perfil_cliente", e.target.value)} placeholder="Ex.: Família com 4 dependentes" />
        </div>
      </div>

      {completo && (
        <div>
          <label htmlFor={`${idBase}-travou`} className={rotulo}>Onde travou</label>
          <textarea id={`${idBase}-travou`} className={cn(campo, "min-h-[64px]")} rows={2} value={valor.onde_travou} onChange={(e) => set("onde_travou", e.target.value)} />
        </div>
      )}

      <div>
        <label htmlFor={`${idBase}-fez`} className={rotulo}>O que você fez</label>
        <textarea
          id={`${idBase}-fez`}
          className={cn(campo, "min-h-[84px]")}
          rows={3}
          value={passos}
          onChange={(e) => { setPassos(e.target.value); set("o_que_fez", textoParaPassos(e.target.value)); }}
        />
      </div>

      <div>
        <label htmlFor={`${idBase}-chave`} className={rotulo}>Mensagem-chave (seu texto, com [nome])</label>
        <textarea id={`${idBase}-chave`} className={cn(campo, "min-h-[84px]")} rows={3} value={valor.mensagem_chave} onChange={(e) => set("mensagem_chave", e.target.value)} />
      </div>

      {completo && (
        <div>
          <label htmlFor={`${idBase}-porque`} className={rotulo}>Por que funcionou</label>
          <textarea id={`${idBase}-porque`} className={cn(campo, "min-h-[64px]")} rows={2} value={valor.por_que_funcionou} onChange={(e) => set("por_que_funcionou", e.target.value)} />
        </div>
      )}
    </div>
  );
}
