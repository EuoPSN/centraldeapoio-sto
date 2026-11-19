import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listContatos } from "@/lib/contatos.functions";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { Phone, MapPin, Landmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contatos")({
  component: Page,
});

type Tipo = "cartao_de_todos" | "clinica_amor_saude" | "outros";
interface ContatoRow {
  id: string; tipo: Tipo; nome_regiao: string; endereco: string | null; numero: string | null; ponto_referencia: string | null;
  contato1: string | null; contato2: string | null; contato3: string | null; destaque: boolean; position: number;
}

const TIPOS: { value: Tipo; label: string; temDestaque: boolean }[] = [
  { value: "cartao_de_todos", label: "Cartão de Todos", temDestaque: true },
  { value: "clinica_amor_saude", label: "Clínica Amor Saúde", temDestaque: true },
  { value: "outros", label: "Outros Endereços", temDestaque: false },
];

function formatarParaCopiar(r: ContatoRow) {
  const linhas = [r.nome_regiao];
  const enderecoCompleto = [r.endereco, r.numero ? `nº ${r.numero}` : null].filter(Boolean).join(", ");
  if (enderecoCompleto) linhas.push(`Endereço: ${enderecoCompleto}`);
  if (r.ponto_referencia) linhas.push(`Ponto de referência: ${r.ponto_referencia}`);
  [r.contato1, r.contato2, r.contato3].filter(Boolean).forEach((c) => linhas.push(c as string));
  return linhas.join("\n");
}

function ContatoCard({ r }: { r: ContatoRow }) {
  return (
    <Card className="px-4 py-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="pt-1.5 text-[15px] font-semibold leading-snug">{r.nome_regiao}</h3>
        <CopyButton text={formatarParaCopiar(r)} />
      </div>
      <div className="space-y-1.5 text-sm">
        {(r.endereco || r.numero) && (
          <p className="flex items-start gap-2">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-gold-text" />
            <span><span className="font-medium">Endereço:</span> {[r.endereco, r.numero ? `nº ${r.numero}` : null].filter(Boolean).join(", ")}</span>
          </p>
        )}
        {r.ponto_referencia && (
          <p className="flex items-start gap-2">
            <Landmark className="h-4 w-4 shrink-0 mt-0.5 text-gold-text" />
            <span><span className="font-medium">Ponto de referência:</span> {r.ponto_referencia}</span>
          </p>
        )}
        {[r.contato1, r.contato2, r.contato3].filter(Boolean).map((c, i) => (
          <p key={i} className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-gold-text" /> {c}
          </p>
        ))}
      </div>
    </Card>
  );
}

function ListaComDestaque({ items }: { items: ContatoRow[] }) {
  const [modo, setModo] = useState<"principais" | "outras">("principais");
  const principais = items.filter((r) => r.destaque);
  const outras = items.filter((r) => !r.destaque);
  const visiveis = modo === "principais" ? principais : outras;

  return (
    <Tabs value={modo} onValueChange={(v) => setModo(v as "principais" | "outras")}>
      <TabsList className="mb-3 ml-1 border-l border-border pl-3">
        <TabsTrigger value="principais">Principais ({principais.length})</TabsTrigger>
        <TabsTrigger value="outras">Outras regiões ({outras.length})</TabsTrigger>
      </TabsList>
      <TabsContent value={modo}>
        {visiveis.length === 0 && <Card className="px-5 py-8 text-center"><p className="text-sm text-muted-foreground">Nada cadastrado aqui ainda.</p></Card>}
        <div className="grid gap-3 sm:grid-cols-2">
          {visiveis.map((r) => <ContatoCard key={r.id} r={r} />)}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function Page() {
  const fn = useServerFn(listContatos);
  const q = useQuery({ queryKey: ["contatos"], queryFn: () => fn({}) });
  const rows = (q.data ?? []) as ContatoRow[];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-5 lg:px-8 lg:py-7">
      <header className="mb-5">
        <h1 className="text-2xl font-medium">Contatos e Endereços</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Endereços e telefones daqui e de outras regiões.</p>
      </header>

      {q.isLoading && <div className="grid gap-4 sm:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>}

      {!q.isLoading && (
        <Tabs defaultValue="cartao_de_todos">
          <TabsList className="mb-3">
            {TIPOS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
          {TIPOS.map((t) => {
            const items = rows.filter((r) => r.tipo === t.value).sort((a, b) => a.position - b.position);
            return (
              <TabsContent key={t.value} value={t.value}>
                {t.temDestaque ? (
                  <ListaComDestaque items={items} />
                ) : (
                  <>
                    {items.length === 0 && <Card className="px-5 py-8 text-center"><p className="text-sm text-muted-foreground">Nenhum endereço cadastrado ainda.</p></Card>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {items.map((r) => <ContatoCard key={r.id} r={r} />)}
                    </div>
                  </>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
