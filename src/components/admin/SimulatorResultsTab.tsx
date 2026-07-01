import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllSimulatorResults } from "@/lib/admin-results.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye, Download } from "lucide-react";


const DIFFICULTY_LABELS: Record<string, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
  especialista: "Especialista",
};
const DIFFICULTY_COLORS: Record<string, string> = {
  facil: "bg-green-100 text-green-800",
  medio: "bg-yellow-100 text-yellow-800",
  dificil: "bg-orange-100 text-orange-800",
  especialista: "bg-red-100 text-red-800",
};

function notaCor(n: number) {
  return n >= 70 ? "text-emerald-600" : n >= 40 ? "text-yellow-600" : "text-red-600";
}

export function SimulatorResultsTab() {
  const fn = useServerFn(listAllSimulatorResults);
  const q = useQuery({ queryKey: ["admin-simulator-results"], queryFn: () => fn() });
  const results = (q.data ?? []) as any[];
  const [search, setSearch] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const filtered = useMemo(() => {
    return results.filter((r) => {
      const name = (r.profiles?.display_name ?? r.profiles?.email ?? "").toLowerCase();
      const profile = (r.profile_name ?? "").toLowerCase();
      const term = search.toLowerCase();
      const matchSearch = name.includes(term) || profile.includes(term);
      const data = new Date(r.created_at);
      const matchInicio = dataInicio ? data >= new Date(dataInicio) : true;
      const matchFim = dataFim ? data <= new Date(dataFim + "T23:59:59") : true;
      return matchSearch && matchInicio && matchFim;
    });
  }, [results, search, dataInicio, dataFim]);

  const exportarExcel = () => {
  const headers = [
    "Data",
    "Atendente",
    "Perfil do Cliente",
    "Dificuldade",
    "Nota",
    "Resumo",
    "Pontos Fortes",
    "Pontos de Melhoria",
    "Erros"
  ];

  const rows = filtered.map((r) => [
    new Date(r.created_at).toLocaleString("pt-BR"),
    r.profiles?.display_name ?? r.profiles?.email ?? "—",
    r.profile_name ?? "—",
    DIFFICULTY_LABELS[r.difficulty] ?? r.difficulty,
    r.nota,
    r.resumo ?? "",
    Array.isArray(r.pontos_fortes) ? r.pontos_fortes.join(" | ") : "",
    Array.isArray(r.pontos_melhoria) ? r.pontos_melhoria.join(" | ") : "",
    Array.isArray(r.erros) ? r.erros.join(" | ") : "",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const periodo = dataInicio && dataFim
    ? `_${dataInicio}_ate_${dataFim}`
    : dataInicio ? `_a_partir_de_${dataInicio}`
    : dataFim ? `_ate_${dataFim}`
    : "";

  link.href = url;
  link.download = `relatorio_simulacoes${periodo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Histórico de Atendimentos Simulados</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} registro(s) encontrado(s)
            {results.length !== filtered.length ? ` de ${results.length} total` : ""}.
          </p>
        </div>
        <Button onClick={exportarExcel} disabled={filtered.length === 0} className="gap-2">
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar atendente ou perfil..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data início</Label>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data fim</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </div>

      <Card className="divide-y">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground p-8 text-sm">
            Nenhum atendimento encontrado com os filtros aplicados.
          </p>
        )}
        {filtered.map((r) => (
          <button key={r.id} onClick={() => setSelected(r)}
            className="w-full text-left p-4 hover:bg-muted/40 transition flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {r.profiles?.display_name ?? r.profiles?.email ?? "Atendente"}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-xs ${DIFFICULTY_COLORS[r.difficulty]}`}>
                  {DIFFICULTY_LABELS[r.difficulty] ?? r.difficulty}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")} · {r.profile_name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
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
                    <ul className="text-xs space-y-0.5">{selected.pontos_fortes.map((p: string, i: number) =>
                      <li key={i}>• {p}</li>)}</ul></div>
                )}
                {selected.pontos_melhoria?.length > 0 && (
                  <div><p className="text-xs font-semibold text-yellow-700 mb-1">⚠️ Pontos de melhoria</p>
                    <ul className="text-xs space-y-0.5">{selected.pontos_melhoria.map((p: string, i: number) =>
                      <li key={i}>• {p}</li>)}</ul></div>
                )}
                {selected.erros?.length > 0 && (
                  <div><p className="text-xs font-semibold text-red-700 mb-1">❌ Erros</p>
                    <ul className="text-xs space-y-0.5">{selected.erros.map((p: string, i: number) =>
                      <li key={i}>• {p}</li>)}</ul></div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
