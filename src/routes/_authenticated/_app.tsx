import { Outlet } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/content.functions";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app")({
  component: AppLayout,
});

function AppLayout() {
  const me = useServerFn(getMe);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => me({}) });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar isAdmin={data?.isAdmin ?? false} email={data?.email ?? ""} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border bg-card px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => {
                const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true });
                window.dispatchEvent(ev);
              }}
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Buscar...</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-mono">
                Ctrl K
              </kbd>
            </Button>
          </header>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>

          <GlobalSearch />
        </div>
      </div>
    </SidebarProvider>
  );
}
