import { useCallback, useEffect, useState } from "react";
import { CHAVES_TEMPO, lerLocal } from "../lib/armazenamento";
import { supabase } from "../lib/supabase";
import { carregarConfig } from "../lib/tempo-servico";
import { diaBR, formatarMinutos, minutosUteis, type ConfigTempo, type Espera } from "../lib/tempo";
import { CONFIG_PADRAO } from "../lib/tempo";

interface Resumo { meta_minutos: number; conversas_novas: number; respondidas: number; dentro_da_meta: number; sem_resposta: number; media_minutos: number | null }

/** Aba "Tempo de resposta". Os números vêm da Omnia e são só os do próprio atendente.
 * A lista de quem espera usa o que foi lido localmente na lista de conversas: nome e prévia nunca foram enviados. */
export function Tempo({ usuarioId, ativa, pausada }: { usuarioId: string; ativa: boolean; pausada: boolean }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [espera, setEspera] = useState<Espera[]>([]);
  const [cfg, setCfg] = useState<ConfigTempo>(CONFIG_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const local = await lerLocal<{ itens: Espera[] } | null>(CHAVES_TEMPO.espera(usuarioId), null);
    setEspera(local?.itens ?? []);
    if (pausada) { setCarregando(false); return; } // pausada: nenhuma chamada
    setCarregando(true);
    const [c, r] = await Promise.all([carregarConfig(), supabase.rpc("extensao_tempo_resumo", { _dia: diaBR(Date.now()) })]);
    setCfg(c);
    if (r.error) setErro("Não consegui carregar o tempo de resposta agora. Tente de novo.");
    else { setErro(null); setResumo(r.data as Resumo); }
    setCarregando(false);
  }, [usuarioId, pausada]);

  useEffect(() => { if (ativa) void carregar(); }, [ativa, carregar]);
  useEffect(() => {
    if (!ativa) return;
    const t = setInterval(() => void carregar(), 30_000);
    const ouvir = (m: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && CHAVES_TEMPO.espera(usuarioId) in m) setEspera(((m[CHAVES_TEMPO.espera(usuarioId)].newValue as { itens: Espera[] })?.itens) ?? []);
    };
    chrome.storage.onChanged.addListener(ouvir);
    return () => { clearInterval(t); chrome.storage.onChanged.removeListener(ouvir); };
  }, [ativa, carregar, usuarioId]);

  const meta = resumo?.meta_minutos ?? cfg.meta_minutos;
  const media = resumo?.media_minutos ?? null;
  const pct = media === null ? 0 : Math.min(100, (media / (meta * 2)) * 100); // a barra vai até 2x a meta
  const dentro = media !== null && media <= meta;
  const agora = Date.now();

  return (
    <div hidden={!ativa}>
      {pausada && <div className="aviso" role="status">A extensão está pausada. Nada é lido nem enviado até você retomar.</div>}
      {erro && <div className="aviso" role="alert">{erro} <button className="pilula" onClick={() => void carregar()}>Tentar de novo</button></div>}
      {!resumo && carregando && !erro && !pausada && <p className="carregando">Carregando…</p>}
      {resumo && (
        <>
          <div className="card destaque">
            <p className="rotulo">Primeira resposta de hoje</p>
            <strong className="grande">{formatarMinutos(media)}</strong>
            <div className={`barra${media !== null && !dentro ? " acima" : ""}`} role="img" aria-label={media === null ? "Sem respostas medidas hoje" : `Média de ${formatarMinutos(media)} para a meta de ${meta} minutos`}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="suave" style={{ margin: 0 }}>
              Meta: {meta} minutos{media === null ? " · ainda sem respostas medidas hoje" : dentro ? " · você está dentro da meta" : " · acima da meta hoje"}
            </p>
          </div>
          <div className="contadores">
            <div className="card">
              <p className="rotulo">Dentro da meta</p>
              <strong className="grande">{resumo.dentro_da_meta}</strong>
              <span className="suave">de {resumo.conversas_novas} conversas novas</span>
            </div>
            <div className="card">
              <p className="rotulo">Sem resposta</p>
              <strong className="grande destaque-num">{resumo.sem_resposta}</strong>
              <span className="suave">há mais de {meta} min</span>
            </div>
          </div>
        </>
      )}
      <p className="rotulo">Conversas esperando resposta</p>
      {espera.length === 0 ? (
        <div className="card"><p style={{ margin: 0 }}>Nenhuma conversa nova esperando acima da meta.</p></div>
      ) : (
        <ul className="lista">
          {espera.map((e) => (
            <li key={e.chave}>
              <span><strong>{e.nome}</strong><br /><span className="suave">{e.previa}</span></span>
              <span className="prazo">{Math.max(1, Math.round(minutosUteis(e.inicio, agora, cfg.horario)))} min</span>
            </li>
          ))}
        </ul>
      )}
      <p className="suave" style={{ marginTop: 14 }}>
        Conta só no horário de atendimento. Mensagens automáticas não contam como resposta. Conversa nova = cliente escreve depois de {cfg.nova_conversa_horas} h de silêncio.
        A extensão lê só a lista de conversas (nome, prévia e horário), sem abrir nenhuma; nome e prévia ficam no seu navegador e nunca são enviados.
      </p>
    </div>
  );
}
