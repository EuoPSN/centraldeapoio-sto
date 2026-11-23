import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TableHead } from "@/components/ui/table";

// Seleção em lote das listas do Admin do Amor Saúde (Consultas, Exames, Odontologia,
// Teleconsulta e PA). A seleção vale para os itens do filtro atual.

export function useLote<T extends { id: string }>(visiveis: T[]) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  // Itens que saíram da lista (filtro ou exclusão) deixam de contar como selecionados.
  useEffect(() => {
    setSel((prev) => {
      const ok = new Set(visiveis.map((v) => v.id));
      const next = new Set([...prev].filter((id) => ok.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visiveis]);
  const todos = visiveis.length > 0 && visiveis.every((v) => sel.has(v.id));
  const algum = sel.size > 0;
  return {
    sel,
    todos,
    algum,
    total: visiveis.length,
    marcado: (id: string) => sel.has(id),
    alternar: (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    alternarTodos: () => setSel(todos ? new Set() : new Set(visiveis.map((v) => v.id))),
    selecionarTodos: () => setSel(new Set(visiveis.map((v) => v.id))),
    limpar: () => setSel(new Set()),
    escolhidos: visiveis.filter((v) => sel.has(v.id)),
  };
}
export type Lote<T extends { id: string }> = ReturnType<typeof useLote<T>>;

/** Cabeçalho da coluna da caixa de seleção ("selecionar todos"). */
export function CabecalhoSelecao({ todos, algum, onToggle }: { todos: boolean; algum: boolean; onToggle: () => void }) {
  return (
    <TableHead className="w-10">
      <Checkbox
        aria-label="Selecionar todos os itens da lista"
        checked={todos ? true : algum ? "indeterminate" : false}
        onCheckedChange={onToggle}
      />
    </TableHead>
  );
}

export function BuscaLista({ valor, onChange, placeholder = "Buscar…" }: { valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative block w-full max-w-[240px]">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <span className="sr-only">Buscar</span>
      <Input value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 pl-8" />
    </label>
  );
}

/** Barra preta: "N selecionadas · Selecionar todas as N · Limpar seleção · Excluir selecionadas". */
export function BarraLote({
  quantidade, total, todos, onSelecionarTodos, onLimpar, onExcluir, ocupado,
}: {
  quantidade: number; total: number; todos: boolean;
  onSelecionarTodos: () => void; onLimpar: () => void; onExcluir: () => void; ocupado?: boolean;
}) {
  if (quantidade === 0) return null;
  return (
    <div role="region" aria-label="Seleção em lote" className="mx-4 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-[#0B0B0B] px-4 py-2.5 text-sm text-[#F5F5F0]">
      <span className="font-semibold text-[#D4AF37]" aria-live="polite">{quantidade} {quantidade === 1 ? "selecionada" : "selecionadas"}</span>
      {!todos && total > quantidade && (
        <button type="button" onClick={onSelecionarTodos} className="text-[#B8B2A6] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          Selecionar todas as {total}
        </button>
      )}
      <button type="button" onClick={onLimpar} className="text-[#B8B2A6] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        Limpar seleção
      </button>
      <Button type="button" size="sm" variant="destructive" className="ml-auto" disabled={ocupado} onClick={onExcluir}>
        Excluir selecionadas
      </Button>
    </div>
  );
}

/** Lista até 5 nomes, "Cardiologia, Clínico geral e Ginecologia". */
export function nomesParaConfirmar(nomes: string[]): string {
  const vis = nomes.slice(0, 5);
  const resto = nomes.length - vis.length;
  if (resto > 0) return `${vis.join(", ")} e mais ${resto}`;
  if (vis.length <= 1) return vis.join("");
  return `${vis.slice(0, -1).join(", ")} e ${vis[vis.length - 1]}`;
}

export function ConfirmarLote({
  aberto, onFechar, onConfirmar, nomes, singular, plural, ocupado, erro,
}: {
  aberto: boolean; onFechar: () => void; onConfirmar: () => void; nomes: string[];
  singular: string; plural: string; ocupado: boolean; erro: string | null;
}) {
  const n = nomes.length;
  const noun = n === 1 ? singular : plural;
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => { if (!v && !ocupado) onFechar(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {n} {noun}?</AlertDialogTitle>
          <AlertDialogDescription>
            {nomesParaConfirmar(nomes)} {n === 1 ? "será removido(a)" : "serão removidos(as)"} do Amor Saúde e {n === 1 ? "deixa" : "deixam"} de aparecer para a equipe. Não dá para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={ocupado} onClick={onConfirmar}>{ocupado ? "Excluindo…" : `Excluir ${n}`}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Estado do diálogo + chamada ao servidor; limpa a seleção e recarrega a lista no sucesso. */
export function useExcluirLote<T extends { id: string }>(
  lote: Lote<T>, nomeDe: (i: T) => string, apagar: (ids: string[]) => Promise<unknown>, aoTerminar: () => void,
) {
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nomes = useMemo(() => lote.escolhidos.map(nomeDe), [lote.escolhidos, nomeDe]);
  return {
    aberto, ocupado, erro, nomes,
    abrir: () => { setErro(null); setAberto(true); },
    fechar: () => setAberto(false),
    confirmar: async () => {
      setOcupado(true);
      setErro(null);
      try {
        await apagar(lote.escolhidos.map((i) => i.id));
        lote.limpar();
        setAberto(false);
        aoTerminar();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível excluir. Nada foi apagado.");
      } finally {
        setOcupado(false);
      }
    },
  };
}
