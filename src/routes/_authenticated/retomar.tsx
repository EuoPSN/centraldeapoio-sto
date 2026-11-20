import { createFileRoute } from "@tanstack/react-router";
import { RetomadaPage } from "@/components/retomada/RetomadaPage";

export const Route = createFileRoute("/_authenticated/retomar")({
  component: RetomadaPage,
});
