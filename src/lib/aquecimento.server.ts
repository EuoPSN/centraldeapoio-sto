// Aquecimento — só servidor: correção por IA das respostas escritas e rascunhos de exercícios.
// Passa pelo módulo central do Cérebro (ferramenta "aquecimento"): regras fixas, padrão de escrita,
// etapas do funil e os demais blocos marcados para ela.

import { AQUECIMENTO_MODEL } from "@/lib/ai-models";
import { removerDadosPessoais } from "@/lib/cliente-disse";
import { blocoVazio } from "@/lib/cerebro";
import {
  CorrecaoIASchema, RascunhoSchema, HABITO_CHAVES, HABITOS, semPlanoDeSaude, validarExercicio, TIPO_LABEL,
  type Rascunho, type TipoExercicio,
} from "@/lib/aquecimento";
import { z } from "zod";

/** Nota (0 a 10) e uma frase do que melhorar, comparando com a resposta aprovada.
 * Tira telefone, CPF e e-mail do texto antes de mandar para a IA. Devolve null se a IA falhar. */
export async function corrigirComIA(input: {
  fala_cliente: string;
  resposta_aprovada: string;
  criterio: string;
  texto: string;
}): Promise<{ nota: number; frase: string } | null> {
  const { montarInstrucoes, chamarIAJson } = await import("@/lib/cerebro.server");
  const limpo = removerDadosPessoais(input.texto).slice(0, 1200);
  const tarefa = `Você corrige, num treino de 5 minutos, a resposta de um atendente do Cartão de TODOS a um cliente no WhatsApp.
${input.fala_cliente ? `Fala do cliente: "${input.fala_cliente}"` : ""}
${input.resposta_aprovada ? `Resposta aprovada pelo Paulo (referência):\n"""\n${input.resposta_aprovada}\n"""` : ""}
${input.criterio ? `O que avaliar: ${input.criterio}` : ""}
Regras:
- Compare o CAMINHO da resposta do atendente com o da aprovada: não precisa ser igual, precisa acolher, responder à objeção e levar a conversa adiante com uma só pergunta.
- "nota" é um inteiro de 0 a 10. "frase" diz em 1 ou 2 frases, em português do Brasil e tom acolhedor, o que foi bem e o que melhorar.
- Use só o que está nas instruções acima. Nunca invente preço, carência, regra ou benefício. Nunca repita telefone, CPF ou e-mail.
Responda APENAS com JSON: {"nota":0,"frase":"..."}`;
  const { texto: system } = await montarInstrucoes("aquecimento", tarefa);
  try {
    const raw = await chamarIAJson({
      model: AQUECIMENTO_MODEL,
      temperature: 0.2,
      messages: [{ role: "system", content: system }, { role: "user", content: `Resposta do atendente:\n"""\n${limpo}\n"""` }],
    });
    const r = CorrecaoIASchema.safeParse(raw);
    if (!r.success) return null;
    return { nota: r.data.nota, frase: semPlanoDeSaude(removerDadosPessoais(r.data.frase)) };
  } catch (err) {
    console.error("Correção do aquecimento falhou:", err);
    return null;
  }
}

const LoteSchema = z.object({ exercicios: z.array(z.unknown()).min(1) });

/** Rascunhos de exercícios para um tema, só com fatos do Cérebro e da base de conhecimento.
 * Sem fato disponível, devolve lista vazia (não inventa). */
