import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminTopBar, AdminSectionIcon, PendingDot, useAdminSections, useAdminPendingCounts } from "@/components/admin/AdminShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
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
  const { data: pending, isLoading: pendingLoading } = useAdminPendingCounts();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:px-8 lg:py-7">
      <AdminTopBar />

      <h1 className="text-2xl font-medium">O que precisa de você</h1>

      {pendingLoading && <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>}
      {pending && (
        <ul className="mt-4 divide-y divide-line">
          {pending.items.map((it) => (
            <li key={it.key} className={cn("flex items-center justify-between gap-4 py-3", it.count === 0 && "opacity-50")}>
              <div className="flex items-start gap-4 min-w-0">
                <span className="w-7 shrink-0 text-right text-xl font-semibold tabular-nums">{it.count}</span>
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{it.title}</p>
                  <p className="text-sm text-ink-muted truncate">{it.context}</p>
                </div>
              </div>
              {it.count > 0 && (
                <Link to={it.href} className="shrink-0 text-sm font-medium text-gold-text hover:underline">
                  Resolver →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 type-overline text-ink-muted">Seções</p>
      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>}
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
                    <span className="truncate">{s.label}</span>
                    <PendingDot n={pending?.bySection[s.tab_key] ?? 0} />
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
