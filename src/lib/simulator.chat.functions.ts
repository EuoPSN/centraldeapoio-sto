import { createServerFn } from "@tanstack/react-start";
import { chamarIA, consumirUso, montarInstrucoes } from "@/lib/cerebro.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SIMULATOR_CLIENT_MODEL } from "@/lib/ai-models";

export const simulatorChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const data = d as {
      messages: Array<{
        role: "system" | "user" | "assistant";
        content: string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
      }>;
      model?: string;
      /** "simulador": é a avaliação do atendimento; junta as instruções do Cérebro e conta o uso. */
      ferramenta?: "simulador";
    };
    if (!data.messages || !Array.isArray(data.messages)) throw new Error("messages obrigatório");
    return data;
  })
  .handler(async ({ data, context }) => {
    let messages = data.messages;
    if (data.ferramenta === "simulador") {
      await consumirUso(context, "simulador");
      const cerebro = (await montarInstrucoes("simulador")).texto;
      const [primeira, ...resto] = messages;
      messages = primeira?.role === "system" && typeof primeira.content === "string"
        ? [{ ...primeira, content: `${cerebro}\n\n${primeira.content}` }, ...resto]
        : [{ role: "system" as const, content: cerebro }, ...messages];
    }
    const reply = await chamarIA({
      model: data.model ?? SIMULATOR_CLIENT_MODEL,
      messages,
      temperature: 0.7,
    });
    return { content: reply };
  });
