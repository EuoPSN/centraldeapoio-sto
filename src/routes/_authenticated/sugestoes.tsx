import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listSuggestions, createSuggestion, deleteSuggestion } from "@/lib/suggestions.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Lightbulb, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sugestoes")({
  component: Page,
});

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  em_analise: { label: "Em análise", variant: "outline" },
  implementado: { label: "Implementado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
};

function Page() {
  const list = useServerFn(listSuggestions);
  const create = useServerFn(createSuggestion);
  const del = useServerFn(deleteSuggestion);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-suggestions"], queryFn: () => list({ data: { all: false } }) });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "sugestao" });

  const createMut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      toast.success("Sugestão enviada. Obrigado!");
      setOpen(false);
      setForm({ title: "", description: "", category: "sugestao" });
      qc.invalidateQueries({ queryKey: ["my-suggestions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removida."); qc.invalidateQueries({ queryKey: ["my-suggestions"] }); },
  });

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lightbulb className="h-7 w-7 text-primary" /> Central de Sugestões
          </h1>
          <p className="text-muted-foreground mt-1">Envie dúvidas, sugestões, novos scripts e melhorias.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nova sugestão</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Enviar sugestão</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sugestao">Sugestão</SelectItem>
                    <SelectItem value="duvida">Dúvida</SelectItem>
                    <SelectItem value="script">Novo script</SelectItem>
                    <SelectItem value="fluxo">Novo fluxo</SelectItem>
                    <SelectItem value="melhoria">Melhoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.title || !form.description}>
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {q.isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {!q.isLoading && (q.data?.length ?? 0) === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Você ainda não enviou nenhuma sugestão.</p>
        </Card>
      )}

      <div className="space-y-3">
        {(q.data ?? []).map((s) => {
          const st = STATUS_LABEL[s.status] ?? STATUS_LABEL.pendente;
          return (
            <Card key={s.id} className="p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <Badge variant="outline">{s.category}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <h3 className="font-semibold mt-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{s.description}</p>
                  {s.admin_response && (
                    <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
                      <p className="text-xs uppercase font-semibold text-primary mb-1">Resposta do admin</p>
                      <p className="text-sm whitespace-pre-wrap">{s.admin_response}</p>
                    </div>
                  )}
                </div>
                <Button size="icon" variant="ghost" onClick={() => confirm("Remover esta sugestão?") && delMut.mutate(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
