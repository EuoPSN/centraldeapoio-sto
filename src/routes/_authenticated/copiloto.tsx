import { createFileRoute } from "@tanstack/react-router";
import { CopilotoPage } from "@/components/copiloto/CopilotoPage";

export const Route = createFileRoute("/_authenticated/copiloto")({
  component: CopilotoPage,
});
