import { createServerFn } from "@tanstack/react-start";
import { chatCompletion } from "@/lib/ai-gateway.server";
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
    };
    if (!data.messages || !Array.isArray(data.messages)) throw new Error("messages obrigatório");
    return data;
  })
  .handler(async ({ data }) => {
    const reply = await chatCompletion({
      model: data.model ?? SIMULATOR_CLIENT_MODEL,
      messages: data.messages,
      temperature: 0.7,
    });
    return { content: reply };
  });
