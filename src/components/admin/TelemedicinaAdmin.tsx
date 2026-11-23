import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AdminListDetail } from "@/components/admin/AdminListDetail";
import { BarraLote, ConfirmarLote, useExcluirLote, useLote } from "@/components/admin/LoteAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAmorSaude, deleteManyTelemedicina } from "@/lib/amorsaude.functions";
import {
  addManyTelemedicina, deleteTelemedicina, listTelemedicina, setAmorSaudeSiteUrl, upsertTelemedicina,
} from "@/lib/telemedicina.functions";
import { linhasDoColar } from "@/lib/telemedicina";
import { matches, reais } from "@/components/amor-saude/model";
import { cn } from "@/lib/utils";

type Tipo = "teleconsulta" | "pa_digital";
interface Item {
  id: string; tipo: Tipo; nome: string; descricao: string | null; para_quem: string | null;
  cartao: number | null; particular: number | null; passos: string[]; indique_quando: string | null;
  link_agendamento: string | null; tempo_espera_min: number | null; ativo: boolean; position: number; use_count: number;
}
interface Edit {
  id?: string; tipo: Tipo; nome: string; descricao: string; para_quem: string; cartao: string; particular: string;
  passos: string; indique_quando: string; link_agendamento: string; tempo_espera_min: string; ativo: boolean; position: number;
}

const NOVO = (tipo: Tipo): Edit => ({
  tipo, nome: "", descricao: "", para_quem: "", cartao: "", particular: "", passos: "", indique_quando: "",
  link_agendamento: "", tempo_espera_min: tipo === "pa_digital" ? "15" : "", ativo: true, position: 0,
});
const doItem = (i: Item): Edit => ({
  id: i.id, tipo: i.tipo, nome: i.nome, descricao: i.descricao ?? "", para_quem: i.para_quem ?? "",
  cartao: i.cartao != null ? String(i.cartao).replace(".", ",") : "", particular: i.particular != null ? String(i.particular).replace(".", ",") : "",
  passos: (i.passos ?? []).join("\n"), indique_quando: i.indique_quando ?? "", link_agendamento: i.link_agendamento ?? "",
  tempo_espera_min: i.tempo_espera_min != null ? String(i.tempo_espera_min) : "", ativo: i.ativo, position: i.position,
});
const numero = (t: string): number | null => {
  const v = t.trim().replace(/\./g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) throw new Error(`Valor inválido: "${t}".`);
  return n;
};

