import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { AppLogo } from "./AppLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNavItems } from "@/lib/settings.functions";
import { getIcon } from "@/lib/icon-map";

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
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <AppLogo size="md" className="shrink-0" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
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
                        <SidebarMenuButton asChild isActive={isActive(it.route)} tooltip={it.label}>
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
                  <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip="Painel Admin">
                    <Link to="/admin"><Settings className="h-4 w-4" /><span>Painel Admin</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="mb-2 px-2 text-xs text-muted-foreground truncate" title={email}>
          {email}
          {isAdmin && <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">ADMIN</span>}
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
