import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateEmbedding, chatCompletion } from "@/lib/ai-gateway.server";
import { fetchLexicalMatches, combineRagMatches, type RagMatch } from "@/lib/chat.functions";
import { z } from "zod";

// Gera sugestões de script consultando a Base de Conhecimento de verdade (a mesma
// busca híbrida — textual + semântica — que a MarcIAna usa), em vez de só usar a
// descrição isolada. Assim, qualquer conteúdo indexado (scripts, artigos, tutoriais,
// inclusive técnicas de venda como SPIN Selling que o admin cadastrar em
// Admin → Conteúdo e reindexar) entra como referência real na geração.
export const generateScriptFromKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ descricao: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let vectorMatches: RagMatch[] = [];
    try {
      const queryEmb = await generateEmbedding(data.descricao);
      const { data: matches } = await supabaseAdmin.rpc("match_knowledge", {
        query_embedding: queryEmb as unknown as string,
        match_count: 8,
      });
      if (matches) vectorMatches = (matches as RagMatch[]).filter((m) => (m.similarity ?? 0) >= 0.2);
    } catch (e) {
      console.error("Busca semântica falhou na geração de scripts; seguindo só com busca textual:", e);
    }
    const lexicalMatches = await fetchLexicalMatches(supabaseAdmin as any, data.descricao);
    const relevant = combineRagMatches(vectorMatches, lexicalMatches);

    const ragContext = relevant.length > 0
      ? relevant.map((m, i) => `[Fonte ${i + 1} — ${m.title}]\n${m.content}`).join("\n\n")
      : "";

    const prompt = `Você escreve mensagens de script de atendimento ao cliente via WhatsApp, para o Cartão de Todos (cartão de descontos em saúde).

${ragContext ? `Use como referência REAL o conteúdo abaixo, retirado da Base de Conhecimento (pode incluir informações do produto e também técnicas de venda cadastradas pelo admin, como SPIN Selling). Trate isso como MATÉRIA-PRIMA E CONTEXTO FACTUAL, não como um molde pra copiar — aplique as técnicas e informações de forma natural no texto, sem citar "fonte" ou nomear a técnica explicitamente na mensagem:\n\n${ragContext}\n\nREGRA CRÍTICA: se o pedido é pra adaptar/refazer algo pra um novo produto, pacote, situação ou público, o resultado tem que ser conteúdo GENUINAMENTE NOVO e ESPECÍFICO sobre esse assunto, não uma cópia da referência só trocando o título.\n\n` : ""}O texto do usuário abaixo é uma descrição livre do que ele precisa. Crie um ou mais scripts de mensagem prontos pra copiar e enviar ao cliente, cobrindo a sequência que fizer sentido pro pedido.
Cada item deve ter:
- "title": título curto (poucas palavras) pra identificar o script.
- "content": o texto da mensagem em si, pronto pra uso real (pode usar *negrito* estilo WhatsApp).
- "shortcut": uma palavra curta, minúscula, sem espaço ou acento, pra usar como atalho tipo /palavra no simulador.
- "internal_note": uma frase curta dizendo quando usar essa mensagem.
Responda APENAS com um array JSON, no formato exato: [{"title":"...","content":"...","shortcut":"...","internal_note":"..."}]. Sem markdown, sem texto fora do JSON.`;

    const reply = await chatCompletion({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: prompt }, { role: "user", content: data.descricao }],
      temperature: 0.5,
    });

    return { content: reply, usedKnowledge: relevant.length > 0, sourcesCount: relevant.length };
  });
