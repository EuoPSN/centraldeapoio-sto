import { createFileRoute, redirect } from "@tanstack/react-router";

// Problemas Técnicos virou uma aba da Central de Ajuda.
export const Route = createFileRoute("/_authenticated/problemas")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/ajuda/problemas", search: search as never });
  },
});
