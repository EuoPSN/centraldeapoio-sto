import { useState, type ComponentType, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminSections } from "@/lib/settings.functions";
import { getAdminPendingCounts } from "@/lib/admin-pending.functions";
import { getIcon } from "@/lib/icon-map";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

import { UsersTab, AiTab, ProcedimentosTab, ProblemasTecnicosTab } from "@/components/admin/CoreTabs";
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
import { ChangelogTab } from "@/components/admin/ChangelogTab";
import { SuggestionsTab } from "@/components/admin/SuggestionsTab";
import { UnidadesTab } from "@/components/admin/UnidadesTab";
import { EquipeMenuTab } from "@/components/admin/EquipeMenuTab";
import { HomepageMessagesTab } from "@/components/admin/HomepageMessagesTab";
import { TaxonomyTab } from "@/components/admin/TaxonomyTab";
import { BibliotecaTab } from "@/components/admin/BibliotecaTab";
import { PromoPlansTab } from "@/components/admin/PromoPlansTab";
import { ObjecoesAdminTab, ObjecoesNovasTab, FechamentoAdminTab, EconomiaAdminTab } from "@/components/admin/ClienteDisseAdmin";
import { CadenciaAdminTab, MotivosPerdaAdminTab } from "@/components/admin/RetomadaAdmin";

// Ordem dos grupos na entrada, no seletor e em "Organização das abas".
export const ADMIN_GROUP_ORDER = ["Atendimento", "Inteligência", "Treino", "Central de Ajuda", "Equipe e sistema"];

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
  contatos: ContatosTab,
  scriptreview: () => <MensagensEScriptsTab defaultTab="revisar" />,
  objecoes: ObjecoesAdminTab,
  objecoesnovas: ObjecoesNovasTab,
  fechamento: FechamentoAdminTab,
  economia: EconomiaAdminTab,
  cadencia: CadenciaAdminTab,
  motivosperda: MotivosPerdaAdminTab,

  knowledge: KnowledgeTab,
  ai: AiTab,
  clientknowledge: ClientKnowledgeTab,
  marciana: MarcianaTab,

  perfis: ClientProfilesTab,
  problemscenarios: ProblemScenariosTab,
  simuladorresultados: SimulatorResultsTab,
  treinamentos: TreinamentosTab,
  checklist: ChecklistTab,

  procedimentos: ProcedimentosTab,
  problemastecnicos: ProblemasTecnicosTab,
  changelog: ChangelogTab,
  suggestions: SuggestionsTab,
  content: ProcedimentosTab,

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

/** Barra de topo do Admin: entrada ("Painel Admin" + busca) ou dentro de uma
 * seção ("← Painel Admin" + seletor de grupo/seção + busca). */
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

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3 mb-5">
      {current ? (
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/admin" className="shrink-0 text-sm text-ink-muted hover:text-ink">← Painel Admin</Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-w-0 items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 text-sm hover:bg-sidebar">
              <span className="truncate text-ink-muted">{current.group_name} ›</span>
              <span className="truncate font-medium text-ink">{current.label}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto">
              {orderedGroups.map((g) => (
                <div key={g}>
                  <DropdownMenuLabel className="type-overline text-xs text-ink-muted">{g}</DropdownMenuLabel>
                  {(grouped[g] ?? []).map((s) => (
                    <DropdownMenuItem key={s.tab_key} asChild>
                      <Link
                        to="/admin/$key"
                        params={{ key: s.tab_key }}
                        className={cn("flex w-full items-center justify-between gap-2", s.tab_key === current.tab_key && "font-semibold text-gold-text")}
                      >
                        {s.label}
                        <PendingDot n={pending?.bySection[s.tab_key] ?? 0} />
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
  );
}

export function AdminSectionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = getIcon(name);
  return <Icon className={className} />;
}
