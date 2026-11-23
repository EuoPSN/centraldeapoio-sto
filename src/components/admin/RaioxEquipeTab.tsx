import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRaioxEquipe, getRaioxVendedor, type PadroesRaiox } from "@/lib/cerebro.functions";
import { ETAPA_FUNIL_NOME } from "@/lib/cerebro";
import { Overline } from "@/components/cliente-disse/shared";
import { AdminListDetail, ListRow, PanelEmpty, PanelHeader } from "@/components/admin/AdminListDetail";
import { BaixarInteligenciaAdmin } from "@/components/copiloto/BaixarInteligencia";
import { Carregando } from "@/components/admin/cerebro-shared";


// ===========================================================================
// Raio-X da equipe
// ===========================================================================

const fmtData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });


function Padroes({ p }: { p: PadroesRaiox }) {
  const Lista = ({ itens, vazio }: { itens: { nome: string; n: number }[]; vazio: string }) => (
    itens.length ? (
      <ol className="mt-1.5 space-y-1">
        {itens.map((i) => <li key={i.nome} className="flex justify-between gap-3 text-[14.5px] text-ink"><span className="min-w-0">{i.nome}</span><span className="shrink-0 tabular-nums text-ink-muted">{i.n}×</span></li>)}
      </ol>
    ) : <p className="mt-1.5 text-[14px] text-ink-muted">{vazio}</p>
  );
  return (
    <div className="space-y-5">
      <div><Overline>Raio-X feitos (90 dias)</Overline><p className="mt-1 text-[24px] font-medium leading-8 text-ink">{p.total}</p></div>
      <div><Overline>Técnicas que mais faltam</Overline><Lista itens={p.tecnicas} vazio="Ainda sem dados." /></div>
      <div><Overline>Erros de escrita mais frequentes</Overline><Lista itens={p.escrita} vazio="Nenhum erro registrado." /></div>
      <div><Overline>Etapa em que mais perde</Overline><Lista itens={p.etapa ? [p.etapa] : []} vazio="Ainda sem dados." /></div>
    </div>
  );
}


export function RaioxEquipeTab() {
  const fn = useServerFn(getRaioxEquipe);
  const vendFn = useServerFn(getRaioxVendedor);
  const q = useQuery({ queryKey: ["admin-raiox-equipe"], queryFn: () => fn({}) });
  const [sel, setSel] = useState<string>("equipe");
  const vendedor = q.data?.vendedores.find((v) => v.user_id === sel) ?? null;
  const detalhe = useQuery({
    queryKey: ["admin-raiox-vendedor", sel], enabled: !!vendedor,
    queryFn: () => vendFn({ data: { user_id: sel } }),
  });

  const painel = q.data ? (
    <div>
      <PanelHeader overline={vendedor ? "Vendedor" : "Equipe"} title={vendedor ? vendedor.nome : "Toda a equipe"} />
      <div className="-mt-1 mb-5"><BaixarInteligenciaAdmin /></div>
      <Padroes p={vendedor ?? q.data.equipe} />
      {vendedor && (
        <div className="mt-6 border-t border-line pt-4">
          <Overline>Resultados (90 dias)</Overline>
          {detalhe.isLoading ? <Carregando /> : (
            <ul className="mt-2 space-y-4">
              {(detalhe.data ?? []).map((r) => (
                <li key={r.id} className="rounded-lg border border-line p-3 text-[14px] leading-6 text-ink">
                  <p className="text-[12.5px] text-ink-muted">{fmtData(r.created_at)}{r.etapa ? ` · ${ETAPA_FUNIL_NOME[r.etapa as keyof typeof ETAPA_FUNIL_NOME] ?? r.etapa}` : ""}</p>
                  {r.onde_perdeu?.descricao && <p className="mt-1">{r.onde_perdeu.descricao}</p>}
                  {(r.onde_perdeu?.fala_cliente || r.onde_perdeu?.fala_atendente) && (
                    <p className="mt-1 text-ink-muted">
                      {r.onde_perdeu.fala_cliente && <>Cliente: “{r.onde_perdeu.fala_cliente}”</>}
                      {r.onde_perdeu.fala_cliente && r.onde_perdeu.fala_atendente && " · "}
                      {r.onde_perdeu.fala_atendente && <>Atendente: “{r.onde_perdeu.fala_atendente}”</>}
                    </p>
                  )}
                  {r.faltou?.length > 0 && <p className="mt-1 flex flex-wrap gap-1.5">{r.faltou.map((f, i) => <span key={i} className="rounded-full border border-line-strong px-2 py-0.5 text-[12px]">{f.tecnica}</span>)}</p>}
                </li>
              ))}
              {!detalhe.data?.length && <p className="text-[14px] text-ink-muted">Nenhum Raio-X nos últimos 90 dias.</p>}
            </ul>
          )}
        </div>
      )}
      <p className="mt-6 rounded-xl border border-dashed border-line-strong p-3 text-[13px] leading-5 text-ink-muted">
        Só números, padrões e trechos já sem nome ou telefone do cliente. A conversa completa nunca é guardada. Os resultados somem após 90 dias.
      </p>
    </div>
  ) : <PanelEmpty>Carregando…</PanelEmpty>;

  return (
    <AdminListDetail title="Raio-X da equipe" subtitle="Padrões das análises de venda perdida, por vendedor e da equipe toda." panel={painel}>
      {q.isLoading ? <Carregando /> : (
        <div className="border-t border-line">
          <ListRow active={sel === "equipe"} onClick={() => setSel("equipe")}>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">Toda a equipe</span>
            <span className="shrink-0 text-[13px] text-ink-muted">{q.data?.equipe.total ?? 0} Raio-X</span>
          </ListRow>
          {(q.data?.vendedores ?? []).map((v) => (
            <ListRow key={v.user_id} active={sel === v.user_id} onClick={() => setSel(v.user_id)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{v.nome}</span>
                <span className="block truncate text-[13px] text-ink-muted">{v.tecnicas[0] ? `Falta mais: ${v.tecnicas[0].nome}` : "Sem dados de técnica"} · último em {fmtData(v.ultimo)}</span>
              </span>
              <span className="shrink-0 text-[13px] text-ink-muted">{v.total} Raio-X</span>
            </ListRow>
          ))}
          {!q.data?.vendedores.length && <p className="py-6 text-[14px] text-ink-muted">Ninguém fez Raio-X ainda.</p>}
        </div>
      )}
    </AdminListDetail>
  );
}
