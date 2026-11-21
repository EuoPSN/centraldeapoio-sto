import { createFileRoute } from "@tanstack/react-router";
import { TopbarBreadcrumb } from "@/components/scripts/shared";
import { OutlineButton } from "@/components/scripts/shared";
import { useTour } from "@/components/tour/TourProvider";
import { TOURS, type SituacaoTour } from "@/lib/tours";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ajuda/tutoriais-paginas")({
  component: Page,
});

const ROTULO: Record<SituacaoTour, string> = { visto: "Visto", novo: "Novo", nao_visto: "Não visto" };

function Page() {
  const { situacao, iniciarAposNavegar, carregando } = useTour();

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6 lg:py-7">
      <TopbarBreadcrumb items={[{ label: "Central de Ajuda", to: "/ajuda" }, { label: "Tutoriais das páginas" }]} />
      <h1 className="text-2xl font-medium text-ink">Tutoriais das páginas</h1>

      <section aria-label="Rever tutoriais" className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[17px] font-semibold leading-6 text-ink">Rever tutoriais</h2>
          <p className="text-[13.5px] leading-5 text-ink-muted">
            Cada página tem um passo a passo curto. Clique para abrir; ele roda na própria página.
          </p>
        </header>

        {carregando ? (
          <p role="status" className="px-5 py-6 text-[13.5px] text-ink-muted">Carregando…</p>
        ) : (
          <ul className="divide-y divide-line">
            {TOURS.map((t) => {
              const s = situacao(t.id);
              const destaque = s !== "visto";
              return (
                <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="min-w-0 flex-1 text-[15px] text-ink">{t.titulo}</span>
                  <span className={cn("w-20 shrink-0 text-[13px]", destaque ? "font-semibold text-gold-text" : "text-ink-muted")}>
                    {ROTULO[s]}
                  </span>
                  <OutlineButton className="h-9 w-[110px] px-3 text-[14px]" onClick={() => iniciarAposNavegar(t.id)}>
                    {destaque ? "Ver agora" : "Rever"}
                  </OutlineButton>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-3 text-[13.5px] text-ink-muted">
        Também dá para abrir o tutorial da página em que você está pelo botão “?” no topo.
      </p>
    </div>
  );
}
