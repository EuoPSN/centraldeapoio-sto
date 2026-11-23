import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getAmorSaude, setAvaliacaoOdonto } from "@/lib/amorsaude.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";


// ============================================================
// Exames (Laboratoriais e de Imagem)
// ============================================================
export type ExameDraft = { nome: string; tipo: "laboratorial" | "imagem"; categoria: string; material: string; jejum: boolean; preparo: string; descricao: string; observacoes: string; selected: boolean; media_referencia?: string; preparo_itens?: string; clinicas?: string[] };


// ============================================================
// Procedimentos Odontológicos
// ============================================================
export type ProcedimentoDraft = { nome: string; categoria: string; descricao: string; cuidados_pos: string; observacoes: string; selected: boolean; clinicas?: string[] };


// Valor geral da "Avaliação odontológica (Cartão de TODOS)", mostrado em Amor Saúde → Odontologia.
export function AvaliacaoOdontoField() {
  const getFn = useServerFn(getAmorSaude);
  const setFn = useServerFn(setAvaliacaoOdonto);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["amor-saude"], queryFn: () => getFn({}) });
  const atual = q.data?.avaliacaoOdonto ?? null;
  const [valor, setValor] = useState<string | null>(null);
  const shown = valor ?? (atual != null ? String(atual).replace(".", ",") : "");
  const save = useMutation({
    mutationFn: () => setFn({ data: { valor: shown.trim() ? Number(shown.replace(",", ".")) : null } }),
    onSuccess: () => { toast.success("Valor da avaliação salvo."); setValor(null); qc.invalidateQueries({ queryKey: ["amor-saude"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
      <div>
        <Label htmlFor="avaliacao-odonto">Avaliação odontológica (Cartão de TODOS), R$</Label>
        <Input id="avaliacao-odonto" inputMode="decimal" className="mt-1 w-40" value={shown} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 25,00" />
      </div>
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || valor == null}>Salvar valor</Button>
      <p className="basis-full text-xs text-muted-foreground">Vazio: o bloco da avaliação não aparece no site.</p>
    </div>
  );
}


// ============================================================
// Clínicas (cadastro das clínicas Amor Saúde: contatos_enderecos, tipo "clinica_amor_saude")
// ============================================================
export type ClinicaDraft = { nome_regiao: string; endereco: string; numero: string; contato1: string; contato2: string; contato3: string; selected: boolean };
