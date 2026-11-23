import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { adminAquecimento, adminReordenarTemas, adminSalvarAquecimento, adminSalvarTema } from "@/lib/aquecimento-admin.functions";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { AdminListDetail, FieldLabel, PanelEmpty, inputCls } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";
import { erro } from "@/components/admin/aquecimento-shared";


// ---------------------------------------------------------------------------
// Aquecimento (adesão, avisos, limite e temas)
// ---------------------------------------------------------------------------

const AQ_KEY = ["admin-aquecimento"] as const;


export function AquecimentoAdminTab() {
  const fn = useServerFn(adminAquecimento);
  const salvarFn = useServerFn(adminSalvarAquecimento);
  const temaFn = useServerFn(adminSalvarTema);
  const ordemFn = useServerFn(adminReordenarTemas);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: AQ_KEY, queryFn: () => fn({}) });
  const d = q.data;
  const [horarios, setHorarios] = useState<string[]>([]);
  const [limite, setLimite] = useState("5");
  const [temaSel, setTemaSel] = useState<string | "novo" | null>(null);
  const [tema, setTema] = useState({ nome: "", descricao: "", ativo: true });

  useEffect(() => {
    if (!d) return;
    setHorarios(d.horarios);
    setLimite(String(d.limite_diario ?? 5));
  }, [d]);

  const sujo = !!d && (JSON.stringify(horarios) !== JSON.stringify(d.horarios) || limite !== String(d.limite_diario ?? 5));
  const refresh = () => qc.invalidateQueries({ queryKey: AQ_KEY });

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { horarios, limite_diario: Math.max(1, Number(limite) || 5) } }),
    onSuccess: () => { toast.success("Salvo."); refresh(); qc.invalidateQueries({ queryKey: ["aquecimento-status"] }); },
    onError: (e) => erro(e instanceof Error && e.message.includes("HH:MM") ? new Error("Use o formato HH:MM nos horários, como 08:30.") : e),
  });
  const salvarTema = useMutation({
    mutationFn: () => temaFn({ data: { id: temaSel && temaSel !== "novo" ? temaSel : null, ...tema } }),
    onSuccess: () => { toast.success("Tema salvo."); setTemaSel(null); refresh(); qc.invalidateQueries({ queryKey: ["meu-mapa"] }); },
    onError: erro,
  });
  const reordenar = useMutation({
    mutationFn: (ids: string[]) => ordemFn({ data: { ids } }),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["meu-mapa"] }); },
    onError: erro,
  });
  const mover = (id: string, dir: -1 | 1) => {
    if (!d) return;
    const ids = d.temas.map((t) => t.id);
    const i = ids.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reordenar.mutate(ids);
  };
  const abrirTema = (t: NonNullable<typeof d>["temas"][number] | null) => {
    if (!t) { setTemaSel("novo"); setTema({ nome: "", descricao: "", ativo: true }); return; }
    setTemaSel(t.id); setTema({ nome: t.nome, descricao: t.descricao, ativo: t.ativo });
  };

  return (
    <AdminListDetail
      title="Aquecimento"
      subtitle="Adesão da equipe nesta semana: dias em que cada pessoa fez o aquecimento."
      panel={
        <div>
          <p className="type-overline text-ink-muted">Avisos do dia</p>
          <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink">Notificações do Chrome</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {horarios.map((h, i) => (
              <div key={i}>
                <FieldLabel>{i + 1}º aviso</FieldLabel>
                <input type="time" className={inputCls} value={h} onChange={(x) => setHorarios(horarios.map((v, j) => (j === i ? x.target.value : v)))} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] leading-5 text-ink-muted">Cada aviso só chega a quem ainda não fez o aquecimento do dia, com a Omnia aberta. Cada pessoa pode desligar a notificação.</p>

          <FieldLabel>Limite de correções por IA</FieldLabel>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={200} className={cn(inputCls, "w-24")} value={limite} onChange={(x) => setLimite(x.target.value)} aria-label="Correções por IA por dia" />
            <span className="text-[14px] text-ink-muted">por dia</span>
          </div>

          <FieldLabel>Temas de domínio</FieldLabel>
          <ul className="space-y-1.5">
            {(d?.temas ?? []).map((t, i) => (
              <li key={t.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => abrirTema(t)}
                  className={cn("rounded-full border px-3 py-1 text-[13.5px] font-medium", t.id === temaSel ? "border-gold bg-surface-2" : "border-ink", !t.ativo && "border-dashed text-ink-muted")}
                >
                  {t.nome}{!t.ativo && " (desativado)"}
                </button>
                <button type="button" aria-label={`Subir ${t.nome}`} disabled={i === 0 || reordenar.isPending} onClick={() => mover(t.id, -1)} className="text-ink-muted hover:text-ink disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5 rotate-90" strokeWidth={1.5} /></button>
                <button type="button" aria-label={`Descer ${t.nome}`} disabled={i === (d?.temas.length ?? 0) - 1 || reordenar.isPending} onClick={() => mover(t.id, 1)} className="text-ink-muted hover:text-ink disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5 rotate-90" strokeWidth={1.5} /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => abrirTema(null)} className="mt-2 rounded-full border border-dashed border-line-strong px-3 py-1 text-[13.5px] text-ink-muted hover:text-ink">+ Novo tema</button>

          {temaSel && (
            <div className="mt-3 rounded-lg border border-line-strong p-3">
              <FieldLabel>Nome do tema</FieldLabel>
              <input className={inputCls} value={tema.nome} maxLength={60} onChange={(x) => setTema({ ...tema, nome: x.target.value })} />
              <FieldLabel>Descrição</FieldLabel>
              <input className={inputCls} value={tema.descricao} maxLength={200} onChange={(x) => setTema({ ...tema, descricao: x.target.value })} />
              <label className="mt-3 flex items-center gap-2 text-[14px] text-ink">
                <input type="checkbox" checked={tema.ativo} onChange={(x) => setTema({ ...tema, ativo: x.target.checked })} className="h-4 w-4 accent-[var(--gold,#B8872E)]" /> Tema ativo
              </label>
              <div className="mt-3 flex items-center gap-3">
                <GoldButton className="h-9 px-4 text-[14px]" disabled={salvarTema.isPending || !tema.nome.trim()} onClick={() => salvarTema.mutate()}>Salvar tema</GoldButton>
                <button type="button" className="text-[13.5px] text-ink-muted hover:text-ink" onClick={() => setTemaSel(null)}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <GoldButton className="h-10 px-4 text-[14px]" disabled={!sujo || salvar.isPending} onClick={() => salvar.mutate()}>Salvar</GoldButton>
            <OutlineButton className="h-10 px-4 text-[14px]" disabled={!sujo} onClick={() => { if (d) { setHorarios(d.horarios); setLimite(String(d.limite_diario ?? 5)); } }}>Cancelar</OutlineButton>
          </div>
        </div>
      }
    >
      {q.isLoading && <p className="py-6 text-[14px] text-ink-muted">Carregando…</p>}
      {q.isError && <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar agora. Tente de novo.</p>}
      {d && d.adesao.length === 0 && <PanelEmpty>Nenhum atendente cadastrado.</PanelEmpty>}
      {d && d.adesao.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="py-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Atendente</th>
              <th scope="col" className="py-2 text-right text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Dias na semana</th>
            </tr>
          </thead>
          <tbody>
            {d.adesao.map((a) => (
              <tr key={a.id} className="border-b border-line">
                <td className="py-2.5 text-[14.5px] text-ink">{a.nome}</td>
                <td className="py-2.5 text-right text-[14.5px] tabular-nums text-ink">{a.dias} de 5</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-[13px] text-ink-muted">O atendente sabe que você vê a adesão. Faltar não gera cobrança automática.</p>
    </AdminListDetail>
  );
}
