// Extensão do Chrome — só servidor: autenticação por token, "Ler conversa" (IA) e respostas HTTP.
// A extensão NUNCA chama a IA direto nem guarda chave: tudo passa por aqui, pelo Cérebro.

import { createClient } from "@supabase/supabase-js";
import { chamarIAJson, montarInstrucoes, registrarUso, statusUso } from "@/lib/cerebro.server";
import { EXTENSAO_MODEL } from "@/lib/ai-models";
import { ETAPAS_FUNIL, ETAPA_FUNIL_NOME, mensagemLimite } from "@/lib/cerebro";
import { PONTO_LISTA, PONTOS, QUANDO } from "@/lib/retomada";
import {
  ERRO_LER, ClienteDisseEntrada, LerConversaEntrada, TicketEntrada, acharTicketDoNumero, calcularMudancas, tentarProposta,
  type ClienteDisseResposta, type LerConversaEntradaT, type Mudanca, type Proposta, type SalvarTicketEntradaT, type TicketDTO,
} from "@/lib/extensao";
import { chaveNumero, montarTranscricao, numeroValido, primeiroNome, sanitizarMensagens, sanitizarTexto, soDigitos } from "@/lib/extensao-sanitizar";
import { agendarInicial } from "@/lib/retomada";
import { criarTicketExterno } from "@/lib/retomada.functions";
import { classificarFalaCore, sugerirRespostaCore } from "@/lib/cliente-disse.functions";
import { casosParecidos } from "@/lib/biblioteca.functions";
import { toFechamentoItem, toObjecao } from "@/lib/cliente-disse";

export type CtxExt = { supabase: unknown; userId: string };

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });
}
export const opcoes = () => new Response(null, { status: 204, headers: CORS });

export class ErroExt extends Error {
  constructor(public status: number, message: string, public codigo?: string) { super(message); }
}

/** Valida o token Bearer (mesma regra do middleware das funções do app) e devolve o cliente do usuário (RLS vale). */
export async function autenticar(request: Request): Promise<CtxExt> {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) throw new ErroExt(500, "Servidor sem configuração do banco.");
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new ErroExt(401, "Entre de novo na extensão.", "sessao");
  const token = auth.slice(7).trim();
  if (token.split(".").length !== 3) throw new ErroExt(401, "Entre de novo na extensão.", "sessao");
  const supabase = createClient(url, chave, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new ErroExt(401, "Sua sessão expirou. Entre de novo.", "sessao");
  return { supabase, userId: data.claims.sub };
}

/** Envolve um handler: autentica, valida o corpo e traduz erros em JSON amigável. */
export async function tratar(request: Request, fn: (ctx: CtxExt, corpo: unknown) => Promise<unknown>): Promise<Response> {
  try {
    const ctx = await autenticar(request);
    const corpo = request.method === "GET" ? null : await request.json().catch(() => { throw new ErroExt(400, "Pedido inválido."); });
    return json(200, await fn(ctx, corpo));
  } catch (e) {
    if (e instanceof ErroExt) return json(e.status, { erro: e.message, codigo: e.codigo ?? null });
    console.error("[extensao] erro:", e instanceof Error ? e.message : e);
    return json(500, { erro: ERRO_LER, codigo: null });
  }
}

// ---------------------------------------------------------------------------
// Ler conversa (IA)
// ---------------------------------------------------------------------------

const CONTEXTO_EXTENSAO = `Contexto: venda B2C do Cartão de TODOS pelo WhatsApp (Ribeirão das Neves e região).
Você lê uma conversa de WhatsApp entre um cliente e um atendente e PROPÕE os campos de um ticket de retomada.
O texto chega sem telefone, CPF, e-mail nem links; o nome do cliente aparece como [nome]. Nunca tente adivinhar ou reescrever esses dados.
Funil do CRM (use exatamente estes códigos): ${ETAPAS_FUNIL.map((e) => `${e} = ${ETAPA_FUNIL_NOME[e]}`).join("; ")}.
Pontos de parada (use exatamente estes códigos): ${PONTOS.map((p) => `${p} = ${PONTO_LISTA[p]}`).join("; ")}.
Quando retomar (use exatamente estes códigos): ${QUANDO.map((q) => `${q.id} = ${q.label}`).join("; ")}. Os de horas são follow-up no mesmo dia; "amanha" inicia a régua D+1, D+2, D+4, D+7, D+10.`;

