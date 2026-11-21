// "Mensagens que vendem" — só servidor: pede à IA uma nova versão de uma mensagem da cadência.
// Passa pelo módulo central do Cérebro (ferramenta "retomada": regras fixas, padrão de escrita,
// etapas do funil e os demais blocos marcados para ela).

import { MENSAGEM_SUGESTAO_MODEL } from "@/lib/ai-models";
import { removerDadosPessoais } from "@/lib/cliente-disse";
import { PONTO_LABEL, VARIAVEIS_RETOMADA, ETAPA_LABEL, PAPEL_LABEL, type EtapaRetomada, type Papel, type PontoCadencia } from "@/lib/retomada";
import { conferirVariaveis } from "@/lib/mensagens-vendem";
import { z } from "zod";

type Ctx = { supabase: unknown; userId: string };

const RespostaSchema = z.object({
  texto_sugerido: z.string().trim().min(1).max(2000),
  por_que_mudar: z.string().trim().min(1).max(500),
});

const semPlanoDeSaude = (t: string) => /n[ãa]o [ée] plano de sa[úu]de/i.test(t);

export async function sugerirNovaVersao(
  ctx: Ctx,
  m: { texto: string; ponto: string; etapa: string; canal: string; papel: string; taxaResposta: number; mediaEtapa: number; envios: number },
): Promise<{ texto: string; por_que: string } | null> {
  const { montarInstrucoes, chamarIAJson, registrarUso } = await import("@/lib/cerebro.server");
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const vars = VARIAVEIS_RETOMADA.map((v) => `{${v}}`).join(" ");

  const tarefa = `Você reescreve UMA mensagem da cadência de retomada do Cartão de TODOS (WhatsApp) que está tendo menos respostas que a média das outras versões da mesma etapa.
Dados da mensagem:
- Ponto de parada do cliente: ${PONTO_LABEL[m.ponto as PontoCadencia] ?? m.ponto}
- Etapa: ${ETAPA_LABEL[m.etapa as EtapaRetomada] ?? m.etapa} · papel: ${PAPEL_LABEL[m.papel as Papel] ?? m.papel} · canal: ${m.canal === "audio" ? "áudio (o texto é o roteiro, até 30 segundos)" : "texto"}
- Desempenho: ${pct(m.taxaResposta)} responderam em ${m.envios} envios; a média da etapa é ${pct(m.mediaEtapa)}.
- Texto atual:
"""
${m.texto}
"""
Regras:
- Escreva uma versão NOVA que tente resolver o que o texto atual deixa fraco (ex.: só pergunta se a pessoa viu, não traz um motivo para responder, pede demais).
- Mantenha as variáveis do texto atual exatamente como estão e use só estas: ${vars}.
- No padrão de escrita acima, no máximo 4 linhas, UMA só pergunta, tom acolhedor de WhatsApp.
- Não invente preço, carência nem benefício. Nunca escreva nome, telefone, CPF nem e-mail de cliente.
- "por_que_mudar": 1 ou 2 frases dizendo o que a versão atual faz de fraco e o que a nova muda.
Responda APENAS com JSON: {"texto_sugerido":"...","por_que_mudar":"..."}`;

  const { texto: system } = await montarInstrucoes("retomada", tarefa);
  let correcao = "";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const raw = await chamarIAJson({
      model: MENSAGEM_SUGESTAO_MODEL,
      temperature: 0.5,
      messages: [{ role: "system", content: `${system}${correcao}` }, { role: "user", content: "Gere a nova versão." }],
    });
    const r = RespostaSchema.safeParse(raw);
    if (!r.success) { correcao = "\n\nSua resposta anterior não veio no formato JSON pedido."; continue; }
    const texto = r.data.texto_sugerido;
    const problema = conferirVariaveis(m.texto, texto)
      ?? (removerDadosPessoais(texto) !== texto ? "tem telefone, CPF ou e-mail" : null)
      ?? (semPlanoDeSaude(texto) || semPlanoDeSaude(r.data.por_que_mudar) ? "usou uma frase proibida" : null)
      ?? (texto.trim() === m.texto.trim() ? "ficou igual ao texto atual" : null);
    if (problema) { correcao = `\n\nSUA RESPOSTA ANTERIOR FOI REJEITADA (${problema}). Corrija.`; continue; }
    await registrarUso(ctx, "retomada");
    return { texto, por_que: r.data.por_que_mudar };
  }
  return null;
}
