import { createFileRoute, redirect } from "@tanstack/react-router";

// Tutoriais virou "Procedimentos do atendimento" dentro da Central de Ajuda.
export const Route = createFileRoute("/_authenticated/tutoriais")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/ajuda/procedimentos", search: search as never });
  },
});
