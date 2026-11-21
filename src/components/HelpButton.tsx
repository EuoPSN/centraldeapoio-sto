import { useNavigate } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTour } from "@/components/tour/TourProvider";

/**
 * Botão "?" do topo, em todas as páginas, à esquerda do sol/lua. Se a página
 * tem tutorial, abre o tour; senão, leva à Central de Ajuda.
 */
export function HelpButton() {
  const { tourDaRota, iniciar } = useTour();
  const navigate = useNavigate();
  const temTour = !!tourDaRota;
  const rotulo = temTour ? "Tutorial desta página" : "Esta página ainda não tem tutorial";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-tour="inicio-5"
          data-help-button
          aria-label={temTour ? "Tutorial desta página" : "Esta página ainda não tem tutorial. Abrir a Central de Ajuda"}
          onClick={() => (temTour ? iniciar() : navigate({ to: "/ajuda" }))}
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-line-strong text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-sm font-medium">?</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{rotulo}</TooltipContent>
    </Tooltip>
  );
}
