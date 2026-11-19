import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listMarcianaSugestoes,
  upsertMarcianaSugestao,
  deleteMarcianaSugestao,
} from "@/lib/marciana-sugestoes.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";

type Sugestao = { id: string; texto: string; ordem: number; ativo: boolean };

// Mostrada dentro do Admin > IA/MarcIAna. Lista as pílulas de sugestão da
// tela inicial do /assistente (4 a 6 ativas aparecem lá).
export function MarcianaSugestoesSection() {
  const list = useServerFn(listMarcianaSugestoes);
  const upsert = useServerFn(upsertMarcianaSugestao);
  const del = useServerFn(deleteMarcianaSugestao);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["marciana-sugestoes"], queryFn: () => list({}) });
  const [novo, setNovo] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["marciana-sugestoes"] });

  const saveMut = useMutation({
    mutationFn: (v: { id?: string; texto: string; ordem: number; ativo: boolean }) =>
      upsert({ data: v }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: invalidate,
  });

  const sugestoes = (q.data ?? []) as unknown as Sugestao[];
  const ativasCount = sugestoes.filter((s) => s.ativo).length;

  const addNovo = () => {
    const texto = novo.trim();
    if (!texto) return;
    saveMut.mutate({ texto, ordem: sugestoes.length, ativo: true });
    setNovo("");
  };

  return (
    <Card className="p-5 space-y-3">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <MessageCircleQuestion className="h-4 w-4 text-gold-text" /> Sugestões da tela inicial
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Pílulas de pergunta exibidas na tela inicial da MarcIAna (clicar envia a pergunta). Mostre
          de 4 a 6 ativas
          {ativasCount > 0 ? ` — hoje: ${ativasCount}.` : "."}
        </p>
      </div>

      <div className="space-y-2">
        {sugestoes.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <Input
              defaultValue={s.texto}
              onBlur={(e) => {
                const texto = e.target.value.trim();
                if (texto && texto !== s.texto)
                  saveMut.mutate({ id: s.id, texto, ordem: s.ordem, ativo: s.ativo });
              }}
              className="flex-1"
            />
            <Switch
              checked={s.ativo}
              onCheckedChange={(v) =>
                saveMut.mutate({ id: s.id, texto: s.texto, ordem: s.ordem, ativo: v })
              }
              aria-label="Ativa"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => confirm("Excluir esta sugestão?") && delMut.mutate(s.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {sugestoes.length === 0 && !q.isLoading && (
          <p className="text-sm text-muted-foreground">Nenhuma sugestão cadastrada ainda.</p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Input
          placeholder="Nova sugestão de pergunta..."
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addNovo();
          }}
          className="flex-1"
        />
        <Button
          size="sm"
          className="gap-2"
          onClick={addNovo}
          disabled={!novo.trim() || saveMut.isPending}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
    </Card>
  );
}
