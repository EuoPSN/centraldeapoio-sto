import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/content.functions";
import { touchLastSeen } from "@/lib/dashboard.functions";
import { ThemeController, ThemeToggle } from "@/components/ThemeController";
import { HelpButton } from "@/components/HelpButton";
import { EditPageLink } from "@/components/EditPageLink";
import { AvisosFollowUp } from "@/components/retomada/Avisos";
import { AvisosAquecimento } from "@/components/aquecimento/Avisos";
import { AvisosMudancas } from "@/components/novidades/Avisos";
import { useEffect, type CSSProperties } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Bloqueia de verdade quem ainda não foi aprovado por um admin (ou foi bloqueado depois).
    const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
    if (profile && profile.is_active === false) {
      throw redirect({ to: "/pendente" });
    }

    return { user: data.user };
  },
  component: AppLayout,
});

// Lembra se o menu ficou aberto ou recolhido (o SidebarProvider grava o cookie).
function readSidebarCookie(): boolean | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )sidebar_state=(true|false)/);
  return m ? m[1] === "true" : null;
}

function AppLayout() {
  const me = useServerFn(getMe);
  const touch = useServerFn(touchLastSeen);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => me({}) });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = data?.isAdmin ?? false;
  const profile = (data?.profile ?? null) as { display_name?: string | null; cargo?: string | null; theme_preference?: string | null } | null;

  useEffect(() => {
    touch({}).catch(() => {});
  }, [touch]);

  // Sem escolha salva: menu aberto em tela larga, recolhido em meia tela.
  const startOpen = readSidebarCookie() ?? (typeof window !== "undefined" && window.innerWidth >= 1280);

  return (
    <ThemeController profilePreference={data ? (profile?.theme_preference ?? null) : undefined}>
      <SidebarProvider
        defaultOpen={startOpen}
        style={{ "--sidebar-width": "16.5rem", "--sidebar-width-icon": "5.5rem" } as CSSProperties}
      >
        <AppSidebar
          isAdmin={isAdmin}
          email={data?.email ?? ""}
          displayName={profile?.display_name ?? ""}
          role={isAdmin ? "Admin" : profile?.cargo || "Atendente"}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-(--topbar-h) items-center justify-between gap-3 border-b border-line bg-background px-3 sm:px-5">
            <SidebarTrigger
              aria-label="Abrir ou recolher o menu"
              className="h-9 w-9 text-ink-muted hover:bg-accent hover:text-ink [&_svg]:stroke-[1.5]"
            />
            {/* Trilha de navegação: as páginas que têm uma preenchem este espaço (TopbarBreadcrumb). */}
            <nav id="topbar-breadcrumb" aria-label="Você está em" className="flex min-w-0 flex-1 items-center" />
            <div className="flex shrink-0 items-center gap-2.5">
              <EditPageLink isAdmin={isAdmin} />
              <HelpButton />
              <ThemeToggle />
            </div>
          </header>

          <main key={pathname} className="min-w-0 flex-1 page-transition">
            <Outlet />
          </main>
        </div>

        <GlobalSearch />
        <AvisosFollowUp />
        <AvisosAquecimento />
        <AvisosMudancas />
      </SidebarProvider>
    </ThemeController>
  );
}
