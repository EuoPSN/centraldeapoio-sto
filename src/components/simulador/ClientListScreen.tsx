import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { DIFFICULTY_DOT_CLASSES, DIFFICULTY_LABELS, DIFFICULTY_TEXT_CLASSES } from "@/components/simulador/difficulty";

export interface SimuladorListItem {
  id: string;
  name: string;
  difficulty: string;
  category_id?: string | null;
  category?: { id?: string; name?: string | null } | null;
}

export interface ProfileStats { melhor: number; total: number }

interface Props<T extends SimuladorListItem> {
  titulo: string;
  subtitulo: string;
  items: T[];
  categorias: { id: string; name: string }[];
  stats: Record<string, ProfileStats>;
  onSelect: (item: T) => void;
  /** Seção 5 (Solução de problemas) não tem "Treine este hoje". */
  mostrarTreineHoje?: boolean;
  labelTrocarCliente?: string;
}

// Prioriza um perfil nunca treinado de dificuldade Fácil/Médio; se não houver,
// o perfil já treinado com a menor melhor-nota; por último, qualquer perfil
// nunca treinado. Retorna null se não houver nenhum perfil.
function pickTreineEsteHoje<T extends SimuladorListItem>(items: T[], stats: Record<string, ProfileStats>) {
  if (items.length === 0) return null;
  const nuncaTreinado = items.filter((i) => !stats[i.id]);
  const nuncaFacilMedio = nuncaTreinado.filter((i) => i.difficulty === "facil" || i.difficulty === "medio");
  if (nuncaFacilMedio.length > 0) return { item: nuncaFacilMedio[0], nunca: true as const };
  const treinados = items.filter((i) => stats[i.id]);
  if (treinados.length > 0) {
    const pior = treinados.slice().sort((a, b) => stats[a.id].melhor - stats[b.id].melhor)[0];
    return { item: pior, nunca: false as const };
  }
  if (nuncaTreinado.length > 0) return { item: nuncaTreinado[0], nunca: true as const };
  return null;
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

export function SimuladorListScreen<T extends SimuladorListItem>({
  titulo, subtitulo, items, categorias, stats, onSelect, mostrarTreineHoje = true,
}: Props<T>) {
  const [categoria, setCategoria] = useState<string>("todas");
  const [dificuldade, setDificuldade] = useState<string>("todas");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    return items.filter((i) => {
      if (categoria !== "todas" && i.category_id !== categoria) return false;
      if (dificuldade !== "todas" && i.difficulty !== dificuldade) return false;
      if (busca.trim() && !i.name.toLowerCase().includes(busca.trim().toLowerCase())) return false;
      return true;
    });
  }, [items, categoria, dificuldade, busca]);

  const treineHoje = mostrarTreineHoje ? pickTreineEsteHoje(items, stats) : null;

  const clienteSurpresa = () => {
    const pool = filtrados.length > 0 ? filtrados : items;
    if (pool.length === 0) return;
    const sorteado = pool[Math.floor(Math.random() * pool.length)];
    onSelect(sorteado);
  };

  return (
    <div className="space-y-4">
      {treineHoje && (
        <Card className="p-4 border-primary flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
              {iniciais(treineHoje.item.name)}
            </div>
            <div className="min-w-0">
              <p className="type-overline text-muted-foreground">Treine este hoje</p>
              <p className="font-semibold truncate">{treineHoje.item.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {treineHoje.nunca
                  ? "Você ainda não treinou com este perfil."
                  : `Sua menor nota até agora: ${stats[treineHoje.item.id]?.melhor ?? 0}. ${DIFFICULTY_LABELS[treineHoje.item.difficulty] ?? treineHoje.item.difficulty}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={clienteSurpresa}>Cliente surpresa</Button>
            <Button onClick={() => onSelect(treineHoje.item)}>Começar</Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Categoria: Todas</SelectItem>
            {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dificuldade} onValueChange={setDificuldade}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Dificuldade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Dificuldade: Todas</SelectItem>
            {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {!mostrarTreineHoje && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={clienteSurpresa}>
            Cliente surpresa
          </Button>
        )}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder={titulo === "Simulador IA" ? "Buscar perfil..." : "Buscar cenário..."}
            value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_120px_140px_80px] gap-2 px-4 py-2 type-overline text-muted-foreground border-b">
          <span>Perfil</span>
          <span>Categoria</span>
          <span>Dificuldade</span>
          <span>Sua melhor nota</span>
          <span />
        </div>
        {items.length === 0 && (
          <p className="text-center text-muted-foreground p-8 text-sm">{subtitulo}</p>
        )}
        {items.length > 0 && filtrados.length === 0 && (
          <p className="text-center text-muted-foreground p-8 text-sm">Nenhum resultado para os filtros aplicados.</p>
        )}
        {filtrados.map((item) => {
          const s = stats[item.id];
          return (
            <button key={item.id} onClick={() => onSelect(item)}
              className="w-full grid grid-cols-[1fr_140px_120px_140px_80px] gap-2 items-center px-4 h-[50px] text-left text-sm hover:bg-muted/50 transition border-b last:border-0">
              <span className="font-semibold truncate">{item.name}</span>
              <span className="text-muted-foreground truncate">{item.category?.name ?? "—"}</span>
              <span className={`flex items-center gap-1.5 ${DIFFICULTY_TEXT_CLASSES[item.difficulty] ?? ""}`}>
                <span className={`h-2 w-2 rounded-full ${DIFFICULTY_DOT_CLASSES[item.difficulty] ?? "bg-muted-foreground"}`} />
                {DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty}
              </span>
              <span>
                {s ? <span className="font-medium">{s.melhor} · {s.total}×</span> : <span className="text-muted-foreground">Nunca treinou</span>}
              </span>
              <span className="text-gold-text font-medium">Treinar →</span>
            </button>
          );
        })}
      </Card>
    </div>
  );
}
