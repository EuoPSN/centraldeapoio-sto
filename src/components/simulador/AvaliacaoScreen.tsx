import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, X as XIcon, RotateCcw } from "lucide-react";

export interface Avaliacao {
  nota: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_melhoria: string[];
  erros: string[];
  trechos?: { pontos_fortes?: (string | null)[]; pontos_melhoria?: (string | null)[]; erros?: (string | null)[] } | null;
  mensagem_fraca?: string | null;
  reescrita?: string | null;
}

function PontoItem({ texto, trecho, icon }: { texto: string; trecho?: string | null; icon: ReactNode }) {
  return (
    <div className="flex gap-2 py-2.5 border-b last:border-0">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm">{texto}</p>
        {trecho && (
          <p className="text-xs text-muted-foreground border-l-2 border-border pl-2 italic">"{trecho}"</p>
        )}
      </div>
    </div>
  );
}

export function AvaliacaoScreen({
  avaliacao, xpGanho, melhorNota, nomePerfil, genero, resumoPersonalidade,
  onTreinarDeNovo, onOutroCliente,
}: {
  avaliacao: Avaliacao;
  xpGanho: number | null;
  melhorNota: number | null;
  nomePerfil: string;
  genero?: string | null;
  resumoPersonalidade?: string;
  onTreinarDeNovo?: () => void;
  onOutroCliente?: () => void;
}) {
  const nota = avaliacao.nota ?? 0;
  const eraLabel = genero === "feminino" ? "ELA ERA" : "ELE ERA";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
      <Card className="p-5 space-y-4">
        <div>
          <p className="type-overline text-muted-foreground">Sua nota</p>
          <p className="font-display text-5xl text-gold-text leading-none mt-1">
            {nota}<span className="text-xl text-muted-foreground font-sans">/100</span>
          </p>
          <div className="h-1 rounded-full bg-muted mt-3 overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(0, Math.min(100, nota))}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {xpGanho !== null ? `+${xpGanho} XP` : ""}
            {melhorNota !== null ? ` · melhor nota com este perfil: ${melhorNota}` : ""}
          </p>
        </div>

        <div className="bg-surface-2 rounded-md p-3 space-y-1">
          <p className="type-overline text-muted-foreground">{eraLabel}</p>
          <p className="text-sm"><span className="font-semibold">{nomePerfil}.</span> {resumoPersonalidade}</p>
        </div>

        {(onTreinarDeNovo || onOutroCliente) && (
          <div className="space-y-2">
            {onTreinarDeNovo && <Button onClick={onTreinarDeNovo} className="w-full">Treinar de novo com este cliente</Button>}
            {onOutroCliente && (
              <Button variant="outline" onClick={onOutroCliente} className="w-full gap-2">
                <RotateCcw className="h-3.5 w-3.5" /> Outro cliente
              </Button>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-5">
        {avaliacao.pontos_fortes?.length > 0 && (
          <div>
            <p className="type-overline text-muted-foreground mb-1">Pontos fortes</p>
            <Card className="p-4 divide-y">
              {avaliacao.pontos_fortes.map((p, i) => (
                <PontoItem key={i} texto={p} trecho={avaliacao.trechos?.pontos_fortes?.[i]} icon={<Check className="h-4 w-4 text-gold-text" />} />
              ))}
            </Card>
          </div>
        )}
        {avaliacao.pontos_melhoria?.length > 0 && (
          <div>
            <p className="type-overline text-muted-foreground mb-1">O que melhorar</p>
            <Card className="p-4 divide-y">
              {avaliacao.pontos_melhoria.map((p, i) => (
                <PontoItem key={i} texto={p} trecho={avaliacao.trechos?.pontos_melhoria?.[i]} icon={<ArrowRight className="h-4 w-4 text-muted-foreground" />} />
              ))}
            </Card>
          </div>
        )}
        {avaliacao.erros?.length > 0 && (
          <div>
            <p className="type-overline text-muted-foreground mb-1">Erros</p>
            <Card className="p-4 divide-y">
              {avaliacao.erros.map((p, i) => (
                <PontoItem key={i} texto={p} trecho={avaliacao.trechos?.erros?.[i]} icon={<XIcon className="h-4 w-4 text-destructive" />} />
              ))}
            </Card>
          </div>
        )}
        {avaliacao.mensagem_fraca && avaliacao.reescrita && (
          <div>
            <p className="type-overline text-muted-foreground mb-1">Como eu mandaria</p>
            <Card className="p-4 border-l-2 border-l-primary space-y-2">
              <p className="text-sm text-muted-foreground line-through">{avaliacao.mensagem_fraca}</p>
              <p className="text-sm">{avaliacao.reescrita}</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
