import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNavItems } from "@/lib/settings.functions";
import { getIcon } from "@/lib/icon-map";

// Item ativo em verde CDT sólido (contrato do redesign).
const ACTIVE_ITEM =
  "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary data-[active=true]:hover:text-primary-foreground";

const SECTION_LABEL: Record<string, string> = {
  main: "Central",
  ai: "Inteligência",
  admin: "Administração",
};

interface NavRow {
  id: string; label: string; icon: string; route: string;
  section: string; position: number; visible: boolean; admin_only: boolean;
}

export function AppSidebar({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fn = useServerFn(listNavItems);
  const q = useQuery({ queryKey: ["nav-items"], queryFn: () => fn({}), staleTime: 60_000 });

  const items = ((q.data ?? []) as NavRow[]).filter((i) => i.visible && (!i.admin_only || isAdmin));
  const grouped = items.reduce<Record<string, NavRow[]>>((acc, it) => {
    (acc[it.section] ??= []).push(it);
    return acc;
  }, {});

  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const orderedSections = ["main", "ai", "admin", ...Object.keys(grouped).filter((s) => !["main", "ai", "admin"].includes(s))];

  return (
    <Sidebar collapsible="icon" className="top-(--topbar-h) h-[calc(100svh-var(--topbar-h))]">
      <SidebarContent className="pt-1">
        {orderedSections.map((section) => {
          const list = grouped[section];
          if (!list?.length) return null;
          return (
            <SidebarGroup key={section}>
              <SidebarGroupLabel>{SECTION_LABEL[section] ?? section}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {list.map((it) => {
                    const Icon = getIcon(it.icon);
                    return (
                      <SidebarMenuItem key={it.id}>
                        <SidebarMenuButton asChild isActive={isActive(it.route)} tooltip={it.label} className={ACTIVE_ITEM}>
                          <Link to={it.route}>
                            <Icon className="h-4 w-4" />
                            <span>{it.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {/* fallback while nav_items hasn't loaded */}
        {q.isLoading && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-3 py-2 text-xs text-muted-foreground">Carregando menu...</div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && !items.some((i) => i.route === "/admin") && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip="Painel Admin" className={ACTIVE_ITEM}>
                    <Link to="/admin"><Settings className="h-4 w-4" /><span>Painel Admin</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-2 px-2 pt-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden" title={email}>
          <span className="min-w-0 truncate">{email}</span>
          {isAdmin && <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-primary">Admin</span>}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