const FORMATO = `Responda APENAS com JSON, sem texto fora dele, neste formato:
{
 "etapa_funil": "<um dos códigos do funil>",
 "venda_explicita": false,
 "evidencia_venda": "",
 "ponto_parada": "<um dos códigos de ponto de parada>",
 "plano": "Prata" | "Ouro" | "Diamante" | "",
 "dependentes": <número ou null>,
 "observacao": "<até 200 caracteres, o que importa para retomar; SEM nome, telefone, CPF, e-mail ou outro dado pessoal; use 'o cliente' ou 'ela/ele'>",
 "quando_retomar": "<um dos códigos de quando retomar>",
 "objecoes_detectadas": ["<objeção dita pelo cliente, curta>"]
}
Regras:
- "venda_concluida" SÓ quando o próprio cliente confirmou a compra/pagamento de forma explícita (venda_explicita true e evidencia_venda com a frase exata da conversa). Na dúvida, NUNCA proponha venda_concluida: use "fechamento".
- "plano" só se a conversa deixar claro qual plano o cliente quer ou recebeu; senão "". "dependentes" só se citado; senão null.
- Não invente preço, regra nem benefício. Não escreva nada sobre o tipo de produto além do que a conversa diz.
- Pagamento: somente cartão de crédito ou débito.`;

export interface LerConversaResultado { proposta: Proposta; uso: { usado: number; limite: number | null } }

/** Recebe a conversa já sanitizada no navegador, sanitiza DE NOVO e devolve a proposta de ticket.
 * Nada da conversa é gravado: só `ia_uso` (quem, ferramenta e quando). */
export async function lerConversaExtensao(ctx: CtxExt, entrada: LerConversaEntradaT): Promise<LerConversaResultado> {
  const st = await statusUso(ctx, "extensao");
  if (st.bloqueado) throw new ErroExt(429, mensagemLimite("extensao"), "limite");

  const msgs = sanitizarMensagens(entrada.mensagens);
  if (!msgs.length) throw new ErroExt(422, "Não há mensagens de texto para ler nesta conversa.", "sem_texto");
  const transcricao = montarTranscricao(msgs);

  const instrucoes = (await montarInstrucoes("extensao", CONTEXTO_EXTENSAO)).texto;
  const system = `${instrucoes}\n\n${FORMATO}`;
  const user = `CONVERSA (da mais antiga para a mais recente):\n${transcricao}`;

  let proposta: Proposta | null = null;
  for (let tentativa = 0; tentativa < 2 && !proposta; tentativa++) {
    try {
      const raw = await chamarIAJson({
        model: EXTENSAO_MODEL, temperature: tentativa === 0 ? 0.2 : 0,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      });
      proposta = tentarProposta(raw, transcricao, undefined);
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      // Erros do provedor (limite, créditos) não adiantam repetir.
      if (/Limite de uso da IA|Créditos da IA|LOVABLE_API_KEY/.test(m)) throw new ErroExt(503, "A IA está indisponível agora. Tente em instantes.", "ia");
      proposta = null;
    }
  }
  if (!proposta) throw new ErroExt(502, ERRO_LER, "ia_invalida");

  await registrarUso(ctx, "extensao");
  return { proposta, uso: { usado: st.usado + 1, limite: st.limite } };
}

// ---------------------------------------------------------------------------
// Ticket: criar ou atualizar (nunca duplica o mesmo número do mesmo atendente)
// ---------------------------------------------------------------------------

const db = (ctx: CtxExt) => ctx.supabase as any;
const COLS_TICKET = "id, codigo, primeiro_nome, etapa_funil, ponto_parada, plano, dependentes, observacao, status, etapa_atual, proxima_em, created_at, updated_at";

