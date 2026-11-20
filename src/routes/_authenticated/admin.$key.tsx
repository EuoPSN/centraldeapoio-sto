import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminTopBar, useAdminSections, ADMIN_TAB_COMPONENTS } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/$key")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminSectionPage,
});

function AdminSectionPage() {
  const { key } = Route.useParams();
  const { sections, isLoading } = useAdminSections();
  const current = sections.find((s) => s.tab_key === key);
  const Component = ADMIN_TAB_COMPONENTS[key];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:px-8 lg:py-7">
      <AdminTopBar current={current ?? { id: key, tab_key: key, label: key, icon: "Folder", group_name: "Painel Admin", position: 0, visible: true }} />
      {Component ? (
        <Component />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <p className="text-sm text-muted-foreground">Essa seção não existe (ou foi renomeada).</p>
      )}
    </div>
  );
}
