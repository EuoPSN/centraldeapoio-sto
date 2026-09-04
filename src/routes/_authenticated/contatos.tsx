import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listContatos } from "@/lib/contatos.functions";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { Phone, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contatos")({
  component: Page,
});

type Tipo = "cartao_de_todos" | "clinica_amor_saude" | "outros";
interface ContatoRow {
  id: string; tipo: Tipo; nome_regiao: string; endereco: string | null;
  contato1: string | null; contato2: string | null; contato3: string | null; position: number;
}

const TIPOS: { value: Tipo; label: string }[] = [
  { value: "cartao_de_todos", label: "Cartão de Todos" },
  { value: "clinica_amor_saude", label: "Clínica Amor Saúde" },
  { value: "outros", label: "Outros Endereços" },
];

function formatarParaCopiar(r: ContatoRow) {
  const linhas = [r.nome_regiao];
  if (r.endereco) linhas.push(r.endereco);
  [r.contato1, r.contato2, r.contato3].filter(Boolean).forEach((c) => linhas.push(c as string));
  return linhas.join("\n");
}

function Page() {
  const fn = useServerFn(listContatos);
  const q = useQuery({ queryKey: ["contatos"], queryFn: () => fn({}) });
  const rows = (q.data ?? []) as ContatoRow[];

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Phone className="h-7 w-7 text-primary" /> Contatos e Endereços
        </h1>
        <p className="text-muted-foreground mt-1">Endereços e telefones daqui e de outras regiões.</p>
      </header>

      {q.isLoading && <div className="grid gap-4 sm:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>}

      {!q.isLoading && (
        <Tabs defaultValue="cartao_de_todos">
          <TabsList className="mb-6">
            {TIPOS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
          {TIPOS.map((t) => {
            const items = rows.filter((r) => r.tipo === t.value).sort((a, b) => a.position - b.position);
            return (
              <TabsContent key={t.value} value={t.value}>
                {items.length === 0 && <Card className="p-10 text-center"><p className="text-muted-foreground">Nenhum endereço cadastrado ainda.</p></Card>}
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((r) => (
                    <Card key={r.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold">{r.nome_regiao}</h3>
                        <CopyButton text={formatarParaCopiar(r)} />
                      </div>
                      {r.endereco && (
                        <p className="text-sm text-muted-foreground flex items-start gap-1.5 mb-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {r.endereco}
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {[r.contato1, r.contato2, r.contato3].filter(Boolean).map((c, i) => (
                          <p key={i} className="text-sm flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-primary" /> {c}
                          </p>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
