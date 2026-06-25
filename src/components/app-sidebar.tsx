import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Bot,
  DollarSign,
  GraduationCap,
  Home,
  LogOut,
  MessageSquareQuote,
  Settings,
  Wrench,
} from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";

interface NavItem {
  title: string;
  url: string;
  icon: typeof Home;
}

const mainItems: NavItem[] = [
  { title: "Início", url: "/", icon: Home },
  { title: "Conhecimento Geral", url: "/conhecimento", icon: BookOpen },
  { title: "Scripts de Atendimento", url: "/scripts", icon: MessageSquareQuote },
  { title: "Tabela de Preços", url: "/precos", icon: DollarSign },
  { title: "Problemas Técnicos", url: "/problemas", icon: Wrench },
  { title: "Tutoriais", url: "/tutoriais", icon: GraduationCap },
];

const iaItem: NavItem = { title: "Assistente IA", url: "/assistente", icon: Bot };
const adminItem: NavItem = { title: "Painel Admin", url: "/admin", icon: Settings };

export function AppSidebar({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    return pathname.startsWith(url);
  };

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <AppLogo size="md" className="shrink-0" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Central</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Inteligência</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive(iaItem.url)} tooltip={iaItem.title}>
                  <Link to={iaItem.url}>
                    <iaItem.icon className="h-4 w-4" />
                    <span>{iaItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive(adminItem.url)} tooltip={adminItem.title}>
                    <Link to={adminItem.url}>
                      <adminItem.icon className="h-4 w-4" />
                      <span>{adminItem.title}</span>
                    </Link>
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
