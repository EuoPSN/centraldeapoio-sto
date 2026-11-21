import { useCallback, useEffect, useState } from "react";
import { CONFIG } from "../config";
import { supabase } from "../lib/supabase";
import { resumirHoje, rotuloPrazo, type ResumoHoje, type TicketHoje } from "../lib/hoje";
import { ETAPA_NOME, PONTO_CURTO, type EtapaFunil, type Ponto } from "../lib/rotulos";

// Só as colunas abaixo: o número do cliente nunca é pedido nem aparece nesta lista. A regra do banco (RLS) já limita aos tickets do atendente.
const COLUNAS = "id, primeiro_nome, status, etapa_atual, proxima_em, etapa_funil, ponto_parada, plano, updated_at";

function descricao(t: TicketHoje): string {
  const base = t.etapa_funil ? ETAPA_NOME[t.etapa_funil as EtapaFunil] : PONTO_CURTO[t.ponto_parada as Ponto] ?? t.ponto_parada;
  return t.plano ? `${base} · ${t.plano}` : base;
}

export function Hoje({ atualizar, onContagem, ativa, pausada }: { atualizar: number; onContagem: (n: number) => void; ativa: boolean; pausada: boolean }) {
  const [resumo, setResumo] = useState<ResumoHoje | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (pausada) { setCarregando(false); return; } // pausada: nenhuma chamada
    setCarregando(true);
    const desde = new Date(Date.now() - 2 * 86400_000).toISOString();
    // Na fila (para hoje/atrasados) + o que foi mexido nas últimas horas (para o contador "Atualizados hoje").
    const [fila, recentes] = await Promise.all([
      supabase.from("retomadas").select(COLUNAS).eq("status", "fila").not("proxima_em", "is", null).limit(500),
      supabase.from("retomadas").select(COLUNAS).gte("updated_at", desde).limit(500),
    ]);
    if (fila.error || recentes.error) {
      setErro("Não consegui carregar seus tickets agora. Tente de novo.");
      setCarregando(false);
      return;
    }
    const mapa = new Map<string, TicketHoje>();
    for (const r of [...(fila.data ?? []), ...(recentes.data ?? [])] as TicketHoje[]) mapa.set(r.id, r);
    const r = resumirHoje([...mapa.values()]);
    setErro(null);
    setResumo(r);
    onContagem(r.paraHoje.length);
    setCarregando(false);
  }, [onContagem, pausada]);

  useEffect(() => { void carregar(); }, [carregar, atualizar]);
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === "visible") void carregar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [carregar]);

  return (
    <div hidden={!ativa}>
      {pausada && <div className="aviso" role="status">A extensão está pausada. Nenhuma chamada é feita até você retomar.</div>}
      {erro && <div className="aviso" role="alert">{erro} <button className="pilula" onClick={() => void carregar()}>Tentar de novo</button></div>}
      {!resumo && carregando && !erro && <p className="carregando">Carregando seus tickets…</p>}
      {resumo && (
        <>
          <div className="contadores">
            <div className="card"><p className="rotulo">Para hoje</p><strong>{resumo.paraHoje.length}</strong></div>
            <div className="card"><p className="rotulo">Atualizados hoje</p><strong>{resumo.atualizadosHoje}</strong></div>
          </div>
          <p className="rotulo">Tickets do dia</p>
          {resumo.paraHoje.length === 0 ? (
            <div className="card"><p style={{ margin: 0 }}>Nada para retomar hoje. Quando você salvar um ticket, ele aparece aqui no dia certo.</p></div>
          ) : (
            <ul className="lista">
              {resumo.paraHoje.map((t) => (
                <li key={t.id}>
                  <span><strong>{t.primeiro_nome || "Cliente"}</strong><br /><span className="suave">{descricao(t)}</span></span>
                  <span className="prazo">{rotuloPrazo(t)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <a className="btn bloco" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 14 }} href={`${CONFIG.OMNIA_URL}/retomar`} target="_blank" rel="noreferrer">
        Abrir o Retomar hoje na Omnia ↗
      </a>
      <p className="suave" style={{ marginTop: 10 }}>
        Esta lista mostra só os seus tickets. Mensagens prontas e o prazo de cada retomada ficam no Retomar hoje.
        {" "}<button className="pilula" onClick={() => void carregar()} disabled={carregando}>Atualizar</button>
      </p>
    </div>
  );
}
