// Pede o relatório de estrutura ao content script (via service worker) e completa com dados do painel.
import type { Relatorio } from "./mensagens";
import { ultimoResultado } from "./diagnostico-estado";
import { MOTIVO_SEM_CONTENT_SCRIPT } from "./textos";

function versao(): string {
  try { return chrome.runtime.getManifest().version; } catch { return "desconhecida"; }
}

/** Relatório mínimo quando o content script não responde (aba errada ou página sem recarregar). */
function semContentScript(dominio: string, pausada = false): Relatorio {
  return {
    formato: 1, gerado_em: new Date().toISOString(), extensao: { versao: versao() },
    aba: { dominio, content_script_presente: false }, ...(pausada ? { pausada: true } : {}),
    seletores: [], cabecalho: { encontrado: false, arvore: null },
    area_de_mensagens: { total: 0, recebidas: 0, enviadas: 0, arvore: null },
    deteccao: {
      sinais_de_grupo: {}, verificacoes_positivas: {}, decisao: "nao_le",
      motivo_codigo: pausada ? "pausada" : "sem_content_script",
      motivo: pausada ? "extensão pausada: nada é lido" : MOTIVO_SEM_CONTENT_SCRIPT,
    },
  };
}

export async function gerarDiagnostico(): Promise<Relatorio> {
  let r: Relatorio | { ok: false; codigo?: string; dominio?: string } | undefined;
  try {
    r = await chrome.runtime.sendMessage({ para: "content", pedido: { tipo: "omnia:diagnostico", versao: versao() } });
  } catch {
    r = undefined;
  }
  const rel: Relatorio = r && "formato" in r ? r : semContentScript(r && "dominio" in r && r.dominio ? r.dominio : "indisponível", !!r && "codigo" in r && r.codigo === "pausada");
  return { ...rel, ultimo_resultado_no_painel: ultimoResultado() };
}