function paraDTO(r: Record<string, unknown>): TicketDTO {
  return {
    id: String(r.id), codigo: String(r.codigo ?? ""), primeiro_nome: String(r.primeiro_nome ?? ""),
    etapa_funil: (r.etapa_funil as TicketDTO["etapa_funil"]) ?? null,
    ponto_parada: r.ponto_parada as TicketDTO["ponto_parada"],
    plano: (r.plano as string | null) ?? null,
    dependentes: r.dependentes == null ? null : Number(r.dependentes),
    observacao: String(r.observacao ?? ""),
    status: String(r.status ?? ""), etapa_atual: String(r.etapa_atual ?? ""),
    proxima_em: (r.proxima_em as string | null) ?? null,
    created_at: String(r.created_at ?? ""), updated_at: String(r.updated_at ?? ""),
  };
}
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new ErroExt(500, "Não consegui falar com o banco agora. Tente de novo.");
  return r.data;
}

export interface HistoricoLinha { campo: string; valor_anterior: string | null; valor_novo: string | null; origem: string; created_at: string }

/** Evento para o Admin (só tipo e hora, nunca conteúdo). Falha em silêncio: não derruba o ticket. */
export async function registrarEvento(ctx: CtxExt, tipo: string): Promise<void> {
  try {
    await db(ctx).from("extensao_eventos").insert({ user_id: ctx.userId, tipo });
  } catch (err) {
    console.error("[extensao] evento não gravado:", err instanceof Error ? err.message : err);
  }
}

async function ticketsAbertosComTelefone(ctx: CtxExt) {
  const rows = check(await db(ctx).from("retomadas").select(`${COLS_TICKET}, telefone`)
    .eq("user_id", ctx.userId).in("status", ["fila", "respondeu"]).not("telefone", "is", null)) as (Record<string, unknown> & { telefone: string | null })[];
  return rows;
}

async function outroAtendenteTem(ctx: CtxExt, numero: string): Promise<boolean> {
  const chave = chaveNumero(numero);
  if (!chave) return false;
  const r = await db(ctx).rpc("numero_com_outro_atendente", { _chave: chave });
  return r.error ? false : r.data === true;
}

async function historicoDoTicket(ctx: CtxExt, id: string): Promise<HistoricoLinha[]> {
  const r = await db(ctx).from("ticket_historico").select("campo, valor_anterior, valor_novo, origem, created_at")
    .eq("ticket_id", id).order("created_at", { ascending: false }).limit(60);
  return r.error ? [] : ((r.data ?? []) as HistoricoLinha[]);
}

export interface ConsultaTicket { existente: TicketDTO | null; historico: HistoricoLinha[]; outroAtendente: boolean }

/** Já existe ticket aberto deste número para este atendente? (Outro atendente: só um aviso, sem detalhes.) */
export async function consultarTicket(ctx: CtxExt, numero: string): Promise<ConsultaTicket> {
  if (!numeroValido(numero)) return { existente: null, historico: [], outroAtendente: false };
  const meus = await ticketsAbertosComTelefone(ctx);
  const achou = acharTicketDoNumero(meus, numero);
  if (achou) return { existente: paraDTO(achou), historico: await historicoDoTicket(ctx, String(achou.id)), outroAtendente: false };
  return { existente: null, historico: [], outroAtendente: await outroAtendenteTem(ctx, numero) };
}

export interface ResultadoSalvar { acao: "criado" | "atualizado"; ticket: TicketDTO; mudancas: Mudanca[]; outroAtendente: boolean }

const valorHist = (campo: string, v: string | null) => (v == null ? null : v.slice(0, 600));

async function gravarHistorico(ctx: CtxExt, ticketId: string, linhas: { campo: string; de: string | null; para: string | null }[]) {
  if (!linhas.length) return;
  const agora = new Date().toISOString(); // mesmo instante em todas as linhas = uma "edição"
  const r = await db(ctx).from("ticket_historico").insert(
    linhas.map((l) => ({ ticket_id: ticketId, user_id: ctx.userId, campo: l.campo, valor_anterior: valorHist(l.campo, l.de), valor_novo: valorHist(l.campo, l.para), origem: "extensao", created_at: agora })),
  );
  if (r.error) console.error("[extensao] histórico não gravado:", r.error.message);
}

