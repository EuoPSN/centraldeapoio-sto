import { useState, type ComponentType, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminSections } from "@/lib/settings.functions";
import { getAdminPendingCounts } from "@/lib/admin-pending.functions";
import { getIcon } from "@/lib/icon-map";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_GROUP_ORDER } from "@/components/admin/admin-groups";

import { UsersTab } from "@/components/admin/UsersTab";
import { AiTab } from "@/components/admin/AiTab";
import { ProcedimentosTab } from "@/components/admin/ProcedimentosTab";
import { ProblemasTecnicosTab } from "@/components/admin/ProblemasTecnicosTab";
import { KnowledgeTab } from "@/components/admin/KnowledgeTab";
import { ClientKnowledgeTab } from "@/components/admin/ClientKnowledgeTab";
import { MarcianaTab } from "@/components/admin/MarcianaTab";
import { MensagensEScriptsTab } from "@/components/admin/MensagensEScriptsTab";
import { MessagesTab } from "@/components/admin/MessagesTab";
import { PricingTab } from "@/components/admin/PricingTab";
import { ContatosTab } from "@/components/admin/ContatosTab";
import { ClientProfilesTab } from "@/components/admin/ClientProfilesTab";
import { ProblemScenariosTab } from "@/components/admin/ProblemScenariosTab";
import { SimulatorResultsTab } from "@/components/admin/SimulatorResultsTab";
import { TreinamentosTab } from "@/components/admin/TreinamentosTab";
import { ChecklistTab } from "@/components/admin/ChecklistTab";
import { RankingAdminTab } from "@/components/admin/RankingAdmin";
import { ExtensaoAdminTab } from "@/components/admin/ExtensaoAdmin";
import { MudancasAdminTab } from "@/components/admin/MudancasAdmin";
import { SuggestionsTab } from "@/components/admin/SuggestionsTab";
import { UnidadesTab } from "@/components/admin/UnidadesTab";
import { EquipeMenuTab } from "@/components/admin/EquipeMenuTab";
import { HomepageMessagesTab } from "@/components/admin/HomepageMessagesTab";
import { TaxonomyTab } from "@/components/admin/TaxonomyTab";
import { BibliotecaTab } from "@/components/admin/BibliotecaTab";
import { PromoPlansTab } from "@/components/admin/PromoPlansTab";
import { ObjecoesAdminTab } from "@/components/admin/ObjecoesAdminTab";
import { ObjecoesNovasTab } from "@/components/admin/ObjecoesNovasTab";
import { FechamentoAdminTab } from "@/components/admin/FechamentoAdminTab";
import { EconomiaAdminTab } from "@/components/admin/EconomiaAdminTab";
import { CadenciaAdminTab } from "@/components/admin/CadenciaAdminTab";
import { MotivosPerdaAdminTab } from "@/components/admin/MotivosPerdaAdminTab";
import { CerebroAdminTab } from "@/components/admin/CerebroAdminTab";
import { RaioxEquipeTab } from "@/components/admin/RaioxEquipeTab";
import { MensagensVendemAdminTab } from "@/components/admin/MensagensVendemAdmin";
import { ConversasEnviadasAdminTab } from "@/components/admin/ConversasEnviadasAdmin";
import { ScriptsLigacaoAdminTab } from "@/components/admin/ScriptsLigacaoAdmin";
import { RoteirosAudioAdminTab } from "@/components/admin/RoteirosAudioAdmin";
import { DuvidasAdminTab } from "@/components/admin/DuvidasAdmin";
import { MapaEquipeTab } from "@/components/admin/MapaEquipeTab";
import { BancoExerciciosTab } from "@/components/admin/BancoExerciciosTab";
import { AquecimentoAdminTab } from "@/components/admin/AquecimentoAdminTab";

export { ADMIN_GROUP_ORDER };

export interface AdminSectionRow {
  id: string; tab_key: string; label: string; icon: string;
  group_name: string; position: number; visible: boolean;
}

// Toda seção do Admin, visível ou não (algumas viraram abas dentro de outra
// seção — continuam acessíveis direto por link antigo, só não aparecem no menu).
export const ADMIN_TAB_COMPONENTS: Record<string, ComponentType> = {
  messages: MensagensEScriptsTab,
  atendimentos: () => <MessagesTab defaultTab="fluxo" />,
  pricing: PricingTab,
  telemedicina: () => <PricingTab defaultTab="telemedicina" />,
  duvidas: DuvidasAdminTab,
  roteirosaudio: RoteirosAudioAdminTab,
  scriptsligacao: ScriptsLigacaoAdminTab,
  contatos: ContatosTab,
  scriptreview: () => <MensagensEScriptsTab defaultTab="revisar" />,
  objecoes: ObjecoesAdminTab,
  objecoesnovas: ObjecoesNovasTab,
  fechamento: FechamentoAdminTab,
  economia: EconomiaAdminTab,
  cadencia: CadenciaAdminTab,
  motivosperda: MotivosPerdaAdminTab,
  mensagensvendem: MensagensVendemAdminTab,
  conversasenviadas: ConversasEnviadasAdminTab,

  knowledge: KnowledgeTab,
  ai: AiTab,
  clientknowledge: ClientKnowledgeTab,
  marciana: MarcianaTab,
  cerebro: CerebroAdminTab,
  raioxequipe: RaioxEquipeTab,

  perfis: ClientProfilesTab,
  problemscenarios: ProblemScenariosTab,
  simuladorresultados: SimulatorResultsTab,
  treinamentos: TreinamentosTab,
  checklist: ChecklistTab,
  mapaequipe: MapaEquipeTab,
  bancoexercicios: BancoExerciciosTab,
  aquecimentoadmin: AquecimentoAdminTab,
  rankingadmin: RankingAdminTab,
  extensaoadmin: ExtensaoAdminTab,

  procedimentos: ProcedimentosTab,
  problemastecnicos: ProblemasTecnicosTab,
  changelog: MudancasAdminTab,
  suggestions: SuggestionsTab,

  users: UsersTab,
  unidades: UnidadesTab,
  menu: EquipeMenuTab,
  organizacao: () => <EquipeMenuTab defaultTab="organizacao" />,
  homemsg: HomepageMessagesTab,
  taxonomy: TaxonomyTab,
  imagelibrary: BibliotecaTab,
  promoplans: PromoPlansTab,
};

