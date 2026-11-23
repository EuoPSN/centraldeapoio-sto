import { useState } from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminTopBar, AdminSectionIcon, PendingDot, useAdminSections, useAdminPendingCounts } from "@/components/admin/AdminShell";
import { ChevronDown } from "lucide-react";
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

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function AdminEntryPage() {
  const { grouped, orderedGroups, isLoading } = useAdminSections();
  const { data: pending, isLoading: pendingLoading } = useAdminPendingCounts();
  const [emDiaAberto, setEmDiaAberto] = useState(false);

  // Só o que tem trabalho em cima, da maior contagem para a menor; as zeradas vão para "Em dia".
  const comTrabalho = (pending?.items ?? []).filter((it) => it.count > 0).sort((a, b) => b.count - a.count);
  const emDia = (pending?.items ?? []).filter((it) => it.count === 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:px-8 lg:py-7">
      <AdminTopBar />

      <h1 className="text-2xl font-medium">O que precisa de você</h1>

      {pendingLoading && <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>}
      {pending && (
        <>
          {comTrabalho.length === 0 && <p className="mt-4 text-sm text-ink-muted">Tudo em dia</p>}
          {comTrabalho.length > 0 && (
            <ul className="mt-4 divide-y divide-line">
              {comTrabalho.map((it) => (
                <li key={it.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="w-7 shrink-0 text-right text-xl font-semibold tabular-nums">{it.count}</span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        <span>{it.title}</span>
                        {it.novo && (
                          <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-gold">
                            novo aviso
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-ink-muted">{it.context}</p>
                    </div>
                  </div>
                  <Link to={it.href} className="shrink-0 text-sm font-medium text-gold-text hover:underline">
                    Resolver →
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {emDia.length > 0 && (
            <div className="mt-4 rounded-lg bg-sidebar px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm text-ink-muted">
                  <span className="font-semibold text-ink">Em dia ({emDia.length})</span>
                  {!emDiaAberto && <> · {emDia.map((it) => it.title).join(", ")}</>}
                </p>
                <button
                  type="button"
                  onClick={() => setEmDiaAberto((v) => !v)}
                  aria-expanded={emDiaAberto}
                  aria-controls="admin-em-dia"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md text-sm text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  Ver
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform motion-reduce:transition-none", emDiaAberto && "rotate-180")} />
                </button>
              </div>
              {emDiaAberto && (
                <ul id="admin-em-dia" className="mt-2 divide-y divide-line">
                  {emDia.map((it) => (
                    <li key={it.key} className="py-2">
                      <p className="text-sm font-medium text-ink">{it.title}</p>
                      <p className="text-sm text-ink-muted">{it.context}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <p className="mt-10 type-overline text-ink-muted">Seções</p>
      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>}
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {orderedGroups.map((g) => {
          const secoes = grouped[g] ?? [];
          const pend = secoes.reduce((sum, sec) => sum + (pending?.bySection[sec.tab_key] ?? 0), 0);
          return (
            <div key={g} className="rounded-2xl border border-line p-4">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-gold">
                  <AdminSectionIcon name={secoes[0]?.icon ?? "Folder"} className="h-4 w-4 text-gold-text" />
                </span>
                <span className="min-w-0 flex-1 font-medium text-ink">{g}</span>
                <span className="shrink-0 text-right text-xs text-ink-muted">
                  {plural(secoes.length, "seção", "seções")}
                  {pend > 0 && <> · {plural(pend, "pendência", "pendências")}</>}
                </span>
              </div>
              <ul className="mt-2">
                {secoes.map((sec) => (
                  <li key={sec.tab_key}>
                    <Link
                      to="/admin/$key"
                      params={{ key: sec.tab_key }}
                      className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-[13.5px] text-ink hover:bg-sidebar"
                    >
                      <span className="truncate">{sec.label}</span>
                      <PendingDot n={pending?.bySection[sec.tab_key] ?? 0} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
