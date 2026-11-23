import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminMapaEquipe } from "@/lib/aquecimento-admin.functions";
import { NIVEL_LABEL, NIVEL_ORDEM, type Nivel } from "@/lib/aquecimento";
import { Overline } from "@/components/cliente-disse/shared";
import { AdminListDetail, PanelEmpty } from "@/components/admin/AdminListDetail";
import { cn } from "@/lib/utils";


// ---------------------------------------------------------------------------
// Mapa da equipe
// ---------------------------------------------------------------------------

function Celula({ nivel, nome, tema }: { nivel: Nivel; nome: string; tema: string }) {
  return (
    <span
      role="img"
      aria-label={`${nome}, ${tema}: ${NIVEL_LABEL[nivel]}`}
      title={NIVEL_LABEL[nivel]}
      className={cn(
        "block h-7 rounded-md",
        nivel === "dominando" && "bg-gold",
        nivel === "aprendendo" && "bg-gold/30",
        nivel === "nao_testado" && "border border-dashed border-line-strong",
      )}
    />
  );
}


export function MapaEquipeTab() {
  const fn = useServerFn(adminMapaEquipe);
  const q = useQuery({ queryKey: ["admin-mapa-equipe"], queryFn: () => fn({}) });
  const d = q.data;

  const analise = useMemo(() => {
    if (!d) return null;
    const nivelDe = (uid: string, tid: string): Nivel => d.celulas[`${uid}:${tid}`]?.nivel ?? "nao_testado";
    const porTema = d.temas.map((t, ordem) => {
      const c = { dominando: 0, aprendendo: 0, nao_testado: 0 };
      for (const a of d.atendentes) c[nivelDe(a.id, t.id)]++;
      return { ...t, ordem, ...c, testados: c.dominando + c.aprendendo };
    });
    const candidatos = porTema.filter((t) => t.testados > 0);
    const fraco = [...candidatos].sort((a, b) => (a.dominando + a.aprendendo * 0.5) - (b.dominando + b.aprendendo * 0.5) || b.nao_testado - a.nao_testado || a.ordem - b.ordem)[0] ?? null;
    const reforco = fraco
      ? d.atendentes
        .map((a) => ({ a, c: d.celulas[`${a.id}:${fraco.id}`], n: nivelDe(a.id, fraco.id) }))
        .filter((x) => x.n !== "dominando")
        .sort((x, y) => NIVEL_ORDEM[x.n] - NIVEL_ORDEM[y.n] || ((x.c?.acertos ?? 0) / Math.max(1, x.c?.respostas ?? 1)) - ((y.c?.acertos ?? 0) / Math.max(1, y.c?.respostas ?? 1)))
        .slice(0, 3).map((x) => x.a.nome)
      : [];
    return { fraco, reforco };
  }, [d]);

  return (
    <AdminListDetail
      title="Mapa da equipe"
      subtitle={`Nível de cada atendente por tema, nos últimos ${d?.janela_dias ?? 60} dias.`}
      panel={
        analise?.fraco ? (
          <div>
            <p className="type-overline text-ink-muted">Tema mais fraco da equipe</p>
            <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink">{analise.fraco.nome}</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([["dominando", analise.fraco.dominando, "dominando"], ["aprendendo", analise.fraco.aprendendo, "aprendendo"], ["nao_testado", analise.fraco.nao_testado, "não testados"]] as const).map(([k, n, l]) => (
                <div key={k} className="rounded-lg border border-line px-3 py-2">
                  <p className="text-[20px] font-medium leading-7 tabular-nums text-ink">{n}</p>
                  <p className="text-[12.5px] text-ink-muted">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13.5px] leading-5 text-ink-muted">Quem ainda não domina este tema recebe cartões dele primeiro no aquecimento.</p>
            <Link
              to="/treinamentos"
              search={{ busca: analise.fraco.nome }}
              className="mt-3 inline-flex h-10 items-center rounded-lg bg-gold px-[18px] text-[14px] font-semibold text-on-gold hover:brightness-105"
            >
              Abrir treinamento sobre {analise.fraco.nome}
            </Link>
            {analise.reforco.length > 0 && (
              <>
                <div className="mt-6"><Overline>Quem mais precisa de reforço</Overline></div>
                <p className="mt-1 text-[14px] text-ink">{analise.reforco.join(" · ")}</p>
              </>
            )}
            <p className="mt-4 text-[12.5px] leading-5 text-ink-muted">Você vê níveis e contagens, não o texto que cada pessoa digitou nos cartões.</p>
          </div>
        ) : (
          <PanelEmpty>{q.isLoading ? "Carregando…" : "Ainda não há respostas da equipe no aquecimento."}</PanelEmpty>
        )
      }
    >
      {q.isError && <p className="text-[13.5px] text-ink-muted">Não consegui carregar o mapa agora. Tente de novo.</p>}
      {d && d.atendentes.length === 0 && <PanelEmpty>Nenhum atendente cadastrado.</PanelEmpty>}
      {d && d.atendentes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-x-1.5 border-spacing-y-1.5 text-left">
            <thead>
              <tr>
                <th className="w-28" />
                {d.temas.map((t) => <th key={t.id} scope="col" className="px-0.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{t.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.atendentes.map((a) => (
                <tr key={a.id}>
                  <th scope="row" className="whitespace-nowrap pr-2 text-[14px] font-normal text-ink">{a.nome.split(" ")[0]}</th>
                  {d.temas.map((t) => <td key={t.id}><Celula nivel={d.celulas[`${a.id}:${t.id}`]?.nivel ?? "nao_testado"} nome={a.nome} tema={t.nome} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-muted" aria-label="Legenda">
            {(["nao_testado", "aprendendo", "dominando"] as const).map((n) => (
              <li key={n} className="flex items-center gap-1.5"><span className="w-5"><Celula nivel={n} nome="" tema="" /></span>{NIVEL_LABEL[n]}</li>
            ))}
          </ul>
        </div>
      )}
    </AdminListDetail>
  );
}
