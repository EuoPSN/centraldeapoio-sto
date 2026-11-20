import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pill, PillRow } from "@/components/Pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TopbarBreadcrumb } from "@/components/scripts/shared";
import { AjudaSectionHeader } from "@/components/ajuda/AjudaSectionHeader";
import { listSuggestions, createSuggestion } from "@/lib/suggestions.functions";
import { listContent } from "@/lib/content.functions";
import { cn } from "@/lib/utils";

type Search = { tipo?: string; artigo?: string };

export const Route = createFileRoute("/_authenticated/ajuda/sugestoes")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tipo: typeof s.tipo === "string" && s.tipo ? s.tipo : undefined,
    artigo: typeof s.artigo === "string" && s.artigo ? s.artigo : undefined,
  }),
  component: Page,
});

const TIPOS = [
  { id: "sugestao", label: "Sugestão" },
  { id: "duvida", label: "Dúvida" },
  { id: "script", label: "Novo script" },
  { id: "fluxo", label: "Novo fluxo" },
  { id: "melhoria", label: "Melhoria" },
] as const;

// Mapeia os status já existentes (pendente/em_analise/implementado/rejeitado)
// para os três rótulos do esboço: Em análise, Respondida (já tem resposta do
// admin) e Feito.
function statusPill(s: { status: string; admin_response: string | null }) {
  if (s.status === "implementado") return { label: "Feito", className: "border-transparent bg-gold text-on-gold" };
  if (s.admin_response) return { label: "Respondida", className: "border-transparent bg-surface-2 text-ink" };
  return { label: "Em análise", className: "border-line-strong bg-transparent text-ink" };
}

function Page() {
  const { tipo, artigo } = Route.useSearch();
  const listFn = useServerFn(listSuggestions);
  const createFn = useServerFn(createSuggestion);
  const contentFn = useServerFn(listContent);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["my-suggestions"], queryFn: () => listFn({ data: { all: false } }) });

  // Título do artigo que originou o "Não resolveu?" (pode estar em qualquer seção).
  const tutoriaisQ = useQuery({ queryKey: ["content", "tutoriais"], queryFn: () => contentFn({ data: { section: "tutoriais" } }) });
  const problemasQ = useQuery({ queryKey: ["content", "problemas"], queryFn: () => contentFn({ data: { section: "problemas" } }) });
  const artigoRef = artigo
    ? [...(tutoriaisQ.data ?? []), ...(problemasQ.data ?? [])].find((i: { id: string }) => i.id === artigo)
    : undefined;

  const [category, setCategory] = useState<string>(tipo && TIPOS.some((t) => t.id === tipo) ? tipo : "sugestao");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { title, description, category, content_item_id: artigo ?? null } }),
    onSuccess: () => {
      toast.success("Enviado. Obrigado!");
      setTitle("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["my-suggestions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar."),
  });

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 lg:py-7">
      <TopbarBreadcrumb items={[{ label: "Central de Ajuda", to: "/ajuda" }, { label: "Sugestões e dúvidas" }]} />
      <AjudaSectionHeader title="Sugestões e dúvidas" />

      <div className="mt-5 grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase leading-4 tracking-[0.1em] text-ink-muted">Tipo</p>
          <PillRow className="mt-2">
            {TIPOS.map((t) => (
              <Pill key={t.id} active={category === t.id} onClick={() => setCategory(t.id)}>{t.label}</Pill>
            ))}
          </PillRow>

          {artigoRef && (
            <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3">
              <p className="text-[14.5px] text-ink">
                Sobre o artigo: <span className="font-semibold">{(artigoRef as { title: string }).title}</span> (veio do "Não resolveu?")
              </p>
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase leading-4 tracking-[0.1em] text-ink-muted">Título</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[14.5px] text-ink outline-none focus:border-gold"
            />
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase leading-4 tracking-[0.1em] text-ink-muted">Descrição</p>
            <Textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Conte o que aconteceu e o que você tentou…"
              className="mt-1.5"
            />
          </div>

          <Button
            className="mt-5"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || title.trim().length < 3 || description.trim().length < 5}
          >
            Enviar
          </Button>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase leading-4 tracking-[0.1em] text-ink-muted">Minhas solicitações</p>
          {q.isLoading ? (
            <p className="mt-3 text-sm text-ink-muted">Carregando…</p>
          ) : (q.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Você ainda não enviou nenhuma sugestão ou dúvida.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-t border-line">
              {(q.data ?? []).map((s) => {
                const pill = statusPill(s);
                const tipoLabel = TIPOS.find((t) => t.id === s.category)?.label ?? s.category;
                const isOpen = expanded === s.id;
                return (
                  <li key={s.id} className="py-3">
                    <button
                      type="button"
                      onClick={() => s.admin_response && setExpanded(isOpen ? null : s.id)}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-left"
                    >
                      <span className="w-12 shrink-0 text-sm text-ink-muted">{new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                      <span className="min-w-0 flex-1 text-[14.5px] text-ink">{s.title}</span>
                      <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em]", pill.className)}>
                        {pill.label}
                      </span>
                      <span className="shrink-0 text-sm text-ink-muted">{tipoLabel}</span>
                    </button>
                    {isOpen && s.admin_response && (
                      <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[14px] text-ink">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Resposta do admin</p>
                        <p className="whitespace-pre-wrap">{s.admin_response}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
