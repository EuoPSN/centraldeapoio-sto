// Extensão do Chrome — só servidor: autenticação por token, "Ler conversa" (IA) e respostas HTTP.
// A extensão NUNCA chama a IA direto nem guarda chave: tudo passa por aqui, pelo Cérebro.

import { createClient } from "@supabase/supabase-js";
import { chamarIAJson, montarInstrucoes, registrarUso, statusUso } from "@/lib/cerebro.server";
import { EXTENSAO_MODEL } from "@/lib/ai-models";
import { ETAPAS_FUNIL, ETAPA_FUNIL_NOME, mensagemLimite } from "@/lib/cerebro";
import { PONTO_LISTA, PONTOS, QUANDO } from "@/lib/retomada";
import {
  ERRO_LER, LerConversaEntrada, tentarProposta, type LerConversaEntradaT, type Proposta,
} from "@/lib/extensao";
import { montarTranscricao, sanitizarMensagens } from "@/lib/extensao-sanitizar";

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

  const msgs = sanitizarMensagens(entrada.mensagens, { nome: entrada.nome });
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
      proposta = tentarProposta(raw, transcricao, entrada.nome);
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

export { LerConversaEntrada };
