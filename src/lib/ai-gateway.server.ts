// Lovable AI Gateway helper — server-only.
// Centraliza chamadas para chat completions e embeddings.

const GATEWAY_BASE = "https://ai.gateway.lovable.dev/v1";

function requireKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente. Configure-a em Cloud > Secrets.");
  return key;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRetryAfterMs(headers: Headers) {
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

async function readErrorMessage(res: Response) {
  const body = await res.text().catch(() => "");
  if (!body) return `HTTP ${res.status}`;
  try {
    const json = JSON.parse(body) as { message?: string; error?: { message?: string }; type?: string };
    return json.error?.message ?? json.message ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}

export class EmbeddingRateLimitError extends Error {
  retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = "EmbeddingRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export function isEmbeddingRateLimitError(error: unknown): error is EmbeddingRateLimitError {
  return error instanceof EmbeddingRateLimitError
    || (error instanceof Error && error.name === "EmbeddingRateLimitError");
}

export async function generateEmbeddings(
  texts: string[],
  opts: { maxAttempts?: number; initialDelayMs?: number; maxDelayMs?: number } = {},
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const key = requireKey();
  const maxAttempts = opts.maxAttempts ?? 4;
  const initialDelayMs = opts.initialDelayMs ?? 3000;
  const maxDelayMs = opts.maxDelayMs ?? 30000;
  let lastStatus = 0;
  let lastMessage = "";
  let lastRetryAfterMs: number | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${GATEWAY_BASE}/embeddings`, {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: texts,
        dimensions: 1536,
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ index?: number; embedding: number[] }> };
      const ordered = (json.data ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const embeddings = ordered.map((item) => item.embedding).filter(Boolean);
      if (embeddings.length !== texts.length) throw new Error("Resposta de embedding incompleta");
      return embeddings;
    }

    const message = await readErrorMessage(res);
    lastStatus = res.status;
    lastMessage = message;

    if (res.status === 429 || res.status >= 500) {
      lastRetryAfterMs = parseRetryAfterMs(res.headers);
      if (attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * 1000);
        const wait = Math.min(maxDelayMs, lastRetryAfterMs ?? initialDelayMs * Math.pow(2, attempt - 1)) + jitter;
        await sleep(wait);
        continue;
      }
      if (res.status === 429) {
        throw new EmbeddingRateLimitError(
          `Limite temporário da IA para embeddings atingido. Aguarde alguns minutos e continue a reindexação. ${message}`,
          lastRetryAfterMs,
        );
      }
      throw new Error(`Falha ao gerar embedding após ${maxAttempts} tentativas (${res.status}): ${message}`);
    }

    if (res.status === 402) throw new Error("Créditos da IA esgotados. Avise o administrador para recarregar.");
    throw new Error(`Falha ao gerar embedding (${res.status}): ${message}`);
  }

  if (lastStatus === 429) {
    throw new EmbeddingRateLimitError(
      `Limite temporário da IA para embeddings atingido. Aguarde alguns minutos e continue a reindexação. ${lastMessage}`,
      lastRetryAfterMs,
    );
  }
  throw new Error(`Falha ao gerar embedding após ${maxAttempts} tentativas (${lastStatus}): ${lastMessage}`);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  if (!embedding) throw new Error("Resposta de embedding sem vetor");
  return embedding;
}

