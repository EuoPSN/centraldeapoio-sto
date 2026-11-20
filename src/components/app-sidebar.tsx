import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown, ChevronUp, GraduationCap, Headset, Home, LayoutGrid, LifeBuoy, LogOut,
  PenLine, Search, Settings,
} from "lucide-react";
import { MarcianaEyeIcon } from "@/components/marciana/MarcianaEye";
import { useAdminPendingCounts } from "@/components/admin/AdminShell";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OmniaLockup, OmniaSymbol } from "@/components/OmniaLogo";
import { supabase } from "@/integrations/supabase/client";
import { listNavItems } from "@/lib/settings.functions";
import { getAjudaNovidadesStatus } from "@/lib/ajuda.functions";
import { useRetomadaContagem } from "@/components/retomada/hooks";
import { cn } from "@/lib/utils";

// Menu lateral da OMNIA Apoio, em sanfona.
// Os itens continuam vindo da tabela nav_items (visível / só admin); aqui só
// definimos o agrupamento, a ordem e o nome de cada página dentro do grupo.

interface NavRow {
  id: string; label: string; icon: string; route: string;
  section: string; position: number; visible: boolean; admin_only: boolean;
}

interface PageDef { route: string; label: string; aliases?: string[] }
interface GroupDef { key: string; label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }>; adminOnly?: boolean; pages: PageDef[] }

const GROUPS: GroupDef[] = [
  {
    key: "atendimento", label: "Atendimento", icon: Headset,
    pages: [
      { route: "/scripts", label: "Scripts" },
      { route: "/retomar", label: "Retomar hoje" },
      { route: "/amor-saude", label: "Amor Saúde", aliases: ["/precos"] },
      { route: "/contatos", label: "Contatos e Endereços" },
      { route: "/biblioteca", label: "Biblioteca", aliases: ["/imagens"] },
    ],
  },
  { key: "inteligencia", label: "Inteligência", icon: MarcianaEyeIcon, pages: [
    { route: "/assistente", label: "MarcIAna" },
    { route: "/copiloto", label: "Copiloto" },
    { route: "/raiox", label: "Raio-X" },
  ] },
  {
    key: "treino", label: "Treino e evolução", icon: GraduationCap,
    pages: [
      { route: "/simulador-ia", label: "Simulador IA" },
      { route: "/treinamentos", label: "Treinamentos" },
      { route: "/checklist", label: "Check-list" },
      { route: "/ranking", label: "Ranking" },
    ],
  },
  { key: "contribuir", label: "Contribuir", icon: PenLine, pages: [{ route: "/criar-script", label: "Criar Scripts" }] },
  {
    key: "admin", label: "Administração", icon: Settings, adminOnly: true,
    pages: [
      { route: "/admin", label: "Painel Admin" },
      { route: "/conhecimento", label: "Conhecimento" },
    ],
  },
];

// Central de Ajuda: link fixo no rodapé do menu.
const HELP_ROUTES = ["/ajuda", "/problemas", "/tutoriais", "/sugestoes"];

interface GroupView { key: string; label: string; icon: GroupDef["icon"]; pages: { route: string; label: string }[] }

function useNavGroups(isAdmin: boolean, rows: NavRow[] | undefined) {
  return useMemo<GroupView[]>(() => {
    const byRoute = new Map((rows ?? []).map((r) => [r.route, r]));
    const allowed = (r: NavRow) => r.visible && (!r.admin_only || isAdmin);
    const used = new Set<string>(["/", ...HELP_ROUTES]);

    const groups: GroupView[] = GROUPS.filter((g) => !g.adminOnly || isAdmin).map((g) => {
      const pages = g.pages.flatMap((p) => {
        const routes = [p.route, ...(p.aliases ?? [])];
        routes.forEach((r) => used.add(r));
        const row = routes.map((r) => byRoute.get(r)).find(Boolean);
        // Sem linha em nav_items: aparece com o nome padrão. Com linha: respeita visível/só admin.
        if (row && !allowed(row)) return [];
        return [{ route: p.route, label: p.label }];
      });
      return { key: g.key, label: g.label, icon: g.icon, pages };
    });

    // Itens do menu que não estão no agrupamento não somem: vão para Administração
    // (os só-admin) ou para "Mais".
    const leftovers = (rows ?? [])
      .filter((r) => allowed(r) && !used.has(r.route))
      .sort((a, b) => a.position - b.position);
    const adminLeft = leftovers.filter((r) => r.admin_only).map((r) => ({ route: r.route, label: r.label }));
    const otherLeft = leftovers.filter((r) => !r.admin_only).map((r) => ({ route: r.route, label: r.label }));
    const admin = groups.find((g) => g.key === "admin");
    if (admin) admin.pages.push(...adminLeft);
    if (otherLeft.length) groups.push({ key: "mais", label: "Mais", icon: LayoutGrid, pages: otherLeft });

    return groups.filter((g) => g.pages.length > 0);
  }, [rows, isAdmin]);
}

