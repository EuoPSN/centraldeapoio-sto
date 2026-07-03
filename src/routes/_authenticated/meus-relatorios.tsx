import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyReport,
  upsertMyReport,
  getAllReports,
  getAllUsers,
} from "@/lib/relatorio-prospeccao.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Save, BarChart2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/meus-relatorios")({
  component: Page,
});

const AREAS = ["Geral", "Clts", "Estágios Manhã", "Estágios Tarde"];
const CAMPOS = [
  { key: "ligacoes", label: "Ligações" },
  { key: "mensagens", label: "Mensagens" },
  { key: "ztalk", label: "Ztalk" },
  { key: "tentativas", label: "Tentativas" },
  { key: "oportunidades", label: "Oportunidades" },
  { key: "vendas", label: "Vendas" },
];

const EMPTY_AREA = {
  ligacoes: 0,
  mensagens: 0,
  ztalk: 0,
  tentativas: 0,
  oportunidades: 0,
  vendas: 0,
};

function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function isHoje(data: string) {
  return data === hoje();
}

function Page() {
  const getMyFn = useServerFn(getMyReport);
  const upsertFn = useServerFn(upsertMyReport);
  const getAllFn = useServerFn(getAllReports);
  const getUsersFn = useServerFn(getAllUsers);
  const qc = useQueryClient();

  const [tab, setTab] = useState<"meu" | "admin">("meu");
  const [data, setData] = useState(hoje());
  const [form, setForm] = useState<Record<string, typeof EMPTY_AREA>>(
    Object.fromEntries(AREAS.map((a) => [a, { ...EMPTY_AREA }]))
  );

  // Admin filters
  const [adminInicio, setAdminInicio] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
  );
  const [adminFim, setAdminFim] = useState(hoje());
  const [adminUser, setAdminUser] = useState("");

  const myQ = useQuery({
    queryKey: ["meu-relatorio", data],
    queryFn: async () => {
      const rows = await getMyFn({ data: { data } });
      const newForm = Object.fromEntries(
        AREAS.map((a) => [a, { ...EMPTY_AREA }])
      );
      for (const r of rows as any[]) {
        newForm[r.area] = {
          ligacoes: r.ligacoes,
          mensagens: r.mensagens,
          ztalk: r.ztalk,
          tentativas: r.tentativas,
          oportunidades: r.oportunidades,
          vendas: r.vendas,
        };
      }
      setForm(newForm);
      return rows;
    },
  });

  const usersQ = useQuery({
    queryKey: ["all-users"],
    queryFn: () => getUsersFn(),
    enabled: tab === "admin",
  });

  const allQ = useQuery({
    queryKey: ["all-reports", adminInicio, adminFim, adminUser],
    queryFn: () =>
      getAllFn({
        data: {
          dataInicio: adminInicio,
          dataFim: adminFim,
          userId: adminUser || undefined,
        },
      }),
    enabled: tab === "admin",
  });

  const bloqueado = !isHoje(data);

  const saveMut = useMutation({
    mutationFn: async (area: string) => {
      return upsertFn({ data: { data, area, ...form[area] } });
    },
    onSuccess: () => {
      toast.success("Salvo!");
      qc.invalidateQueries({ queryKey: ["meu-relatorio", data] });
    },
    onError: () =>
      toast.error(
        "Erro ao salvar. Só é possível editar o dia atual."
      ),
  });

  const setField = (area: string, field: string, value: number) => {
    setForm((f) => ({ ...f, [area]: { ...f[area], [field]: value } }));
  };

  const totalGeral = useMemo(() => {
    return CAMPOS.reduce((acc, c) => {
      acc[c.key] = AREAS.reduce(
        (s, a) => s + (form[a]?.[c.key as keyof typeof EMPTY_AREA] ?? 0),
        0
      );
      return acc;
    }, {} as Record<string, number>);
  }, [form]);

  const exportarCSV = () => {
    const rows = (allQ.data as any[]) ?? [];
    const users = (usersQ.data as any[]) ?? [];

    const porUser: Record<string, Record<string, number> & { nome: string }> = {};
    for (const r of rows) {
      const uid = r.user_id;
      const prof = users.find((u: any) => u.id === uid);
      const nome = r.profiles?.display_name ?? prof?.email ?? uid;
      if (!porUser[uid])
        porUser[uid] = {
          nome,
          ligacoes: 0,
          mensagens: 0,
          ztalk: 0,
          tentativas: 0,
          oportunidades: 0,
          vendas: 0,
        };
      porUser[uid].ligacoes += r.ligacoes;
      porUser[uid].mensagens += r.mensagens;
      porUser[uid].ztalk += r.ztalk;
      porUser[uid].tentativas += r.tentativas;
      porUser[uid].oportunidades += r.oportunidades;
      porUser[uid].vendas += r.vendas;
    }

    const headers = [
      "Funcionário",
      "Ligações",
      "Mensagens",
      "Ztalk",
      "Total Contatos",
      "Tentativas",
      "Oportunidades",
      "Vendas",
    ];
    const dataRows = Object.values(porUser).map((u) => [
      u.nome,
      u.ligacoes,
      u.mensagens,
      u.ztalk,
      u.ligacoes + u.mensagens + u.ztalk,
      u.tentativas,
      u.oportunidades,
      u.vendas,
    ]);

    const csv = [headers, ...dataRows]
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, "\"\"")}"`).join(";")
      )
      .join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_prospeccao_${adminInicio}_${adminFim}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" /> Meus Relatórios
          </h1>
          <p className="text-muted-foreground text-sm">
            Preencha seu resultado diário por área.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("meu")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === "meu"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            Meu Relatório
          </button>
          <button
            onClick={() => setTab("admin")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === "admin"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            Visão Geral
          </button>
        </div>
      </div>

      {tab === "meu" && (
        <div className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input
                type="date"
                value={data}
                max={hoje()}
                onChange={(e) => setData(e.target.value)}
                className="w-44"
              />
            </div>
            {bloqueado && (
              <Badge
                variant="outline"
                className="text-yellow-600 border-yellow-400"
              >
                Visualização — edição bloqueada para datas anteriores
              </Badge>
            )}
          </div>

          {AREAS.map((area) => (
            <Card key={area} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{area}</h3>
                {!bloqueado && (
                  <Button
                    size="sm"
                    onClick={() => saveMut.mutate(area)}
                    disabled={saveMut.isPending}
                    className="gap-2 h-7 text-xs"
                  >
                    <Save className="h-3 w-3" /> Salvar
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {CAMPOS.map((c) => (
                  <div key={c.key}>
                    <Label className="text-xs">{c.label}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form[area]?.[c.key as keyof typeof EMPTY_AREA] ?? 0}
                      onChange={(e) =>
                        setField(area, c.key, Number(e.target.value))
                      }
                      disabled={bloqueado}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <Card className="p-4 bg-primary/5 border-primary/20">
            <h3 className="font-semibold text-sm mb-3">Total do dia</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {CAMPOS.map((c) => (
                <div key={c.key} className="text-center">
                  <p className="text-xl font-bold text-primary">
                    {totalGeral[c.key] ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.label}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "admin" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={adminInicio}
                  onChange={(e) => setAdminInicio(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={adminFim}
                  onChange={(e) => setAdminFim(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Funcionário
                </Label>
                <Select value={adminUser} onValueChange={setAdminUser}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {(usersQ.data as any[] ?? []).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name ?? u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={exportarCSV}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </div>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left p-3">Funcionário</th>
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Área</th>
                    <th className="text-center p-3">Ligações</th>
                    <th className="text-center p-3">Mensagens</th>
                    <th className="text-center p-3">Ztalk</th>
                    <th className="text-center p-3">Tentativas</th>
                    <th className="text-center p-3">Oport.</th>
                    <th className="text-center p-3">Vendas</th>
                  </tr>
                </thead>
                <tbody>
                  {(allQ.data as any[] ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center text-muted-foreground p-8"
                      >
                        Nenhum dado no período.
                      </td>
                    </tr>
                  )}
                  {(allQ.data as any[] ?? []).map((r: any) => (
                    <tr key={r.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">
                        {r.profiles?.display_name ??
                          r.profiles?.email ??
                          "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(r.data + "T12:00:00").toLocaleDateString(
                          "pt-BR"
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{r.area}</Badge>
                      </td>
                      <td className="p-3 text-center">{r.ligacoes}</td>
                      <td className="p-3 text-center">{r.mensagens}</td>
                      <td className="p-3 text-center">{r.ztalk}</td>
                      <td className="p-3 text-center">{r.tentativas}</td>
                      <td className="p-3 text-center">{r.oportunidades}</td>
                      <td className="p-3 text-center font-semibold text-emerald-600">
                        {r.vendas}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
