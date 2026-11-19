import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContent, listPricing } from "@/lib/content.functions";
import { listKnowledge } from "@/lib/knowledge.functions";
import { listMessages } from "@/lib/messages.functions";
import { listClientProfilesForTraining } from "@/lib/clientprofiles.functions";
import { listAllCategories } from "@/lib/taxonomy.functions";
import { listMetas } from "@/lib/metas.functions";
import { listUnidades } from "@/lib/unidades.functions";
import { listExames } from "@/lib/exames.functions";
import { listProcedimentos } from "@/lib/odontologia.functions";
import { listChangelog } from "@/lib/changelog.functions";
import { listContatos } from "@/lib/contatos.functions";
import {
  BookOpen, DollarSign, GraduationCap, MessageSquareQuote, Wrench,
  Users, Tag, UserCog, MapPin, FlaskConical, Stethoscope, Star, Bot, Hospital,
} from "lucide-react";

/** Evento para abrir a busca global já com um texto (ex.: campo central da Início). */
export const OPEN_SEARCH_EVENT = "omnia:open-search";

export type SearchScope = "all" | "messages" | "amor";

/** Abre a busca global; `scope: "messages"` mostra só mensagens (Scripts), `"amor"` só o Amor Saúde. */
export function openGlobalSearch(query = "", scope: SearchScope = "all") {
  window.dispatchEvent(new CustomEvent<{ query: string; scope: SearchScope }>(OPEN_SEARCH_EVENT, { detail: { query, scope } }));
}

