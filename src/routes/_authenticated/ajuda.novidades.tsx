import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopbarBreadcrumb } from "@/components/scripts/shared";
import { AjudaSectionHeader } from "@/components/ajuda/AjudaSectionHeader";
import { listChangelog } from "@/lib/changelog.functions";
import { getAjudaNovidadesStatus, markAjudaNovidadesSeen } from "@/lib/ajuda.functions";

export const Route = createFileRoute("/_authenticated/ajuda/novidades")({
  component: Page,
});

interface Entry { id: string; title: string; summary: string; published: boolean; created_at: string }

function Page() {
  const listFn = useServerFn(listChangelog);
  const statusFn = useServerFn(getAjudaNovidadesStatus);
  const markSeenFn = useServerFn(markAjudaNovidadesSeen);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["changelog"], queryFn: () => listFn({}) });
  const statusQ = useQuery({ queryKey: ["ajuda", "novidades-status"], queryFn: () => statusFn({}) });
  const markSeenMut = useMutation({ mutationFn: () => markSeenFn({}), onSuccess: () => qc.invalidateQueries({ queryKey: ["ajuda", "novidades-status"] }) });

  useEffect(() => {
    markSeenMut.mutate();
    // Só precisa marcar uma vez ao abrir a página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = ((q.data ?? []) as Entry[]).filter((e) => e.published).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lastSeen = statusQ.data?.lastSeen ?? null;
  const isNew = (createdAt: string) => !lastSeen || new Date(createdAt) > new Date(lastSeen);

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6 lg:py-7">
      <TopbarBreadcrumb items={[{ label: "Central de Ajuda", to: "/ajuda" }, { label: "Novidades" }]} />
      <AjudaSectionHeader title="Novidades" />

      {q.isLoading ? (
        <p className="text-sm text-ink-muted">Carregando…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-6">
          <p className="text-[15px] text-ink">Nenhuma novidade por enquanto.</p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-4">
              {isNew(e.created_at) && <span aria-label="Novo" className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-gold" />}
              <div className={isNew(e.created_at) ? "" : "pl-[13px]"}>
                <p className="text-sm text-ink-muted">{new Date(e.created_at).toLocaleDateString("pt-BR")}</p>
                <p className="mt-0.5 font-semibold text-ink">{e.title}</p>
                <p className="mt-0.5 text-[14.5px] leading-[1.6] text-ink-muted">{e.summary}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