export function TelemedicinaSubTab() {
  const list = useServerFn(listTelemedicina);
  const upsert = useServerFn(upsertTelemedicina);
  const del = useServerFn(deleteTelemedicina);
  const addMany = useServerFn(addManyTelemedicina);
  const delMany = useServerFn(deleteManyTelemedicina);
  const amorFn = useServerFn(getAmorSaude);
  const saveSite = useServerFn(setAmorSaudeSiteUrl);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["telemedicina-admin"], queryFn: () => list({}) });
  const siteQ = useQuery({ queryKey: ["amor-saude"], queryFn: () => amorFn({}), staleTime: 60_000 });

  const itens = (q.data ?? []) as unknown as Item[];
  const [filtro, setFiltro] = useState<"todos" | Tipo>("todos");
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [varias, setVarias] = useState<null | { tipo: Tipo; texto: string }>(null);
  const [site, setSite] = useState("");
  useEffect(() => { setSite((siteQ.data as { siteUrl?: string | null } | undefined)?.siteUrl ?? ""); }, [siteQ.data]);

  const visiveis = useMemo(
    () => itens.filter((i) => (filtro === "todos" || i.tipo === filtro) && matches(busca, i.nome, i.descricao)),
    [itens, filtro, busca],
  );
  const lote = useLote(visiveis);
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["telemedicina-admin"] });
    qc.invalidateQueries({ queryKey: ["amor-saude"] });
  };
  const excluirLote = useExcluirLote(lote, (i: Item) => i.nome, (ids) => delMany({ data: { ids } }), () => {
    toast.success("Excluídos.");
    if (edit?.id && lote.marcado(edit.id)) setEdit(null);
    recarregar();
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const e = edit!;
      const passos = e.passos.split("\n").map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
      return upsert({ data: {
        id: e.id, tipo: e.tipo, nome: e.nome, descricao: e.descricao, para_quem: e.para_quem,
        cartao: numero(e.cartao), particular: numero(e.particular), passos, indique_quando: e.indique_quando,
        link_agendamento: e.link_agendamento, ativo: e.ativo, position: e.position,
        tempo_espera_min: e.tipo === "pa_digital" && e.tempo_espera_min.trim() ? Number(e.tempo_espera_min) : null,
      } });
    },
    onSuccess: (r) => { toast.success("Salvo."); recarregar(); setEdit(doItem(r as unknown as Item)); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); setEdit(null); recarregar(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });
  const adicionar = useMutation({
    mutationFn: () => addMany({ data: varias! }),
    onSuccess: (r) => {
      toast.success(`${r.criadas} cadastrada(s)${r.puladas ? ` · ${r.puladas} já existia(m)` : ""}.`);
      setVarias(null);
      recarregar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar."),
  });
  const salvarSite = useMutation({
    mutationFn: () => saveSite({ data: { url: site } }),
    onSuccess: () => { toast.success("Link do site salvo."); recarregar(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Link inválido."),
  });

  const nTele = itens.filter((i) => i.tipo === "teleconsulta").length;
  const nPA = itens.filter((i) => i.tipo === "pa_digital").length;
  const previa = varias ? linhasDoColar(varias.texto) : [];

  return (
    <AdminListDetail
      title="Amor Saúde · Teleconsulta e PA digital"
      subtitle={`${nTele} teleconsultas · ${nPA} PA digital. Valor vazio aparece como "Consulte o valor" para o atendente.`}
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => setVarias({ tipo: "teleconsulta", texto: "" })}>Adicionar várias</Button>
          <Button size="sm" className="gap-1" onClick={() => setEdit(NOVO(filtro === "pa_digital" ? "pa_digital" : "teleconsulta"))}><Plus className="h-4 w-4" /> Nova especialidade</Button>
        </>
      }
      filters={(["todos", "teleconsulta", "pa_digital"] as const).map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={filtro === f}
          onClick={() => setFiltro(f)}
          className={cn("h-8 rounded-full border px-3 text-[13px] font-medium", filtro === f ? "border-ink bg-ink text-surface" : "border-line-strong text-ink hover:bg-surface-2")}
        >
          {f === "todos" ? "Todos" : f === "teleconsulta" ? "Teleconsulta" : "PA digital"}
        </button>
      ))}
      search={busca}
      onSearch={setBusca}
      panel={
        edit ? (
          <form
            className="space-y-3"
            onSubmit={(ev) => { ev.preventDefault(); salvar.mutate(); }}
          >
            <h3 className="text-lg font-semibold">{edit.id ? "Editar" : "Nova especialidade"}</h3>
            <div>
              <Label>Tipo</Label>
              <Select value={edit.tipo} onValueChange={(v) => setEdit({ ...edit, tipo: v as Tipo, tempo_espera_min: v === "pa_digital" && !edit.tempo_espera_min ? "15" : edit.tempo_espera_min })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teleconsulta">Teleconsulta (agendada)</SelectItem>
                  <SelectItem value="pa_digital">PA digital (pronto atendimento)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Especialidade</Label><Input required value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></div>
            <div><Label>Para quem</Label><Textarea rows={2} value={edit.para_quem} onChange={(e) => setEdit({ ...edit, para_quem: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cartão de TODOS (R$)</Label><Input inputMode="decimal" placeholder="Vazio = consulte o valor" value={edit.cartao} onChange={(e) => setEdit({ ...edit, cartao: e.target.value })} /></div>
              <div><Label>Particular (R$)</Label><Input inputMode="decimal" value={edit.particular} onChange={(e) => setEdit({ ...edit, particular: e.target.value })} /></div>
            </div>
            {edit.tipo === "pa_digital" && (
              <div className="w-40"><Label>Espera (minutos)</Label><Input inputMode="numeric" value={edit.tempo_espera_min} onChange={(e) => setEdit({ ...edit, tempo_espera_min: e.target.value.replace(/\D/g, "") })} /></div>
            )}
            <div><Label>Como o cliente usa (um passo por linha)</Label><Textarea rows={5} value={edit.passos} onChange={(e) => setEdit({ ...edit, passos: e.target.value })} /></div>
            <div><Label>Indique quando</Label><Textarea rows={2} value={edit.indique_quando} onChange={(e) => setEdit({ ...edit, indique_quando: e.target.value })} /></div>
            <div><Label>Link de agendamento (opcional, vale no lugar do link geral)</Label><Input type="url" placeholder="https://…" value={edit.link_agendamento} onChange={(e) => setEdit({ ...edit, link_agendamento: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} /> Aparece para a equipe</label>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>Fechar</Button>
              {edit.id && <Button type="button" variant="ghost" className="ml-auto text-destructive" onClick={() => confirm(`Excluir "${edit.nome}"? Não dá para desfazer.`) && excluir.mutate(edit.id!)}>Excluir</Button>}
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Escolha uma especialidade na lista para editar, ou use "Nova especialidade" e "Adicionar várias".</p>
            <div className="space-y-2 rounded-lg border border-line p-3">
              <Label>Link do site da Amor Saúde</Label>
              <Input type="url" placeholder="https://…" value={site} onChange={(e) => setSite(e.target.value)} />
              <p className="text-xs">Abre no botão "Abrir o site da Amor Saúde". Precisa começar com https://.</p>
              <Button size="sm" onClick={() => salvarSite.mutate()} disabled={salvarSite.isPending}>Salvar link</Button>
            </div>
          </div>
        )
      }
    >
      <BarraLote quantidade={lote.sel.size} total={lote.total} todos={lote.todos} onSelecionarTodos={lote.selecionarTodos} onLimpar={lote.limpar} onExcluir={excluirLote.abrir} ocupado={excluirLote.ocupado} />
      <ConfirmarLote aberto={excluirLote.aberto} onFechar={excluirLote.fechar} onConfirmar={excluirLote.confirmar} nomes={excluirLote.nomes} singular="item" plural="itens" ocupado={excluirLote.ocupado} erro={excluirLote.erro} />
      {q.isLoading ? <p className="py-6 text-sm text-muted-foreground">Carregando…</p> : visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted-foreground">
          {itens.length === 0 ? 'Nada cadastrado ainda. Use "Adicionar várias" para colar as especialidades da teleconsulta, uma por linha.' : "Nenhum item neste filtro."}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-line px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Checkbox
              aria-label="Selecionar todos os itens da lista"
              checked={lote.todos ? true : lote.algum ? "indeterminate" : false}
              onCheckedChange={lote.alternarTodos}
            />
            <span className="flex-1">Especialidade</span><span className="w-24">Tipo</span><span className="w-20 text-right">Cartão</span>
          </div>
          <ul>
            {visiveis.map((i) => (
              <li key={i.id} className={cn("flex items-center gap-3 border-b border-line px-2 py-2", lote.marcado(i.id) && "bg-gold/10", edit?.id === i.id && "bg-sidebar")}>
                <Checkbox aria-label={`Selecionar ${i.nome}`} checked={lote.marcado(i.id)} onCheckedChange={() => lote.alternar(i.id)} />
                <button type="button" onClick={() => setEdit(doItem(i))} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium hover:underline">
                  <span className="truncate">{i.nome}</span>
                  {!i.ativo && <Badge variant="outline">oculto</Badge>}
                </button>
                <span className="w-24 text-xs text-muted-foreground">{i.tipo === "pa_digital" ? "PA digital" : "Teleconsulta"}</span>
                <span className="w-20 text-right text-sm tabular-nums">{i.cartao != null ? reais(Number(i.cartao)) : <span className="text-xs text-muted-foreground">—</span>}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={!!varias} onOpenChange={(v) => !v && setVarias(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Adicionar várias</DialogTitle></DialogHeader>
          {varias && (
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={varias.tipo} onValueChange={(v) => setVarias({ ...varias, tipo: v as Tipo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teleconsulta">Teleconsulta (agendada)</SelectItem>
                    <SelectItem value="pa_digital">PA digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Uma especialidade por linha</Label>
                <Textarea rows={10} placeholder={"Cardiologia\nClínico geral\nDermatologia"} value={varias.texto} onChange={(e) => setVarias({ ...varias, texto: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">{previa.length} especialidade(s). As que já existem são puladas; valores e passos você completa depois.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVarias(null)}>Cancelar</Button>
            <Button onClick={() => adicionar.mutate()} disabled={adicionar.isPending || previa.length === 0}>{adicionar.isPending ? "Cadastrando…" : `Cadastrar ${previa.length}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminListDetail>
  );
}
