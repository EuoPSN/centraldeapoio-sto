import { useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { simulatorChat } from "@/lib/simulator.chat.functions";
import { ADMIN_ASSISTANT_MODEL } from "@/lib/ai-models";
import { casarClinicas, dividirEmLotes, extrairJsonArray, jaExiste, normalizarNome, rodarEmLotes, type ClinicaRef } from "@/lib/ia-importacao";
import { ClinicasPicker, useClinicasAmorSaude } from "@/components/admin/ClinicasPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Diálogo único do "Preencher com IA": cola o texto, divide em lotes (uma chamada por lote,
// em sequência), mostra prévia editável linha a linha e importa item a item.

/** Linha da prévia: `dados` é o que a aba edita; o resto é controle do diálogo. */
export interface LinhaPrevia<T> {
  dados: T;
  selected: boolean;
  existe: boolean;
  clinicaIds: string[];
  naoEncontradas: string[];
  aberta: boolean;
}

export interface ItemInterpretado<T> { dados: T; nome: string; clinicas?: string[] }

export interface ResultadoImportacao { importados: number; falhas: string[]; comClinicasParaConferir: number }

interface Props<T> {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  instrucao: string;
  placeholder: string;
  /** Prompt de sistema (cada aba monta o seu, com as regras comuns de REGRAS_IA). */
  prompt: string;
  /** Converte um objeto cru da IA; devolve null para descartar. */
  interpretar: (cru: Record<string, unknown>) => ItemInterpretado<T> | null;
  /** Nomes já cadastrados (para a etiqueta "Já existe"). */
  existentes: string[];
  /** Mostra o seletor de clínicas e casa os nomes da IA. */
  comClinicas: boolean;
  /** Colunas resumidas da linha (depois da caixinha e do nome). */
  resumo: (d: T) => ReactNode;
  /** Mesmos campos do modal manual, para editar a linha aberta. */
  campos: (d: T, alterar: (parcial: Partial<T>) => void) => ReactNode;
  nomeDe: (d: T) => string;
  /** Cria um item. `pendente` = há clínicas que não casaram. */
  importar: (d: T, extra: { clinicaIds: string[]; pendente: boolean }) => Promise<void>;
  onConcluido: () => void;
  rotuloItem: string;
}

export function IaImportDialog<T>(p: Props<T>) {
  const chat = useServerFn(simulatorChat);
  const clinicas = useClinicasAmorSaude() as ClinicaRef[];
  const [texto, setTexto] = useState("");
  const [rodando, setRodando] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaPrevia<T>[]>([]);
  const [lotesFalhos, setLotesFalhos] = useState<string[]>([]);

  const fechar = (v: boolean) => {
    p.onOpenChange(v);
    if (!v) { setLinhas([]); setTexto(""); setLotesFalhos([]); }
  };

  const gerar = async (lotes: string[], anexar: boolean) => {
    if (lotes.length === 0) return;
    setRodando(`Lote 1 de ${lotes.length}`);
    try {
      const r = await rodarEmLotes<ItemInterpretado<T>>(
        lotes,
        async (lote) => {
          const { content } = await chat({ data: { messages: [{ role: "system", content: p.prompt }, { role: "user", content: lote }], model: ADMIN_ASSISTANT_MODEL } });
          const { itens, truncado } = extrairJsonArray(content);
          const ok = itens
            .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
            .map((x) => p.interpretar(x))
            .filter((x): x is ItemInterpretado<T> => !!x && !!x.nome.trim());
          return { itens: ok, truncado };
        },
        (a, t) => setRodando(`Lote ${a} de ${t}`),
      );

      const jaNaPrevia = new Set(anexar ? linhas.map((l) => normalizarNome(p.nomeDe(l.dados))) : []);
      const novas: LinhaPrevia<T>[] = r.itens.map((it) => {
        const c = p.comClinicas && it.clinicas?.length ? casarClinicas(it.clinicas, clinicas) : { ids: [], naoEncontradas: [] };
        const chave = normalizarNome(it.nome);
        const repetido = jaNaPrevia.has(chave);
        jaNaPrevia.add(chave);
        const existe = repetido || jaExiste(it.nome, p.existentes);
        return { dados: it.dados, selected: !existe, existe, clinicaIds: c.ids, naoEncontradas: c.naoEncontradas, aberta: false };
      });
      setLotesFalhos(r.falhas.map((i) => lotes[i]));
      if (novas.length === 0 && anexar === false) {
        toast.error(r.falhas.length ? "Nenhum lote funcionou. Tente de novo." : "A IA não identificou nenhum item no texto enviado.");
        return;
      }
      setLinhas((prev) => (anexar ? [...prev, ...novas] : novas));
      if (r.falhas.length) toast.warning(`${r.falhas.length} lote(s) falharam; o que já veio foi mantido. Use "Tentar de novo".`);
      if (r.truncados.length) toast.warning(`${r.truncados.length} resposta(s) vieram cortadas; confira se não faltou item.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA.");
    } finally {
      setRodando(null);
    }
  };

  const alterar = (i: number, f: (l: LinhaPrevia<T>) => LinhaPrevia<T>) => setLinhas((prev) => prev.map((l, k) => (k === i ? f(l) : l)));
  const marcadas = useMemo(() => linhas.filter((l) => l.selected), [linhas]);

  const importar = async () => {
    if (marcadas.length === 0) return;
    setImportando(true);
    const res: ResultadoImportacao = { importados: 0, falhas: [], comClinicasParaConferir: 0 };
    try {
      for (const l of marcadas) {
        const pendente = l.naoEncontradas.length > 0;
        try {
          await p.importar(l.dados, { clinicaIds: l.clinicaIds, pendente });
          res.importados++;
          if (pendente) res.comClinicasParaConferir++;
        } catch {
          res.falhas.push(p.nomeDe(l.dados));
        }
      }
    } finally {
      setImportando(false);
    }
    let msg = `${res.importados} ${p.rotuloItem} importado(s).`;
    if (res.comClinicasParaConferir) msg += ` ${res.comClinicasParaConferir} item(ns) com clínicas para conferir.`;
    if (res.falhas.length) {
      toast.error(`${msg} Falharam: ${res.falhas.slice(0, 8).join(", ")}${res.falhas.length > 8 ? "…" : ""}.`);
      // Mantém na prévia só os que falharam, para tentar de novo.
      const falhou = new Set(res.falhas);
      setLinhas((prev) => prev.filter((l) => falhou.has(p.nomeDe(l.dados))));
    } else {
      toast.success(msg);
      fechar(false);
    }
    p.onConcluido();
  };

  return (
    <Dialog open={p.open} onOpenChange={fechar}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{p.titulo}</DialogTitle></DialogHeader>
        {linhas.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{p.instrucao}</p>
            <Textarea rows={12} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={p.placeholder} disabled={!!rodando} />
            {texto.trim() && <p className="text-xs text-muted-foreground">{dividirEmLotes(texto).length} lote(s) de até ~5.000 caracteres.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Confira antes de importar. Abra uma linha para editar todos os campos. Itens que já existem vêm desmarcados e nada existente é sobrescrito.</p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {linhas.map((l, i) => (
                <li key={i} className="p-2">
                  <div className="flex items-start gap-2">
                    <Checkbox className="mt-1" aria-label={`Importar ${p.nomeDe(l.dados)}`} checked={l.selected} onCheckedChange={(v) => alterar(i, (x) => ({ ...x, selected: v === true }))} />
                    <button type="button" className="mt-0.5 text-muted-foreground" aria-label={l.aberta ? "Fechar edição" : "Editar campos"} onClick={() => alterar(i, (x) => ({ ...x, aberta: !x.aberta }))}>
                      {l.aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.nomeDe(l.dados) || "(sem nome)"}</span>
                        {l.existe && <Badge variant="outline">Já existe</Badge>}
                        {l.naoEncontradas.length > 0 && <Badge variant="outline" className="border-warning text-warning">Clínicas para conferir</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.resumo(l.dados)}</div>
                      {l.naoEncontradas.length > 0 && <p className="text-xs text-warning">Não casaram: {l.naoEncontradas.join(", ")}</p>}
                    </div>
                  </div>
                  {l.aberta && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3 pl-8">
                      {p.campos(l.dados, (parcial) => alterar(i, (x) => ({ ...x, dados: { ...x.dados, ...parcial } })))}
                      {p.comClinicas && (
                        <ClinicasPicker value={l.clinicaIds} onChange={(ids) => alterar(i, (x) => ({ ...x, clinicaIds: ids, naoEncontradas: [] }))} />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {lotesFalhos.length > 0 && (
              <Button variant="outline" size="sm" disabled={!!rodando} onClick={() => gerar(lotesFalhos, true)}>
                {rodando ?? `Tentar de novo os ${lotesFalhos.length} lote(s) que falharam`}
              </Button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">A IA usa uma chamada por lote (~5.000 caracteres). Revise os campos antes de importar.</p>
        <DialogFooter>
          {linhas.length === 0 ? (
            <Button onClick={() => gerar(dividirEmLotes(texto), false)} disabled={!!rodando || !texto.trim()} className="gap-2">
              <Sparkles className="h-4 w-4" /> {rodando ?? "Gerar com IA"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setLinhas([]); setLotesFalhos([]); }} disabled={importando}>Voltar</Button>
              <Button onClick={importar} disabled={importando || marcadas.length === 0}>
                {importando ? "Importando..." : `Importar ${marcadas.length} ${p.rotuloItem}(s)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
