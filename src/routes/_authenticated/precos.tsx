import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPricing } from "@/lib/content.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/precos")({
  component: Page,
});

function Page() {
  const fn = useServerFn(listPricing);
  const q = useQuery({ queryKey: ["pricing"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim();
    if (!needle) return q.data ?? [];
    return (q.data ?? []).filter((p) =>
      p.specialty.toLowerCase().includes(needle) || (p.notes ?? "").toLowerCase().includes(needle)
    );
  }, [q.data, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const p of filtered) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const fmt = (n: number | string | null) =>
    n == null ? "—" : `R$ ${Number(n).toFixed(2).replace(".", ",")}`;

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-7 w-7 text-primary" /> Tabela de Preços
        </h1>
        <p className="text-muted-foreground mt-1">
          Especialidades, consultas e procedimentos — Cartão de Todos vs. Particular.
        </p>
      </header>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar especialidade..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {q.isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {!q.isLoading && (q.data?.length ?? 0) === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Tabela de preços ainda não cadastrada.</p>
        </Card>
      )}

      <div className="space-y-6">
        {grouped.map(([cat, rows]) => (
          <section key={cat}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary mb-2">{cat}</h2>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Especialidade</TableHead>
                    <TableHead className="text-right">Cartão de Todos</TableHead>
                    <TableHead className="text-right">Particular</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.specialty}</TableCell>
                      <TableCell className="text-right text-primary font-semibold">{fmt(r.cartao_price)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(r.particular_price)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