const AMOR_KEYS: string[] = ["pricing", "exames", "procedimentos", "clinicas"];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setScope("all");
        setOpen((o) => !o);
      }
    };
    const openWith = (e: Event) => {
      const detail = (e as CustomEvent<{ query?: string; scope?: SearchScope }>).detail;
      setQuery(detail?.query ?? "");
      setScope(detail?.scope ?? "all");
      setOpen(true);
    };
    window.addEventListener("keydown", handler);
    window.addEventListener(OPEN_SEARCH_EVENT, openWith);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(OPEN_SEARCH_EVENT, openWith);
    };
  }, []);

  // Fechou: a próxima abertura começa limpa.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const lcProb = useServerFn(listContent);
  const lcTut = useServerFn(listContent);
  const lKnowledge = useServerFn(listKnowledge);
  const lsMessages = useServerFn(listMessages);
  const lpPricing = useServerFn(listPricing);
  const lProfiles = useServerFn(listClientProfilesForTraining);
  const lCats = useServerFn(listAllCategories);
  const lMetas = useServerFn(listMetas);
  const lUnidades = useServerFn(listUnidades);
  const lExames = useServerFn(listExames);
  const lProced = useServerFn(listProcedimentos);
  const lChangelog = useServerFn(listChangelog);
  const lContatos = useServerFn(listContatos);

  const knowledge = useQuery({ queryKey: ["sg-knowledge"], queryFn: () => lKnowledge({}), enabled: open });
  const prob = useQuery({ queryKey: ["sg-prob"], queryFn: () => lcProb({ data: { section: "problemas" } }), enabled: open });
  const tut = useQuery({ queryKey: ["sg-tut"], queryFn: () => lcTut({ data: { section: "tutoriais" } }), enabled: open });
  const messages = useQuery({ queryKey: ["sg-messages"], queryFn: () => lsMessages({}), enabled: open });
  const pricing = useQuery({ queryKey: ["sg-pricing"], queryFn: () => lpPricing({}), enabled: open });
  const profiles = useQuery({ queryKey: ["sg-profiles"], queryFn: () => lProfiles({}), enabled: open });
  const cats = useQuery({ queryKey: ["sg-cats"], queryFn: () => lCats({}), enabled: open });
  // Funcionários/Metas é restrito a admin — pra quem não é admin essa consulta simplesmente
  // falha silenciosamente (React Query não propaga o erro pra UI) e o grupo não aparece.
  const metas = useQuery({ queryKey: ["sg-metas"], queryFn: () => lMetas({}), enabled: open, retry: false });
  const unidades = useQuery({ queryKey: ["sg-unidades"], queryFn: () => lUnidades({}), enabled: open });
  const exames = useQuery({ queryKey: ["sg-exames"], queryFn: () => lExames({}), enabled: open });
  const procedimentos = useQuery({ queryKey: ["sg-procedimentos"], queryFn: () => lProced({}), enabled: open });
  const changelog = useQuery({ queryKey: ["sg-changelog"], queryFn: () => lChangelog({}), enabled: open });
  const contatos = useQuery({ queryKey: ["sg-contatos"], queryFn: () => lContatos({}), enabled: open });

  type Item = { id: string; title: string; preview: string; icon: typeof BookOpen; route: string; search?: Record<string, string> };
  type ContentSearchRow = { id: string; title: string; content: string };
  type KnowledgeSearchRow = { id: string; title: string; content: string; summary: string | null };
  type MessageSearchRow = { id: string; title: string; content: string; shortcut?: string | null; category?: { id: string; name: string } | null; subcategory?: { id: string; name: string } | null };
  type PricingSearchRow = { id: string; specialty: string; category: string; cartao_price: number | null };
  type ProfileSearchRow = { id: string; name: string; difficulty: string; category?: { name: string } | null };
  type CategorySearchRow = { id: string; name: string; scope: string };
  type MetaSearchRow = { nome: string; mes_referencia: string };
  type UnidadeSearchRow = { id: string; nome: string; cidade: string | null; estado: string | null };
  type ExameSearchRow = { id: string; nome: string; tipo: string; categoria: string | null };
  type ProcedimentoSearchRow = { id: string; nome: string; categoria: string | null };
  type ChangelogSearchRow = { id: string; title: string; summary: string; published: boolean };
  type ClinicaSearchRow = { id: string; tipo: string; nome_regiao: string; regiao?: string | null; endereco: string | null };

  const items = useMemo(() => ({
    // Abre a mensagem direto na Biblioteca, já selecionada.
    messages: ((messages.data ?? []) as MessageSearchRow[]).map((r) => ({
      id: r.id,
      title: r.shortcut ? `${r.title} /${r.shortcut}` : r.title,
      preview: r.category?.name ? `${r.category.name} · ${r.content.slice(0, 60)}` : r.content.slice(0, 80),
      icon: MessageSquareQuote,
      route: "/scripts/biblioteca",
      search: {
        msg: r.id,
        ...(r.category?.id ? { categoria: r.category.id } : {}),
        ...(r.subcategory?.id ? { sub: r.subcategory.id } : {}),
      },
    })),
    knowledge: ((knowledge.data ?? []) as KnowledgeSearchRow[]).map((r) => ({ id: r.id, title: r.title, preview: (r.summary || r.content).slice(0, 80), icon: BookOpen, route: "/conhecimento" })),
    // Amor Saúde: abre o item direto na subpágina certa.
    pricing: ((pricing.data ?? []) as PricingSearchRow[]).map((r) => ({ id: r.id, title: r.specialty, preview: `Consulta${r.cartao_price != null ? ` · R$ ${Number(r.cartao_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} no Cartão` : ""}`, icon: DollarSign, route: "/amor-saude/consultas", search: { item: r.id } })),
    clinicas: ((contatos.data ?? []) as ClinicaSearchRow[]).filter((r) => r.tipo === "clinica_amor_saude").map((r) => ({ id: r.id, title: r.nome_regiao, preview: [r.regiao, r.endereco].filter(Boolean).join(" · ") || "Clínica Amor Saúde", icon: Hospital, route: "/amor-saude/clinicas", search: { item: r.id } })),
    problems: ((prob.data ?? []) as ContentSearchRow[]).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: Wrench, route: "/problemas" })),
    tutorials: ((tut.data ?? []) as ContentSearchRow[]).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: GraduationCap, route: "/tutoriais" })),
    profiles: ((profiles.data ?? []) as ProfileSearchRow[]).map((r) => ({ id: r.id, title: r.name, preview: r.category?.name ? `${r.category.name} · dificuldade ${r.difficulty}` : `Dificuldade ${r.difficulty}`, icon: Users, route: "/simulador-ia" })),
    categories: ((cats.data ?? []) as CategorySearchRow[]).map((r) => ({ id: r.id, title: r.name, preview: `Categoria · ${r.scope}`, icon: Tag, route: "/admin" })),
    metas: ((metas.data ?? []) as MetaSearchRow[]).map((r) => ({ id: r.nome, title: r.nome, preview: `Meta de ${r.mes_referencia}`, icon: UserCog, route: "/funcionarios" })),
    unidades: ((unidades.data ?? []) as UnidadeSearchRow[]).map((r) => ({ id: r.id, title: r.nome, preview: [r.cidade, r.estado].filter(Boolean).join("/") || "Unidade", icon: MapPin, route: "/admin" })),
    exames: ((exames.data ?? []) as ExameSearchRow[]).map((r) => ({ id: r.id, title: r.nome, preview: `${r.tipo === "imagem" ? "Imagem" : "Laboratorial"}${r.categoria ? ` · ${r.categoria}` : ""}`, icon: FlaskConical, route: "/amor-saude/exames", search: { item: r.id } })),
    procedimentos: ((procedimentos.data ?? []) as ProcedimentoSearchRow[]).map((r) => ({ id: r.id, title: r.nome, preview: r.categoria ?? "Procedimento odontológico", icon: Stethoscope, route: "/amor-saude/odontologia", search: { item: r.id } })),
    changelog: ((changelog.data ?? []) as ChangelogSearchRow[]).filter((r) => r.published).map((r) => ({ id: r.id, title: r.title, preview: r.summary.slice(0, 80), icon: Star, route: "/" })),
  } satisfies Record<string, Item[]>), [
    messages.data, knowledge.data, pricing.data, prob.data, tut.data, profiles.data,
    cats.data, metas.data, unidades.data, exames.data, procedimentos.data, changelog.data, contatos.data,
  ]);

  const go = (path: string, search?: Record<string, string>) => {
    setOpen(false);
    navigate({ to: path, search: search as never });
  };

  const askMarciana = () => {
    const pergunta = query.trim();
    if (!pergunta) return;
    setOpen(false);
    navigate({ to: "/assistente", search: { pergunta } });
  };

  const groups: { key: keyof typeof items; heading: string; limit: number }[] = [
    { key: "messages", heading: "Scripts / Mensagens", limit: 8 },
    { key: "knowledge", heading: "Base de Conhecimento", limit: 6 },
    { key: "pricing", heading: "Amor Saúde · Consultas", limit: 6 },
    { key: "exames", heading: "Amor Saúde · Exames", limit: 6 },
    { key: "procedimentos", heading: "Amor Saúde · Odontologia", limit: 6 },
    { key: "clinicas", heading: "Amor Saúde · Clínicas", limit: 6 },
    { key: "profiles", heading: "Perfis de Cliente", limit: 6 },
    { key: "unidades", heading: "Unidades", limit: 6 },
    { key: "categories", heading: "Categorias", limit: 6 },
    { key: "metas", heading: "Funcionários", limit: 6 },
    { key: "changelog", heading: "Novidades", limit: 6 },
    { key: "problems", heading: "Problemas Técnicos", limit: 6 },
    { key: "tutorials", heading: "Tutoriais", limit: 6 },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={
          scope === "messages" ? "Buscar mensagem pelo nome, texto ou atalho…"
            : scope === "amor" ? "Buscar especialidade, exame, procedimento ou clínica…"
              : "Buscar em scripts, conhecimento, preços, perfis, unidades..."
        }
      />
      <CommandList>
        <CommandEmpty>
          {[messages, knowledge, pricing, unidades, exames, procedimentos].some((q) => q.isLoading)
            ? "Carregando conteúdo…"
            : "Nenhum resultado. Tente outra palavra."}
        </CommandEmpty>
        {groups.map(({ key, heading, limit }) => {
          if (scope === "messages" && key !== "messages") return null;
          if (scope === "amor" && !AMOR_KEYS.includes(key)) return null;
          const list = items[key] as Item[];
          if (list.length === 0) return null;
          return (
            <CommandGroup key={key} heading={heading}>
              {list.slice(0, scope === "all" ? limit : 50).map((i) => (
                <CommandItem key={i.id} onSelect={() => go(i.route, (i as Item).search)} value={`${key} ${i.title} ${i.preview}`}>
                  <i.icon className="h-4 w-4 text-gold-text" />
                  <div className="flex flex-col">
                    <span className="font-medium">{i.title}</span>
                    <span className="text-xs text-muted-foreground truncate">{i.preview}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        {query.trim() && scope === "all" && (
          <CommandGroup heading="MarcIAna" forceMount>
            <CommandItem forceMount value="__perguntar-marciana" onSelect={askMarciana}>
              <Bot className="h-4 w-4 text-gold-text" />
              <span className="min-w-0 truncate">
                Perguntar à MarcIAna: <span className="font-medium">“{query.trim()}”</span>
              </span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
