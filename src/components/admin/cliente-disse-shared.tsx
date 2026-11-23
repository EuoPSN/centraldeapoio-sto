import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ANGULO_LABEL, ANGULO_TIPOS, type AnguloTipo, type ObjecaoConteudo } from "@/lib/cliente-disse";
import { FieldLabel, TagsField, inputCls } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";

export const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar.");


// ===========================================================================
// Formulário de objeção (usado em Objeções e em Objeções novas)
// ===========================================================================

export function ObjecaoForm({ value, onChange }: { value: ObjecaoConteudo; onChange: (v: ObjecaoConteudo) => void }) {
  const set = (patch: Partial<ObjecaoConteudo>) => onChange({ ...value, ...patch });
  return (
    <div>
      <FieldLabel>Nome da objeção</FieldLabel>
      <input className={inputCls} value={value.nome} onChange={(e) => set({ nome: e.target.value })} />

      <FieldLabel>Como o cliente costuma dizer</FieldLabel>
      <TagsField value={value.exemplos_de_fala} onChange={(v) => set({ exemplos_de_fala: v })} placeholder="Digite uma fala e Enter" />

      <FieldLabel>O que ele(a) pode querer dizer</FieldLabel>
      <div className="space-y-2">
        {value.leituras.map((l, i) => (
          <div key={i} className="rounded-md border border-line p-2.5">
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Leitura (ex.: Não viu valor ainda)"
                value={l.titulo}
                onChange={(e) => set({ leituras: value.leituras.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) })}
              />
              <button type="button" aria-label="Remover leitura" className="text-ink-muted hover:text-ink" onClick={() => set({ leituras: value.leituras.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <input
              className={cn(inputCls, "mt-2")}
              placeholder="Pergunte: …"
              value={l.pergunta}
              onChange={(e) => set({ leituras: value.leituras.map((x, j) => (j === i ? { ...x, pergunta: e.target.value } : x)) })}
            />
          </div>
        ))}
        {value.leituras.length < 8 && (
          <button type="button" className="text-[13.5px] font-semibold text-gold-text hover:underline" onClick={() => set({ leituras: [...value.leituras, { titulo: "", pergunta: "" }] })}>
            + Leitura
          </button>
        )}
      </div>

      <FieldLabel>Ângulos de resposta</FieldLabel>
      <div className="space-y-2">
        {value.angulos.map((a, i) => (
          <div key={i} className="rounded-md border border-line p-2.5">
            <div className="flex gap-2">
              <select
                className={cn(inputCls, "w-36 shrink-0")}
                value={a.tipo}
                onChange={(e) => set({ angulos: value.angulos.map((x, j) => (j === i ? { ...x, tipo: e.target.value as AnguloTipo } : x)) })}
              >
                {ANGULO_TIPOS.map((t) => <option key={t} value={t}>{ANGULO_LABEL[t]}</option>)}
              </select>
              <input
                className={inputCls}
                placeholder="Rótulo (ex.: a conta)"
                value={a.rotulo}
                onChange={(e) => set({ angulos: value.angulos.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)) })}
              />
              <button type="button" aria-label="Remover ângulo" className="text-ink-muted hover:text-ink" onClick={() => set({ angulos: value.angulos.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              rows={3}
              className={cn(inputCls, "mt-2")}
              placeholder="Texto da resposta"
              value={a.texto}
              onChange={(e) => set({ angulos: value.angulos.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
            />
          </div>
        ))}
        {value.angulos.length < 6 && (
          <button
            type="button"
            className="text-[13.5px] font-semibold text-gold-text hover:underline"
            onClick={() => set({ angulos: [...value.angulos, { tipo: ANGULO_TIPOS[value.angulos.length % 3], rotulo: "", texto: "" }] })}
          >
            + Ângulo
          </button>
        )}
      </div>

      <FieldLabel>Pergunta para avançar</FieldLabel>
      <textarea rows={2} className={inputCls} value={value.pergunta_avancar ?? ""} onChange={(e) => set({ pergunta_avancar: e.target.value || null })} />

      <FieldLabel>Evite dizer</FieldLabel>
      <textarea rows={2} className={inputCls} value={value.evite_dizer ?? ""} onChange={(e) => set({ evite_dizer: e.target.value || null })} />
    </div>
  );
}
