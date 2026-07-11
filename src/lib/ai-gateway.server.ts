// Lovable AI Gateway helper — server-only.
// Centraliza chamadas para chat completions e embeddings.

const GATEWAY_BASE = "https://ai.gateway.lovable.dev/v1";

function requireKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente. Configure-a em Cloud > Secrets.");
  return key;
}

export interface ChatContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
}


export async function chatCompletion(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<string> {
  const key = requireKey();
  const res = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em alguns instantes.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Avise o administrador para recarregar.");
    throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const key = requireKey();
  const res = await fetch(`${GATEWAY_BASE}/embeddings`, {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
      dimensions: 1536,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao gerar embedding (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  const emb = json.data?.[0]?.embedding;
  if (!emb) throw new Error("Resposta de embedding sem vetor");
  return emb;
}
