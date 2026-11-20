import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminTopBar, AdminSectionIcon, useAdminSections } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin")({
  // Links antigos usavam ?aba=<tab_key> pra abrir uma seção direto (ex.: os
  // cards de pendência da Início). Mantém funcionando, só que redirecionando
  // pra rota nova /admin/<tab_key>.
  validateSearch: (s: Record<string, unknown>): { aba?: string } =>
    typeof s.aba === "string" && s.aba ? { aba: s.aba } : {},
  beforeLoad: async ({ search }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      throw redirect({ to: "/" });
    }
    if (search.aba) {
      throw redirect({ to: "/admin/$key", params: { key: search.aba } });
    }
  },
  component: AdminEntryPage,
});

function AdminEntryPage() {
  const { grouped, orderedGroups, isLoading } = useAdminSections();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:px-8 lg:py-7">
      <AdminTopBar />

      <h1 className="text-2xl font-medium">O que precisa de você</h1>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>}

      <p className="mt-10 type-overline text-ink-muted">Seções</p>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {orderedGroups.map((g) => (
          <div key={g} className="rounded-2xl border border-line p-4">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-gold">
                <AdminSectionIcon name={(grouped[g]?.[0]?.icon) ?? "Folder"} className="h-4 w-4 text-gold-text" />
              </span>
              <span className="font-medium text-ink">{g}</span>
            </div>
            <ul className="mt-2">
              {(grouped[g] ?? []).map((s) => (
                <li key={s.tab_key}>
                  <Link
                    to="/admin/$key"
                    params={{ key: s.tab_key }}
                    className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-[13.5px] text-ink hover:bg-sidebar"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
