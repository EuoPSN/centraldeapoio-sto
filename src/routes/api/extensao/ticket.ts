import { createFileRoute } from "@tanstack/react-router";
import { TicketEntrada } from "@/lib/extensao";
import { ErroExt, consultarTicket, opcoes, salvarTicket, tratar } from "@/lib/extensao.server";

// POST /api/extensao/ticket
//  { op: "consultar", numero }                → ticket aberto do mesmo número (do próprio atendente) + histórico
//  { op: "salvar", numero, nome, campos }     → atualiza o ticket existente ou cria um novo
// As regras de acesso (RLS) valem: o atendente só enxerga e altera os próprios tickets.
export const Route = createFileRoute("/api/extensao/ticket")({
  server: {
    handlers: {
      OPTIONS: async () => opcoes(),
      POST: async ({ request }) =>
        tratar(request, async (ctx, corpo) => {
          const r = TicketEntrada.safeParse(corpo);
          if (!r.success) throw new ErroExt(400, "Pedido inválido.");
          return r.data.op === "consultar" ? consultarTicket(ctx, r.data.numero) : salvarTicket(ctx, r.data);
        }),
    },
  },
});
