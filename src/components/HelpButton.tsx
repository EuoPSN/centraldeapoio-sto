import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Botão "?" do topo, em todas as páginas, à esquerda do sol/lua. Por enquanto
 * só mostra o tooltip "Em breve: tutorial desta página" e não faz nada ao
 * clicar. Pronto para receber, no futuro, um destino por rota (ex.: mapa
 * rota → conteúdo da Central de Ajuda), sem implementar o conteúdo agora.
 */
export function HelpButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Ajuda desta página"
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-line-strong text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-sm font-medium">?</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Em breve: tutorial desta página</TooltipContent>
    </Tooltip>
  );
}