/** Salva o que o atendente conferiu: atualiza o ticket aberto do mesmo número ou cria um novo. */
export async function salvarTicket(ctx: CtxExt, e: SalvarTicketEntradaT): Promise<ResultadoSalvar> {
  const c = e.campos;
  const nome = primeiroNome(e.nome) || "Cliente";
  const temNumero = numeroValido(e.numero);
  const telefone = temNumero ? soDigitos(e.numero) : null;
  const ag = agendarInicial(c.quando as never);
  const retomar = ag.em.toISOString();

  const achou = temNumero ? acharTicketDoNumero(await ticketsAbertosComTelefone(ctx), e.numero) : null;

  if (achou) {
    const atual = paraDTO(achou);
    const mudancas = calcularMudancas(atual, { etapa_funil: c.etapa_funil, ponto_parada: c.ponto_parada, plano: c.plano, dependentes: c.dependentes, observacao: c.observacao }, retomar);
    const patch: Record<string, unknown> = {
      etapa_funil: c.etapa_funil, ponto_parada: c.ponto_parada, plano: c.plano || null, dependentes: c.dependentes,
      observacao: c.observacao, etapa_atual: ag.etapa, proxima_em: retomar,
    };
    const extras: { campo: string; de: string | null; para: string | null }[] = [];
    if (atual.status === "respondeu") { patch.status = "fila"; extras.push({ campo: "status", de: "respondeu", para: "fila" }); }
    const novo = check(await db(ctx).from("retomadas").update(patch).eq("id", atual.id).eq("user_id", ctx.userId).select(COLS_TICKET).single()) as Record<string, unknown>;
    await gravarHistorico(ctx, atual.id, [...mudancas, ...extras]);
    await registrarEvento(ctx, "ticket_atualizado");
    return { acao: "atualizado", ticket: paraDTO(novo), mudancas, outroAtendente: false };
  }

  // Número novo para este atendente (mesmo que outro atendente já tenha o contato: nada é revelado).
  const outro = temNumero ? await outroAtendenteTem(ctx, e.numero) : false;
  const criado = await criarTicketExterno(ctx as never, {
    primeiro_nome: nome, telefone, observacao: c.observacao, ponto_parada: c.ponto_parada, quando: c.quando,
    etapa_funil: c.etapa_funil, plano: (c.plano || null) as never, dependentes: c.dependentes,
  } as never);
  const linhas = [
    { campo: "ticket", de: null, para: "criado" },
    { campo: "etapa_funil", de: null, para: c.etapa_funil },
    { campo: "ponto_parada", de: null, para: c.ponto_parada },
    ...(c.plano ? [{ campo: "plano", de: null, para: c.plano }] : []),
    ...(c.dependentes != null ? [{ campo: "dependentes", de: null, para: String(c.dependentes) }] : []),
    ...(c.observacao ? [{ campo: "observacao", de: null, para: c.observacao }] : []),
    { campo: "retomar", de: null, para: criado.proxima_em },
  ];
  await gravarHistorico(ctx, criado.id, linhas);
  await registrarEvento(ctx, "ticket_criado");
  const lido = check(await db(ctx).from("retomadas").select(COLS_TICKET).eq("id", criado.id).single()) as Record<string, unknown>;
  return { acao: "criado", ticket: paraDTO(lido), mudancas: [], outroAtendente: outro };
}

// ---------------------------------------------------------------------------
// "O cliente disse…": usa a mesma função da página da Omnia (classificação + conteúdo aprovado)
// ---------------------------------------------------------------------------

const ehLimite = (m: string) => /^Você chegou ao limite/.test(m);

