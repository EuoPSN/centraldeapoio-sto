import { createFileRoute } from "@tanstack/react-router";
import { MeuMapaPage } from "@/components/aquecimento/MeuMapaPage";

export const Route = createFileRoute("/_authenticated/meu-mapa")({ component: MeuMapaPage });