export async function gerarRascunhosComIA(input: {
  tema: { id: string; nome: string; descricao: string };
  tipo: TipoExercicio;
  quantidade: number;
  objecoes: { id: string; nome: string }[];
}): Promise<{ rascunhos: (Rascunho & { objecao_id: string | null })[]; semFatos: boolean }> {
  const { montarInstrucoes, chamarIAJson } = await import("@/lib/cerebro.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const a = supabaseAdmin as any;

  // Base de conhecimento: entradas cujo texto cita o tema.
  const { data: kb } = await a.from("knowledge_entries").select("title, content, kind").limit(200);
  const chave = input.tema.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fatos = ((kb ?? []) as { title: string; content: string; kind: string }[])
    .filter((k) => `${k.title} ${k.content}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(chave))
    .slice(0, 12)
    .map((k) => `- ${k.title}: ${String(k.content).slice(0, 700)}`);
  const baseKb = fatos.length ? `BASE DE CONHECIMENTO SOBRE ${input.tema.nome.toUpperCase()}:\n${fatos.join("\n")}` : "";

  const contexto = input.tema.nome === "Planos" ? ["mensalidades" as const] : input.tema.nome === "Amor Saúde" ? ["amor_saude" as const] : input.tema.nome === "Objeções" ? ["objecoes" as const] : [];
  const { texto: system } = await montarInstrucoes("aquecimento", `${baseKb}\n\n${tarefaDeGeracao(input)}`, { contexto });
  // Sem base de conhecimento, sem dados da Omnia e sem bloco do Cérebro preenchido para esta
  // ferramenta, a IA não tem fato nenhum: não gera.
  const { data: blocos } = await a.from("cerebro_blocos").select("conteudo, gerado, ferramentas").eq("ativo", true);
  const blocoComFato = ((blocos ?? []) as { conteudo: string; gerado: boolean; ferramentas: string[] }[])
    .some((b) => !b.gerado && b.ferramentas.includes("aquecimento") && !blocoVazio(b.conteudo));
  const temFato = !!baseKb || contexto.length > 0 || blocoComFato;
  if (!temFato) return { rascunhos: [], semFatos: true };

  const raw = await chamarIAJson({
    model: AQUECIMENTO_MODEL,
    temperature: 0.5,
    messages: [{ role: "system", content: system }, { role: "user", content: `Gere ${input.quantidade} exercício(s).` }],
  });
  const lote = LoteSchema.safeParse(raw);
  const itens = lote.success ? lote.data.exercicios : [];
  const ok: (Rascunho & { objecao_id: string | null })[] = [];
  for (const it of itens) {
    const r = RascunhoSchema.safeParse(it);
    if (!r.success) continue;
    const e = r.data;
    const limpar = (t: string) => semPlanoDeSaude(removerDadosPessoais(t));
    const rasc = {
      ...e,
      titulo: limpar(e.titulo), pergunta: limpar(e.pergunta), contexto: limpar(e.contexto),
      resposta_aprovada: limpar(e.resposta_aprovada), explicacao: limpar(e.explicacao),
      alternativas: e.alternativas.map((x) => ({ ...x, texto: limpar(x.texto) })),
      habito_chave: input.tipo === "habito" ? (HABITO_CHAVES.includes(e.habito_chave as never) ? e.habito_chave! : null) : null,
    };
    if (validarExercicio({ tipo: input.tipo, ...rasc, habito_chave: rasc.habito_chave })) continue;
    const obj = input.tipo === "escrita" ? input.objecoes.find((o) => o.nome.toLowerCase() === rasc.titulo.toLowerCase())?.id ?? null : null;
    ok.push({ ...rasc, objecao_id: obj });
    if (ok.length >= input.quantidade) break;
  }
  return { rascunhos: ok, semFatos: false };
}

function tarefaDeGeracao(i: { tema: { nome: string; descricao: string }; tipo: TipoExercicio; quantidade: number; objecoes: { id: string; nome: string }[] }): string {
  const formato: Record<TipoExercicio, string> = {
    multipla_escolha: `Múltipla escolha: "pergunta" (uma situação real de atendimento), "alternativas" com 3 itens {"texto","correta"} e EXATAMENTE 1 correta, "explicacao" (por que a certa é a certa).`,
    escrita: `Escrita: "contexto" é a fala do cliente (uma objeção real, ex.: "Vou pensar e depois te falo."), "pergunta" a instrução ("Como você responderia?"), "resposta_aprovada" a resposta modelo (até 4 linhas, uma só pergunta, tom acolhedor de WhatsApp, [nome] no lugar do nome do cliente), "titulo" o nome da objeção, "explicacao" o que a boa resposta faz.${i.objecoes.length ? ` Objeções publicadas: ${i.objecoes.map((o) => o.nome).join("; ")}.` : ""}`,
    habito: `Hábito de escrita: "pergunta" pede para reescrever uma mensagem ruim que você escreve em "contexto" (com o erro do hábito), "habito_chave" é UM destes: ${HABITO_CHAVES.map((c) => `${c} (${HABITOS[c].titulo})`).join("; ")}, "resposta_aprovada" a versão certa, "explicacao" a regra.`,
  };
  return `Você prepara RASCUNHOS de exercícios do aquecimento diário dos atendentes do Cartão de TODOS. O Paulo vai revisar cada um antes de chegar à equipe.
Tema: ${i.tema.nome} (${i.tema.descricao}). Tipo: ${TIPO_LABEL[i.tipo]}. Quantidade: ${i.quantidade}.
${formato[i.tipo]}
Regras:
- Use SOMENTE fatos que estão nas instruções acima (Cérebro, base de conhecimento, mensalidades, objeções). Se não houver fato para um exercício, não o inclua. Nunca invente valor, carência, regra de produto ou benefício.
- Pagamento só no cartão de crédito ou débito. A equipe só atende por mensagem. Nunca escreva a frase que compara o cartão a plano de saúde.
- "fonte": de onde veio o fato (ex.: "Cérebro · Playbook de vendas CDT" ou o título da base de conhecimento).
- Nenhum nome, telefone, CPF ou e-mail de cliente.
- Português do Brasil.
Responda APENAS com JSON: {"exercicios":[{"titulo":"...","pergunta":"...","contexto":"","alternativas":[{"texto":"...","correta":true}],"resposta_aprovada":"","habito_chave":null,"explicacao":"...","fonte":"..."}]}`;
}