function openSearch() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true }));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const ICON = { strokeWidth: 1.5 } as const;

export function AppSidebar({ isAdmin, email, displayName, role }: { isAdmin: boolean; email: string; displayName: string; role: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fn = useServerFn(listNavItems);
  const q = useQuery({ queryKey: ["nav-items"], queryFn: () => fn({}), staleTime: 60_000 });
  const groups = useNavGroups(isAdmin, q.data as NavRow[] | undefined);
  const novidadesFn = useServerFn(getAjudaNovidadesStatus);
  const novidadesQ = useQuery({ queryKey: ["ajuda", "novidades-status"], queryFn: () => novidadesFn({}), staleTime: 60_000 });
  const hasNovidades = (novidadesQ.data?.unseenCount ?? 0) > 0;
  const { data: adminPending } = useAdminPendingCounts(isAdmin);
  const adminPendingTotal = isAdmin ? adminPending?.total ?? 0 : 0;
  const retomadaHoje = useRetomadaContagem().data?.total ?? 0;
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  const isActive = (route: string) => (route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(route + "/"));
  const currentGroup = groups.find((g) => g.pages.some((p) => isActive(p.route)))?.key ?? null;

  // Sanfona: um grupo aberto por vez; o da página atual abre sozinho.
  const [openGroup, setOpenGroup] = useState<string | null>(currentGroup);
  useEffect(() => { if (currentGroup) setOpenGroup(currentGroup); }, [currentGroup]);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const name = displayName || email.split("@")[0] || "";
  const helpActive = HELP_ROUTES.some((r) => isActive(r));

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "border-r border-sidebar-border",
        // Recolhido: barra flutuante, arredondada, afastada 12px das bordas.
        "group-data-[collapsible=icon]:inset-y-3 group-data-[collapsible=icon]:left-3 group-data-[collapsible=icon]:h-auto",
        "group-data-[collapsible=icon]:w-16 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:border",
      )}
    >
      <SidebarHeader className={cn("gap-4 px-3.5 pt-5", collapsed && "items-center px-0 pt-4")}>
        <Link to="/" aria-label="OMNIA Apoio, Início" className="rounded-md px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {collapsed ? <OmniaSymbol size={32} /> : <OmniaLockup />}
        </Link>
        {collapsed ? (
          <RailButton label="Buscar (Ctrl K)" onClick={openSearch}><Search className="h-[18px] w-[18px]" {...ICON} /></RailButton>
        ) : (
          <button
            type="button"
            onClick={openSearch}
            className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-left text-[13px] text-ink-muted transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex-1">Buscar…</span>
            <kbd className="rounded border border-line px-1.5 py-px font-sans text-[10.5px] leading-4">Ctrl K</kbd>
          </button>
        )}
      </SidebarHeader>

      <SidebarContent className={cn("gap-0 px-3.5 pb-3 pt-3", collapsed && "items-center px-0")}>
        {collapsed ? (
          <nav aria-label="Menu" className="flex flex-col items-center gap-1.5">
            <RailButton label="Início" to="/" active={isActive("/")}><Home className="h-[18px] w-[18px]" {...ICON} /></RailButton>
            {groups.map((g) => {
              const active = g.key === currentGroup;
              return (
                <DropdownMenu key={g.key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger
                        aria-label={g.label}
                        className={cn(railClass, active && "text-gold")}
                      >
                        <g.icon className="h-[18px] w-[18px]" {...ICON} />
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">{g.label}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent side="right" align="start" sideOffset={10} className="min-w-48">
                    <DropdownMenuLabel className="type-overline text-xs text-ink-muted">{g.label}</DropdownMenuLabel>
                    {g.pages.map((p) => (
                      <DropdownMenuItem key={p.route} asChild>
                        <Link to={p.route} className={cn(isActive(p.route) && "font-semibold text-gold-text")}>{p.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </nav>
        ) : (
          <nav aria-label="Menu" className="flex flex-col">
            <Link
              to="/"
              aria-current={isActive("/") ? "page" : undefined}
              className={cn(
                "mb-3 flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[15px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive("/") ? "bg-sidebar-accent text-ink" : "text-ink hover:bg-sidebar-accent/70",
              )}
            >
              <Home className={cn("h-[18px] w-[18px]", isActive("/") ? "text-gold" : "text-ink-muted")} {...ICON} />
              Início
            </Link>

            {groups.map((g) => {
              const open = openGroup === g.key;
              const panelId = `menu-grupo-${g.key}`;
              return (
                <div key={g.key} className="mb-1">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenGroup(open ? null : g.key)}
                    className="flex h-8 w-full items-center justify-between rounded-md px-2.5 text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn("type-overline", open && "text-ink")}>{g.label}</span>
                    {open ? <ChevronUp className="h-3.5 w-3.5" {...ICON} /> : <ChevronDown className="h-3.5 w-3.5" {...ICON} />}
                  </button>
                  {open && (
                    <ul id={panelId} className="relative mb-2 ml-[18px] mt-1 border-l border-line">
                      {g.pages.map((p, i) => {
                        const active = isActive(p.route);
                        const showAdminPending = p.route === "/admin" && adminPendingTotal > 0;
                        const showRetomada = p.route === "/retomar" && retomadaHoje > 0;
                        return (
                          <li key={p.route} className="omnia-menu-item relative" style={{ animationDelay: `${i * 30}ms` }}>
                            {active && <span aria-hidden className="absolute -left-[3.5px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-gold" />}
                            <Link
                              to={p.route}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex items-center justify-between gap-2 rounded-md py-1.5 pl-4 pr-2 text-[14.5px] leading-6 transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active ? "font-semibold text-gold-text" : "text-ink hover:text-gold-text",
                              )}
                            >
                              <span className="truncate">{p.label}</span>
                              {showRetomada && (
                                <span aria-label={`${retomadaHoje} retomadas hoje`} className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-on-gold">
                                  {retomadaHoje}
                                </span>
                              )}
                              {showAdminPending && (
                                <span aria-label={`${adminPendingTotal} pendências`} className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-on-gold">
                                  {adminPendingTotal}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
            {q.isLoading && <p className="px-2.5 py-2 text-xs text-ink-muted">Carregando menu…</p>}
          </nav>
        )}
      </SidebarContent>

      <SidebarFooter className={cn("mx-3.5 gap-1 border-t border-line px-0 pb-4 pt-3", collapsed && "mx-2 items-center")}>
        {collapsed ? (
          <>
            <HelpMenu collapsed active={helpActive} hasNovidades={hasNovidades} />
            <RailButton label={`${name} · Sair`} onClick={handleSignOut}><LogOut className="h-[18px] w-[18px]" {...ICON} /></RailButton>
          </>
        ) : (
          <>
            <HelpMenu active={helpActive} hasNovidades={hasNovidades} />
            <div className="mt-1 flex items-center gap-2.5 px-1.5">
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[11px] font-semibold text-ink">
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium text-ink" title={email}>{name}</span>
                <span className="block truncate text-xs text-ink-muted">{role}</span>
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    aria-label="Sair"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-sidebar-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <LogOut className="h-4 w-4" {...ICON} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Sair</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

const railClass =
  "grid h-10 w-10 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-sidebar-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-sidebar-accent";

function RailButton({ label, to, active, onClick, children }: { label: string; to?: string; active?: boolean; onClick?: () => void; children: ReactNode }) {
  const cls = cn(railClass, active && "bg-sidebar-accent text-gold");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {to ? (
          <Link to={to} aria-label={label} aria-current={active ? "page" : undefined} className={cls}>{children}</Link>
        ) : (
          <button type="button" aria-label={label} onClick={onClick} className={cls}>{children}</button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

// Central de Ajuda: link fixo no rodapé do menu. O ponto dourado acompanha o
// selo "N novas" do card de Novidades (há item do changelog ainda não visto).
function HelpMenu({ active, hasNovidades, collapsed = false }: { active: boolean; hasNovidades: boolean; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link to="/ajuda" aria-label="Central de Ajuda" className={cn(railClass, "relative", active && "text-gold")}>
            <LifeBuoy className="h-[18px] w-[18px]" {...ICON} />
            {hasNovidades && <span aria-hidden className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-gold" />}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">Central de Ajuda</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Link
      to="/ajuda"
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-sidebar-accent text-ink" : "text-ink hover:bg-sidebar-accent/70",
      )}
    >
      <LifeBuoy className={cn("h-[18px] w-[18px]", active ? "text-gold" : "text-ink-muted")} {...ICON} />
      <span className="flex-1">Central de Ajuda</span>
      {hasNovidades && <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-gold" />}
    </Link>
  );
}
