import { createFileRoute } from "@tanstack/react-router";
import { LerConversaEntrada } from "@/lib/extensao";
import { lerConversaExtensao, opcoes, tratar, ErroExt } from "@/lib/extensao.server";

// POST /api/extensao/ler-conversa — "Ler esta conversa" da extensão do Chrome.
// Recebe só o texto já sanitizado (+ direção e horário). Não grava a conversa.
export const Route = createFileRoute("/api/extensao/ler-conversa")({
  server: {
    handlers: {
      OPTIONS: async () => opcoes(),
      POST: async ({ request }) =>
        tratar(request, async (ctx, corpo) => {
          const r = LerConversaEntrada.safeParse(corpo);
          if (!r.success) throw new ErroExt(400, "Pedido inválido.");
          return lerConversaExtensao(ctx, r.data);
        }),
    },
  },
});
