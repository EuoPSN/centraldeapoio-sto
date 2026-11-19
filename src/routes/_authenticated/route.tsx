import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ChangelogWidget } from "@/components/ChangelogWidget";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/content.functions";
import { touchLastSeen } from "@/lib/dashboard.functions";
import { Search } from "lucide-react";
import { OmniaLockup } from "@/components/OmniaLogo";
import { listNavItems } from "@/lib/settings.functions";
import { cn } from "@/lib/utils";
import { ThemeController, ThemeToggle } from "@/components/ThemeController";
import { useEffect } from "react";

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

// Abas principais da barra superior: as telas do atendimento em andamento.
// Só aparecem se o item correspondente estiver visível no menu (nav_items),
// então o Painel Admin continua mandando no que cada um vê.
const PRIMARY_TABS: { route: string; label: string }[] = [
  { route: "/scripts", label: "Mensagens" },
  { route: "/precos", label: "Preços" },
  { route: "/conhecimento", label: "Regras" },
  { route: "/contatos", label: "Unidades" },
  { route: "/treinamentos", label: "Treino" },
];

interface NavRow { route: string; visible: boolean; admin_only: boolean }

function openSearch() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true }));
}

function AppLayout() {
  const me = useServerFn(getMe);
  const touch = useServerFn(touchLastSeen);
  const navFn = useServerFn(listNavItems);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => me({}) });
  const navQ = useQuery({ queryKey: ["nav-items"], queryFn: () => navFn({}), staleTime: 60_000 });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = data?.isAdmin ?? false;

  useEffect(() => {
    touch({}).catch(() => {});
  }, [touch]);

  const visibleRoutes = new Set(
    ((navQ.data ?? []) as NavRow[]).filter((i) => i.visible && (!i.admin_only || isAdmin)).map((i) => i.route),
  );
  const tabs = PRIMARY_TABS.filter((t) => visibleRoutes.has(t.route));

  // Em meia tela (ao lado do WhatsApp Web) o menu lateral começa recolhido em ícones.
  const startOpen = typeof window !== "undefined" && window.innerWidth >= 1280;

  return (
    <ThemeController profilePreference={data ? ((data.profile as { theme_preference?: string | null } | null)?.theme_preference ?? null) : undefined}>
    <SidebarProvider defaultOpen={startOpen} className="flex-col">
      <header className="sticky top-0 z-40 h-(--topbar-h) bg-brand text-brand-foreground">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <SidebarTrigger
            aria-label="Abrir ou recolher o menu"
            className="h-9 w-9 shrink-0 text-brand-foreground hover:bg-white/12 hover:text-brand-foreground"
          />
          <Link to="/" aria-label="Início" className="flex shrink-0 items-center rounded-lg bg-white px-2 py-1">
            <OmniaLockup symbolSize={24} />
          </Link>
          <button
            type="button"
            onClick={openSearch}
            className="group flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] bg-white/14 px-3 text-left text-[13.5px] text-brand-muted transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Buscar especialidade, exame, mensagem…</span>
            <kbd className="hidden shrink-0 rounded-md border border-white/25 px-1.5 py-0.5 font-sans text-[11px] font-medium text-brand-foreground sm:inline-block">
              Ctrl K
            </kbd>
          </button>
          <ThemeToggle />
        </div>
        <nav aria-label="Telas principais" className="flex h-11 items-end gap-0.5 overflow-x-auto px-3 sm:px-4 [scrollbar-width:none]">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.route);
            return (
              <Link
                key={t.route}
                to={t.route}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-t-[10px] px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70",
                  active ? "bg-background text-primary" : "text-brand-muted hover:bg-white/10 hover:text-brand-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="flex min-h-0 w-full flex-1">
        <AppSidebar isAdmin={isAdmin} email={data?.email ?? ""} />

        <main key={pathname} className="min-w-0 flex-1 page-transition">
          <Outlet />
        </main>
      </div>

      <GlobalSearch />
      <ChangelogWidget />
    </SidebarProvider>
    </ThemeController>
  );
}