export function useAdminSections() {
  const fn = useServerFn(listAdminSections);
  const q = useQuery({ queryKey: ["admin-sections-nav"], queryFn: () => fn({}) });
  const sections = (q.data ?? []) as AdminSectionRow[];
  const visible = sections.filter((s) => s.visible);
  const grouped = visible.reduce<Record<string, AdminSectionRow[]>>((acc, s) => {
    (acc[s.group_name] ??= []).push(s);
    return acc;
  }, {});
  const orderedGroups = [...ADMIN_GROUP_ORDER, ...Object.keys(grouped).filter((g) => !ADMIN_GROUP_ORDER.includes(g))]
    .filter((g) => grouped[g]?.length);
  return { isLoading: q.isLoading, sections, visible, grouped, orderedGroups };
}

// Contagens de pendência (sugestões, scripts para revisar, MarcIAna, Central de
// Ajuda, Amor Saúde, Contatos) — uma função de servidor só, reaproveitada na
// entrada, no seletor de seções e na pílula do menu lateral do site.
export function useAdminPendingCounts(enabled = true) {
  const fn = useServerFn(getAdminPendingCounts);
  const q = useQuery({ queryKey: ["admin-pending-counts"], queryFn: () => fn({}), staleTime: 30_000, enabled });
  return { data: q.data, isLoading: q.isLoading };
}

export function PendingDot({ n }: { n: number }) {
  if (!n) return null;
  return <Badge className="h-5 min-w-5 shrink-0 justify-center rounded-full px-1 text-[11px]">{n}</Badge>;
}

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/** Barra de topo do Admin: entrada ("Painel Admin" + busca) ou dentro de uma
 * seção ("← Painel Admin" + busca, e abaixo as abas de grupo e as seções do grupo atual). */
export function AdminTopBar({ current }: { current?: AdminSectionRow }) {
  const { grouped, orderedGroups } = useAdminSections();
  const { data: pending } = useAdminPendingCounts();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const goToSearch = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !query.trim()) return;
    const n = query.trim().toLowerCase();
    const all = orderedGroups.flatMap((g) => grouped[g] ?? []);
    const hit = all.find((s) => s.label.toLowerCase().includes(n));
    if (hit) {
      navigate({ to: "/admin/$key", params: { key: hit.tab_key } });
      setQuery("");
    }
  };

  const bySection = pending?.bySection ?? {};
  const secoesDe = (g: string) => [...(grouped[g] ?? [])].sort((a, b) => a.position - b.position);
  const pendenciasDe = (g: string) => secoesDe(g).reduce((sum, s) => sum + (bySection[s.tab_key] ?? 0), 0);
  const grupoAtual = current && orderedGroups.includes(current.group_name) ? current.group_name : null;

  return (
    <div className="mb-5 border-b border-line pb-3">
      <div className="flex items-center justify-between gap-3">
        {current ? (
          <Link to="/admin" className={cn("shrink-0 rounded-sm text-sm text-ink-muted hover:text-ink", FOCO)}>← Painel Admin</Link>
        ) : (
          <span className="rounded-md border border-line-strong px-2.5 py-1 text-sm font-medium text-ink">Painel Admin</span>
        )}

        <div className="relative w-full max-w-[300px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={goToSearch}
            placeholder="Buscar seção ou item…"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {current && orderedGroups.length > 0 && (
        <div className="mt-4 space-y-2">
          {/* Abas de grupo: clicar abre a primeira seção do grupo. */}
          <div role="tablist" aria-label="Grupos do Admin" className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {orderedGroups.map((g) => {
              const ativo = g === grupoAtual;
              const n = pendenciasDe(g);
              return (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => {
                    const primeira = secoesDe(g)[0];
                    if (primeira && !ativo) navigate({ to: "/admin/$key", params: { key: primeira.tab_key } });
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors motion-reduce:transition-none",
                    FOCO,
                    ativo ? "border-ink bg-ink font-medium text-background" : "border-line-strong text-ink hover:bg-sidebar",
                  )}
                >
                  {g}
                  {!ativo && <PendingDot n={n} />}
                </button>
              );
            })}
          </div>

          {/* Seções do grupo atual: sempre visíveis. */}
          {grupoAtual && (
            <div role="tablist" aria-label={`Seções de ${grupoAtual}`} className="flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {secoesDe(grupoAtual).map((s) => {
                const atual = s.tab_key === current.tab_key;
                return (
                  <Link
                    key={s.tab_key}
                    to="/admin/$key"
                    params={{ key: s.tab_key }}
                    role="tab"
                    aria-selected={atual}
                    aria-current={atual ? "page" : undefined}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-md border-b-2 px-3 py-1.5 text-sm transition-colors motion-reduce:transition-none",
                      FOCO,
                      atual ? "border-gold bg-sidebar font-medium text-ink" : "border-transparent text-ink-muted hover:bg-sidebar hover:text-ink",
                    )}
                  >
                    {s.label}
                    <PendingDot n={bySection[s.tab_key] ?? 0} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminSectionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = getIcon(name);
  return <Icon className={className} />;
}