export async function clienteDisseExtensao(ctx: CtxExt, e: { fala: string; ponto?: string | null }): Promise<ClienteDisseResposta> {
  // 2ª camada de sanitização: o servidor nunca confia só no navegador.
  const fala = sanitizarTexto(e.fala).slice(0, 2000);
  if (!fala || /^\[mídia\]$/.test(fala)) throw new ErroExt(422, "A última fala do cliente não tem texto para analisar.", "sem_texto");

  let cls;
  try {
    cls = await classificarFalaCore(ctx, fala);
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (ehLimite(m)) throw new ErroExt(429, m, "limite");
    throw new ErroExt(502, "Não consegui analisar a fala agora. Tente de novo.", "ia");
  }

  const s = db(ctx);
  const objIds = cls.itens.filter((i) => i.tipo === "objecao").map((i) => i.id);
  const outrosIds = cls.itens.filter((i) => i.tipo !== "objecao").map((i) => i.id);
  const [objRows, itemRows] = await Promise.all([
    objIds.length ? s.from("objecoes").select("*").eq("status", "publicada").in("id", objIds) : Promise.resolve({ data: [] }),
    outrosIds.length ? s.from("fechamento_itens").select("*").eq("status", "publicada").in("id", outrosIds) : Promise.resolve({ data: [] }),
  ]);
  const objecoes = new Map(((objRows.data ?? []) as Record<string, unknown>[]).map((r) => { const o = toObjecao(r); return [o.id, o] as const; }));
  const fech = new Map(((itemRows.data ?? []) as Record<string, unknown>[]).map((r) => { const o = toFechamentoItem(r); return [o.id, o] as const; }));

  const itens = cls.itens.map((i) => ({ tipo: i.tipo, id: i.id, nome: i.tipo === "objecao" ? (objecoes.get(i.id)?.nome ?? "") : (fech.get(i.id)?.titulo ?? "") })).filter((i) => i.nome);

  let objecao: ClienteDisseResposta["objecao"] = null;
  const principal = objIds.map((id) => objecoes.get(id)).find(Boolean);
  if (principal) {
    objecao = { id: principal.id, nome: principal.nome, sugestao_ia: false, leituras: principal.leituras, angulos: principal.angulos.filter((a) => a.texto.trim()), pergunta_avancar: principal.pergunta_avancar, evite_dizer: principal.evite_dizer };
  } else if (cls.nova && !fech.size) {
    try {
      const sug = await sugerirRespostaCore(ctx, fala, cls.pendente_id);
      objecao = { id: null, nome: sug.nome || "Objeção nova", sugestao_ia: true, leituras: sug.leituras, angulos: sug.angulos.filter((a) => a.texto.trim()), pergunta_avancar: sug.pergunta_avancar, evite_dizer: sug.evite_dizer };
    } catch {
      objecao = null; // a classificação já valeu; sem sugestão agora
    }
  }
  const item = [...fech.values()][0];
  const item_mensagem = !objecao && item ? { titulo: item.titulo, mensagem: item.mensagem, passos: item.passos } : null;

  let casos: ClienteDisseResposta["casos"] = [];
  try {
    const c = await casosParecidos(ctx, { objecao_ids: objIds, ponto: (e.ponto as never) ?? null } as never);
    casos = c.fichas.map((f) => ({ titulo: f.titulo, mensagem_chave: f.mensagem_chave, por_que_funcionou: f.por_que_funcionou, dias_ate_fechar: f.dias_ate_fechar }));
  } catch {
    casos = []; // sem Biblioteca ainda: o painel só não mostra "Casos parecidos"
  }
  return { itens, objecao, item_mensagem, casos };
}

/** Cada "Copiar" conta como uso da objeção (igual à página da Omnia). */
export async function registrarCopia(ctx: CtxExt, e: { objecao_id: string; angulo?: string | null }) {
  const r = await db(ctx).from("cliente_disse_uso").insert({ objecao_id: e.objecao_id, angulo: e.angulo ?? null, user_id: ctx.userId });
  if (r?.error) console.error("[extensao] uso não registrado:", r.error.message);
  return { ok: true };
}

export { ClienteDisseEntrada, LerConversaEntrada, TicketEntrada };
