import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Phone } from "lucide-react";
import {
  enderecoCurto, matches, nomeBase, norm, textoEnderecoClinica, useAmorSaude, type Clinica, type Consulta,
} from "@/components/amor-saude/model";
import { useRegiao } from "@/components/amor-saude/store";
import { CopyAction, EmptyState, Overline, Selo, SubpageHeader } from "@/components/amor-saude/ui";
import { SkeletonLine } from "@/components/scripts/shared";
import { cn } from "@/lib/utils";

type Search = { item?: string };

export const Route = createFileRoute("/_authenticated/amor-saude/clinicas")({
  validateSearch: (s: Record<string, unknown>): Search => ({ item: typeof s.item === "string" && s.item ? s.item : undefined }),
  component: ClinicasPage,
});

const SEM_REGIAO = "Sem região";

function ClinicasPage() {
  const { item } = Route.useSearch();
  const { clinicas, consultas, regioes, isLoading } = useAmorSaude();
  const regiao = useRegiao();
  const [query, setQuery] = useState("");

  // Especialidades de cada clínica (nomes base, sem repetir variações).
  const especialidades = useMemo(() => {
    const map = new Map<string, string[]>();
    consultas.forEach((c: Consulta) => c.clinicaIds.forEach((id) => {
      const base = nomeBase(c.nome);
      const cur = map.get(id) ?? [];
      if (!cur.some((x) => norm(x) === norm(base))) map.set(id, [...cur, base]);
    }));
    map.forEach((v) => v.sort((a, b) => a.localeCompare(b, "pt-BR")));
    return map;
  }, [consultas]);

  // Agrupadas por região: a do cliente primeiro, depois as que têm principais.
  const grupos = useMemo(() => {
    const visiveis = clinicas.filter((c) => matches(query, c.nome, c.regiao, c.endereco, c.pontoReferencia, (especialidades.get(c.id) ?? []).join(" ")));
    const map = new Map<string, Clinica[]>();
    visiveis.forEach((c) => {
      const k = c.regiao ?? SEM_REGIAO;
      map.set(k, [...(map.get(k) ?? []), c]);
    });
    const rank = (r: string, cs: Clinica[]) => (r === regiao ? 0 : r === SEM_REGIAO ? 3 : cs.some((c) => c.principal) ? 1 : 2);
    return [...map.entries()]
      .map(([r, cs]) => ({ regiao: r, clinicas: cs.sort((a, b) => Number(b.principal) - Number(a.principal) || a.position - b.position || a.nome.localeCompare(b.nome, "pt-BR")) }))
      .sort((a, b) => rank(a.regiao, a.clinicas) - rank(b.regiao, b.clinicas) || a.regiao.localeCompare(b.regiao, "pt-BR"));
  }, [clinicas, query, regiao, especialidades]);

  const refs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (item) refs.current.get(item)?.scrollIntoView({ block: "center" });
  }, [item, grupos.length]);

  return (
    <>
      <SubpageHeader
        title="Clínicas"
        active="/amor-saude/clinicas"
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Buscar clínica, bairro ou especialidade…"
        regioes={regioes}
      />

      <div className="min-h-0 flex-1 md:overflow-y-auto">
        <div className="max-w-[920px] px-4 pb-10 pt-2 sm:px-7">
          {isLoading ? (
            <div className="space-y-6 py-6">{Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2"><SkeletonLine className="h-4 w-48" /><SkeletonLine className="h-3.5 w-72" /></div>)}</div>
          ) : clinicas.length === 0 ? (
            <EmptyState title="Nenhuma clínica cadastrada ainda." hint="Cadastre no Painel Admin → Contatos e Endereços → Clínica Amor Saúde." />
          ) : grupos.length === 0 ? (
            <EmptyState title="Nenhuma clínica encontrada." hint="Tente outra palavra." />
          ) : (
            grupos.map((g) => (
              <section key={g.regiao} aria-label={g.regiao} className="mt-6">
                <Overline>
                  {g.regiao}
                  {g.regiao === regiao && <span className="text-gold-text"> · região do cliente</span>}
                </Overline>
                <ul className="mt-1">
                  {g.clinicas.map((c) => (
                    <ClinicaRow
                      key={c.id}
                      c={c}
                      especialidades={especialidades.get(c.id) ?? []}
                      highlighted={c.id === item}
                      liRef={(el) => (el ? refs.current.set(c.id, el) : refs.current.delete(c.id))}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function ClinicaRow({ c, especialidades, highlighted, liRef }: { c: Clinica; especialidades: string[]; highlighted: boolean; liRef: (el: HTMLLIElement | null) => void }) {
  const end = enderecoCurto(c);
  const fones = [c.telefone, c.telefone2].filter(Boolean) as string[];
  return (
    <li
      ref={liRef}
      className={cn(
        "relative flex flex-wrap items-start gap-x-6 gap-y-3 border-b border-line py-4 last:border-b-0",
        highlighted && "-mx-3 rounded-lg bg-sidebar px-3 before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:bg-gold",
      )}
    >
      <div className="min-w-0 flex-1 basis-72">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="text-[16px] font-semibold leading-6 text-ink">{c.nome}</h2>
          {c.principal && <Selo tipo="principal" />}
        </div>
        {end && <p className="mt-0.5 text-[14.5px] leading-[22px] text-ink">{end}</p>}
        {c.pontoReferencia && <p className="text-[13.5px] leading-5 text-ink-muted">{c.pontoReferencia}</p>}
        {fones.length > 0 && (
          <p className="mt-1 flex items-center gap-1.5 text-[14px] tabular-nums text-ink-muted">
            <Phone className="h-3.5 w-3.5 text-gold-text" strokeWidth={1.5} aria-hidden /> {fones.join(" · ")}
          </p>
        )}
        {especialidades.length > 0 ? (
          <details className="group mt-1.5">
            <summary className="w-fit cursor-pointer list-none rounded text-[13.5px] font-semibold text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              {especialidades.length} {especialidades.length === 1 ? "especialidade" : "especialidades"}
              <span className="font-normal text-ink-muted group-open:hidden"> · ver quais</span>
            </summary>
            <p className="mt-1 max-w-[68ch] text-[13.5px] leading-5 text-ink-muted">{especialidades.join(" · ")}</p>
          </details>
        ) : (
          <p className="mt-1.5 text-[13.5px] text-ink-muted">Nenhuma especialidade marcada ainda.</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2.5">
        <a
          href={c.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-[15px] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Abrir no Maps <ExternalLink className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} aria-hidden />
        </a>
        <CopyAction variant="gold" text={textoEnderecoClinica(c)}>Copiar endereço</CopyAction>
      </div>
    </li>
  );
}
