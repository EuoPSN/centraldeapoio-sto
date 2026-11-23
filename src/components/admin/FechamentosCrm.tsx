import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fecharTicketsCrm, getCrmEstado, gravarFechamentosCrm, salvarVendedorMap } from "@/lib/crm.functions";
import {
  conferencia, hashesPorUsuario, lerMatrizCrm, montarLinhas, noPeriodo, resumirEnvio, textoResumo, vendedoresDe,
  type LeituraCrm, type ResumoEnvio,
} from "@/lib/crm";
import { arquivoParaMatriz } from "@/lib/crm-arquivo";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { FieldLabel, inputCls } from "@/components/admin/AdminListDetail";

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Bloco "Fechamentos do CRM" (Admin > Extensão do WhatsApp). O arquivo é lido AQUI, no navegador:
 * o servidor só recebe hashes de telefone e nomes de vendedores, e a planilha não é guardada. */
export function FechamentosCrm() {
  const qc = useQueryClient();
  const estadoFn = useServerFn(getCrmEstado);
  const mapFn = useServerFn(salvarVendedorMap);
  const fecharFn = useServerFn(fecharTicketsCrm);
  const gravarFn = useServerFn(gravarFechamentosCrm);
  const estadoQ = useQuery({ queryKey: ["admin-crm-estado"], queryFn: () => estadoFn({}) });
  const estado = estadoQ.data;
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [leitura, setLeitura] = useState<LeituraCrm | null>(null);
  const [periodo, setPeriodo] = useState<{ ini: string; fim: string }>({ ini: "", fim: "" });
  const [erro, setErro] = useState<{ motivo: string; faltando?: string[] } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [resultado, setResultado] = useState<ResumoEnvio | null>(null);

  const mapa = estado?.mapa ?? {};
  const vendasPeriodo = leitura ? noPeriodo(leitura.vendas, periodo.ini, periodo.fim) : [];
  const vendedores = vendedoresDe(vendasPeriodo);
  const conf = conferencia(vendedores, mapa);

  async function escolher(f: File | undefined) {
    if (!f) return;
    setErro(null); setResultado(null); setLeitura(null); setLendo(true);
    try {
      const matriz = await arquivoParaMatriz(f);
      const r = await lerMatrizCrm(matriz);
      if (!r.ok) { setErro({ motivo: r.motivo, faltando: r.faltando }); return; }
      if (!r.periodo) { setErro({ motivo: "Não achei nenhuma venda com data na coluna Venda." }); return; }
      setLeitura(r);
      setPeriodo(r.periodo);
    } catch (e) {
      setErro({ motivo: e instanceof Error ? e.message : "Não consegui ler a planilha." });
    } finally {
      setLendo(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  }

  async function mapear(key: string, userId: string) {
    try {
      await mapFn({ data: { vendedor: key, user_id: userId || null } });
      await qc.invalidateQueries({ queryKey: ["admin-crm-estado"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não consegui salvar."); }
  }

  async function gravar() {
    if (!leitura || !estado) return;
    setGravando(true);
    try {
      const porUsuario = hashesPorUsuario(vendasPeriodo, mapa);
      const casados: Record<string, string[]> = {};
      for (const [user_id, hashes] of Object.entries(porUsuario)) {
        const r = await fecharFn({ data: { user_id, hashes, ini: periodo.ini, fim: periodo.fim } });
        casados[user_id] = [...r.fechados, ...r.ja_fechados];
      }
      const linhas = montarLinhas(vendasPeriodo, mapa, casados);
      await gravarFn({ data: { ini: periodo.ini, fim: periodo.fim, linhas } });
      setResultado(resumirEnvio(linhas, periodo.ini, periodo.fim, conf));
      setLeitura(null);
      toast.success("Fechamentos gravados.");
      qc.invalidateQueries({ queryKey: ["admin-crm-estado"] });
      qc.invalidateQueries({ queryKey: ["ranking"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui gravar.");
    } finally {
      setGravando(false);
    }
  }

  const ultimo = estado?.ultimo;
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="type-overline text-ink-muted">Fechamentos do CRM</p>
      <div className="mt-2 rounded-xl border border-dashed border-line-strong p-4">
        <p className="text-[14px] leading-6 text-ink">
          Envie a planilha <strong>clientes-vendas</strong> (semanal, .xlsx ou .csv). O cruzamento por telefone acontece no seu navegador. A planilha não é guardada. Cada envio substitui o período que ela cobre.
        </p>
        <input ref={arquivoRef} type="file" accept=".xlsx,.csv" className="sr-only" id="crm-arquivo" onChange={(e) => void escolher(e.target.files?.[0])} />
        <GoldButton className="mt-3 h-9 text-[14px]" onClick={() => arquivoRef.current?.click()} disabled={lendo || gravando}>{lendo ? "Lendo…" : "Enviar planilha"}</GoldButton>
      </div>

      {erro && (
        <div role="alert" className="mt-3 rounded-lg border border-line-strong p-3 text-[13.5px] text-ink">
          <p>{erro.motivo}</p>
          {erro.faltando && <p className="mt-1 text-ink-muted">Colunas esperadas: Nome do cliente, Telefone, Vendedor e a data da etapa Venda.</p>}
        </div>
      )}

      {leitura && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel htmlFor="crm-ini">Período: de</FieldLabel><input id="crm-ini" type="date" className={inputCls} value={periodo.ini} onChange={(e) => setPeriodo({ ...periodo, ini: e.target.value })} /></div>
            <div><FieldLabel htmlFor="crm-fim">até</FieldLabel><input id="crm-fim" type="date" className={inputCls} value={periodo.fim} onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} /></div>
          </div>
          <p className="text-[13.5px] text-ink">
            {vendasPeriodo.length} vendas no período · vendedores conferidos {conf.conferidos} de {conf.total}
            {leitura.semTelefoneValido > 0 && <span className="text-ink-muted"> · {leitura.semTelefoneValido} sem telefone válido (contam como venda sem ticket)</span>}
          </p>
          {leitura.avisos.map((a) => <p key={a} className="text-[12.5px] text-ink-muted">{a}</p>)}
          {conf.pendentes.length > 0 && (
            <div>
              <FieldLabel>Vendedores pendentes (não contam até mapear)</FieldLabel>
              <ul className="space-y-2">
                {conf.pendentes.map((p) => (
                  <li key={p.key} className="grid grid-cols-[1fr_1fr] items-center gap-2 text-[14px]">
                    <span className="text-ink">{p.nome} <span className="text-ink-muted">({p.vendas})</span></span>
                    <select aria-label={`Quem é ${p.nome} na Omnia`} className={inputCls} value="" onChange={(e) => void mapear(p.key, e.target.value)}>
                      <option value="">Escolher atendente…</option>
                      {(estado?.atendentes ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[12.5px] text-ink-muted">Gravar substitui os fechamentos de {dm(periodo.ini)} a {dm(periodo.fim)} e fecha como “Venda concluída (CRM)” os tickets abertos que casarem.</p>
          <div className="flex flex-wrap gap-2">
            <GoldButton className="h-9 text-[14px]" onClick={() => void gravar()} disabled={gravando || !periodo.ini || !periodo.fim || periodo.fim < periodo.ini || vendasPeriodo.length === 0}>{gravando ? "Gravando…" : "Gravar fechamentos"}</GoldButton>
            <OutlineButton className="h-9 text-[14px]" onClick={() => setLeitura(null)} disabled={gravando}>Cancelar</OutlineButton>
          </div>
        </div>
      )}

      {resultado && (
        <div role="status" className="mt-3 rounded-lg border border-line-strong p-3 text-[13.5px] text-ink">
          <p className="font-semibold">Planilha gravada.</p>
          <p>{textoResumo(resultado)}</p>
          {resultado.pendentes.length > 0 && <p className="text-ink-muted">Pendentes (não contaram): {resultado.pendentes.join(", ")}.</p>}
        </div>
      )}

      {!leitura && !resultado && ultimo && (
        <p className="mt-3 text-[12.5px] leading-5 text-ink-muted">
          Último envio: {dm(ultimo.ini)} a {dm(ultimo.fim)} · {ultimo.vendas} vendas · {ultimo.tickets_fechados} tickets fechados · {ultimo.sem_ticket} sem ticket.
        </p>
      )}
      <p className="mt-2 text-[12.5px] leading-5 text-ink-muted">Alimenta o pódio “Mais fechamentos” e o comparativo de 60 dias antes e depois.</p>
    </div>
  );
}
