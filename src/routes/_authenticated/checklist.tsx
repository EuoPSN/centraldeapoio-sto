import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyChecklistToday, upsertChecklistEntry } from "@/lib/checklist.functions";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ListChecks, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checklist")({
  component: ChecklistPage,
});

interface ItemRow { id: string; titulo: string; tipo: "binario" | "meta"; meta_padrao: number | null; }
interface EntryRow { item_id: string; marcado: boolean; valor: number | null; }

function ChecklistPage() {
  const qc = useQueryClient();
  const dataFn = useServerFn(getMyChecklistToday);
  const saveFn = useServerFn(upsertChecklistEntry);
  const q = useQuery({ queryKey: ["my-checklist-today"], queryFn: () => dataFn({}) });

  const items = (q.data?.items ?? []) as ItemRow[];
  const entries = (q.data?.entries ?? []) as EntryRow[];
  const entryFor = (itemId: string) => entries.find((e) => e.item_id === itemId);

  // Campos numéricos locais, pra digitar sem salvar a cada tecla
  const [valores, setValores] = useState<Record<string, string>>({});
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const it of items) {
      if (it.tipo === "meta") {
        const e = entryFor(it.id);
        init[it.id] = e?.valor != null ? String(e.valor) : "";
      }
    }
    setValores(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const toggleBinario = async (item: ItemRow) => {
    const atual = entryFor(item.id)?.marcado ?? false;
    await saveFn({ data: { item_id: item.id, marcado: !atual } });
    qc.invalidateQueries({ queryKey: ["my-checklist-today"] });
  };

  const salvarValor = async (item: ItemRow) => {
    const num = Number(valores[item.id]);
    await saveFn({ data: { item_id: item.id, valor: Number.isFinite(num) ? num : 0 } });
    qc.invalidateQueries({ queryKey: ["my-checklist-today"] });
  };

  const isDone = (item: ItemRow) => {
    const e = entryFor(item.id);
    if (!e) return false;
    if (item.tipo === "meta") return (e.valor ?? 0) >= (item.meta_padrao ?? 0);
    return !!e.marcado;
  };

  const doneCount = items.filter(isDone).length;

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ListChecks className="h-7 w-7 text-primary" /> Check-list Diário
        </h1>
        <p className="text-muted-foreground mt-1">
          {doneCount} de {items.length} feitos hoje. Marque conforme for concluindo ao longo do dia.
        </p>
      </header>

      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!q.isLoading && items.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">Nenhum item cadastrado ainda. Fale com um administrador.</Card>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const done = isDone(item);
          return (
            <Card key={item.id} className={`p-4 flex items-center justify-between gap-4 ${done ? "bg-emerald-50 border-emerald-200" : ""}`}>
              <div className="flex items-center gap-3 min-w-0">
                {item.tipo === "binario" ? (
                  <Checkbox checked={done} onCheckedChange={() => toggleBinario(item)} className="h-5 w-5" />
                ) : (
                  done ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
                <span className={`text-sm ${done ? "font-medium" : ""}`}>{item.titulo}</span>
              </div>
              {item.tipo === "meta" ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    value={valores[item.id] ?? ""}
                    onChange={(e) => setValores((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    onBlur={() => salvarValor(item)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="w-20 h-8 text-sm"
                  />
                  <Badge variant="outline">meta {item.meta_padrao}</Badge>
                </div>
              ) : (
                done && <Badge className="bg-emerald-100 text-emerald-800 shrink-0">Feito</Badge>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
