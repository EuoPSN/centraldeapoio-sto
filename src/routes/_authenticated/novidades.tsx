import { createFileRoute } from "@tanstack/react-router";
import { NovidadesPage } from "@/components/novidades/NovidadesPage";

export const Route = createFileRoute("/_authenticated/novidades")({
  component: NovidadesPage,
});
