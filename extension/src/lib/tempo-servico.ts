// Liga o cálculo (tempo.ts) ao navegador e ao backend. Roda no service worker.
// Nome e prévia ficam SÓ no chrome.storage.local do navegador. Ao backend sobem apenas:
// a chave em hash (chat_key), o início/resposta (horários), os minutos úteis, se foi dentro da meta e o dia.
import { CHAVES_TEMPO, estaPausada, gravarLocal, lerLocal } from "./armazenamento";
import { carregarHashesIgnorados } from "./ignorados";
import { chaveDoContato } from "./mensagens";
import { hashContato, pareceTelefone } from "./numeros";
import { supabase, usuarioAtualId } from "./supabase";
import { CONFIG_PADRAO, diaBR, horarioValido, processarVarredura, type ConfigTempo, type Estado, type Espera, type ItemChave, type Registro } from "./tempo";
import type { ItemLista } from "../content/lista";

const TTL_CONFIG_MS = 10 * 60_000;
const TTL_IGNORADOS_MS = 5 * 60_000;
let cacheConfig: { em: number; cfg: ConfigTempo } | null = null;
let cacheIgnorados: { em: number; usuario: string; hashes: Set<string> } | null = null;
let fila: Promise<unknown> = Promise.resolve();

export async function carregarConfig(): Promise<ConfigTempo> {
  if (cacheConfig && Date.now() - cacheConfig.em < TTL_CONFIG_MS) return cacheConfig.cfg;
  try {
    const r = await supabase.from("extensao_config").select("meta_minutos, nova_conversa_horas, horario").eq("id", 1).maybeSingle();
    if (!r.error && r.data) {
      const cfg: ConfigTempo = {
        meta_minutos: Number(r.data.meta_minutos) || CONFIG_PADRAO.meta_minutos,
        nova_conversa_horas: Number(r.data.nova_conversa_horas) || CONFIG_PADRAO.nova_conversa_horas,
        horario: horarioValido(r.data.horario),
      };
      cacheConfig = { em: Date.now(), cfg };
      return cfg;
    }
  } catch { /* usa o padrão */ }
  return cacheConfig?.cfg ?? CONFIG_PADRAO;
}

async function hashesIgnorados(usuario: string): Promise<Set<string>> {
  if (cacheIgnorados && cacheIgnorados.usuario === usuario && Date.now() - cacheIgnorados.em < TTL_IGNORADOS_MS) return cacheIgnorados.hashes;
  const hashes = new Set(await carregarHashesIgnorados());
  cacheIgnorados = { em: Date.now(), usuario, hashes };
  return hashes;
}

export async function chaveDaConversa(usuario: string, nome: string): Promise<string> {
  return hashContato(usuario, chaveDoContato({ nome, numero: pareceTelefone(nome) ? nome : "" }));
}

async function enviar(r: Registro, dia: string): Promise<void> {
  const base = { chat_key: r.chave, inicio_em: new Date(r.inicio).toISOString(), dia };
  try {
    if (r.resposta === null) {
      // Conversa nova, ainda sem resposta. Se a linha já existe, não mexe (pode já ter resposta).
      await supabase.from("extensao_tempos").upsert(base, { onConflict: "user_id,chat_key,inicio_em", ignoreDuplicates: true });
    } else {
      await supabase.from("extensao_tempos").upsert(
        { ...base, resposta_em: new Date(r.resposta).toISOString(), minutos_uteis: r.minutos, dentro_da_meta: r.dentro },
        { onConflict: "user_id,chat_key,inicio_em" },
      );
    }
  } catch { /* falha em silêncio: o próximo ciclo não repete, mas nada atrapalha o atendente */ }
}

/** Trata uma varredura da lista. Pausada, sem login ou sem itens: não faz nada. */
export function tratarVarredura(itens: ItemLista[]): Promise<void> {
  fila = fila.then(() => executar(itens)).catch(() => undefined);
  return fila as Promise<void>;
}

async function executar(itens: ItemLista[]): Promise<void> {
  if (await estaPausada()) return;
  const usuario = await usuarioAtualId();
  if (!usuario || !Array.isArray(itens) || itens.length === 0) return;
  const cfg = await carregarConfig();
  const ignorados = await hashesIgnorados(usuario);

  const comChave: ItemChave[] = [];
  for (const it of itens) {
    if (!it || typeof it.nome !== "string") continue;
    const chave = await chaveDaConversa(usuario, it.nome);
    if (ignorados.has(chave)) continue; // contato ignorado: nada é guardado nem enviado
    comChave.push({ ...it, chave });
  }

  const estado = await lerLocal<Estado>(CHAVES_TEMPO.estado(usuario), {});
  const agora = Date.now();
  const r = processarVarredura(estado, comChave, agora, cfg);
  await gravarLocal(CHAVES_TEMPO.estado(usuario), r.estado);
  await gravarLocal(CHAVES_TEMPO.espera(usuario), { atualizado_em: agora, itens: r.espera satisfies Espera[] });
  for (const reg of r.registros) await enviar(reg, diaBR(reg.inicio));
}
