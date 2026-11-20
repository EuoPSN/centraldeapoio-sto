import { createFileRoute, redirect } from "@tanstack/react-router";

// Sugestões virou uma aba da Central de Ajuda.
export const Route = createFileRoute("/_authenticated/sugestoes")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/ajuda/sugestoes", search: search as never });
  },
});
