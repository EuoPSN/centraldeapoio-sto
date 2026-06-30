import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllSimulatorResults } from "@/lib/admin-results.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye } from "lucide-react";

const DIFFICULTY_LABELS: Record<string, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
  especialista: "Especialista"
};
const DIFFICULTY_COLORS: Record<string, string> = {
  facil: "bg-green-100 text-green-800",
  medio: "bg-yellow-100 text-yellow-800",
  dificil: "bg-orange-100 text-orange-800",
  especialista: "bg-red-100 text-red-800"
};

export function SimulatorResultsTab() {
  const fn = useServerFn(listAllSimulatorResults);
  const q = useQuery({ queryKey: ["admin-simulator-results"], queryFn: () => fn() });
  const results = (q.data ?? []) as any[];
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const filtered = results.filter((r) => {
    const name = r.profiles?.display_name ?? r.profiles?.email ?? "";
    const term = search.toLowerCase();
    return name.toLowerCase().includes(term) || (r.profile_name ?? "").toLowerCase().includes(term);
  });

  const notaCor = (nota: number) =>
    nota >= 70 ? "text-emerald-600" : nota >= 40 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Histórico de Atendimentos Simulados</h2>
        <p className="text-sm text-muted-foreground">Veja todas as simulações realizadas pelos atendentes, com nota e detalhes.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por atendente ou perfil..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="divide-y">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground p-8 text-sm">Nenhum atendimento encontrado.</p>
        )}
        {filtered.map((r) => (
          <button key={r.id} onClick={() => setSelected(r)} className="w-full text-left p-4 hover:bg-muted/40 transition flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{r.profiles?.display_name ?? r.profiles?.email ?? "Atendente"}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("pt-BR")} · {r.profile_name}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={DIFFICULTY_COLORS[r.difficulty]}>{DIFFICULTY_LABELS[r.difficulty] ?? r.difficulty}</Badge>
              <span className={`text-lg font-bold ${notaCor(r.nota)}`}>{r.nota}</span>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.profiles?.display_name ?? selected.profiles?.email} — {selected.profile_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="text-center">
                  <span className={`text-4xl font-bold ${notaCor(selected.nota)}`}>{selected.nota}</span>
                  <span className="text-muted-foreground">/100</span>
                </div>
                <p className="text-sm text-muted-foreground">{selected.resumo}</p>
                {selected.pontos_fortes?.length > 0 && (
                  <div><p className="text-xs font-semibold text-emerald-700 mb-1">✅ Pontos fortes</p>
                    <ul className="text-xs space-y-0.5">{selected.pontos_fortes.map((p: string, i: number) => <li key={i}>• {p}</li>)}</ul></div>
                )}
                {selected.pontos_melhoria?.length > 0 && (
                  <div><p className="text-xs font-semibold text-yellow-700 mb-1">⚠️ Pontos de melhoria</p>
                    <ul className="text-xs space-y-0.5">{selected.pontos_melhoria.map((p: string, i: number) => <li key={i}>• {p}</li>)}</ul></div>
                )}
                {selected.erros?.length > 0 && (
                  <div><p className="text-xs font-semibold text-red-700 mb-1">❌ Erros</p>
                    <ul className="text-xs space-y-0.5">{selected.erros.map((p: string, i: number) => <li key={i}>• {p}</li>)}</ul></div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
