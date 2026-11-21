import { createFileRoute } from "@tanstack/react-router";
import { ClienteDisseEntrada } from "@/lib/extensao";
import { ErroExt, clienteDisseExtensao, opcoes, registrarCopia, tratar } from "@/lib/extensao.server";

// POST /api/extensao/cliente-disse
//  { op: "responder", fala, ponto? } → o que o cliente disse (objeção/sinal), respostas aprovadas e casos parecidos
//  { op: "copiou", objecao_id, angulo? } → registra o "Copiar"
// A extensão só copia o texto para a área de transferência: nunca escreve na caixa do WhatsApp nem envia.
export const Route = createFileRoute("/api/extensao/cliente-disse")({
  server: {
    handlers: {
      OPTIONS: async () => opcoes(),
      POST: async ({ request }) =>
        tratar(request, async (ctx, corpo) => {
          const r = ClienteDisseEntrada.safeParse(corpo);
          if (!r.success) throw new ErroExt(400, "Pedido inválido.");
          return r.data.op === "responder" ? clienteDisseExtensao(ctx, r.data) : registrarCopia(ctx, r.data);
        }),
    },
  },
});
