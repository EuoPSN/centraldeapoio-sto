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
import { listTelemedicina } from "@/lib/telemedicina.functions";
import { listDuvidas } from "@/lib/duvidas.functions";
import { listRoteirosAudio, listRoteirosLigacao } from "@/lib/roteiros.functions";
import { listProcedimentos } from "@/lib/odontologia.functions";
import { listChangelog } from "@/lib/changelog.functions";
import { listContatos } from "@/lib/contatos.functions";
import {
  BookOpen, DollarSign, GraduationCap, MessageSquareQuote, Wrench,
  Users, Tag, UserCog, MapPin, FlaskConical, Stethoscope, Star, Bot, Hospital, Video, AudioLines, PhoneCall, Building2, LifeBuoy, MessageCircleQuestion,
} from "lucide-react";

/** Evento para abrir a busca global já com um texto (ex.: campo central da Início). */
function normalizeText(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export const OPEN_SEARCH_EVENT = "omnia:open-search";

export type SearchScope = "all" | "messages" | "amor";

/** Abre a busca global; `scope: "messages"` mostra só mensagens (Scripts), `"amor"` só o Amor Saúde. */
export function openGlobalSearch(query = "", scope: SearchScope = "all", opts: { clienteDisse?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent<{ query: string; scope: SearchScope; clienteDisse?: boolean }>(OPEN_SEARCH_EVENT, { detail: { query, scope, clienteDisse: opts.clienteDisse } }));
}

const AMOR_KEYS: string[] = ["pricing", "exames", "procedimentos", "telemedicina", "duvidas", "clinicas"];
const SCRIPTS_KEYS: string[] = ["messages", "roteirosAudio", "roteirosLigacao"];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  // Aberta pela busca central da Início: oferece "O cliente disse…" para falas longas.
  const [clienteDisse, setClienteDisse] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setScope("all");
        setClienteDisse(false);
        setOpen((o) => !o);
      }
    };
    const openWith = (e: Event) => {
      const detail = (e as CustomEvent<{ query?: string; scope?: SearchScope; clienteDisse?: boolean }>).detail;
      setQuery(detail?.query ?? "");
      setScope(detail?.scope ?? "all");
      setClienteDisse(!!detail?.clienteDisse);
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
  const lTele = useServerFn(listTelemedicina);
  const lDuv = useServerFn(listDuvidas);
  const lAudio = useServerFn(listRoteirosAudio);
  const lLig = useServerFn(listRoteirosLigacao);
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
  const telemedicina = useQuery({ queryKey: ["sg-telemedicina"], queryFn: () => lTele({}), enabled: open, retry: false });
  // Dúvidas e roteiros: o banco só entrega ao atendente o que está publicado (e, na ligação, só com a chave ligada).
  const duvidas = useQuery({ queryKey: ["sg-duvidas"], queryFn: () => lDuv({}), enabled: open, retry: false });
  const roteirosAudio = useQuery({ queryKey: ["sg-roteiros-audio"], queryFn: () => lAudio({}), enabled: open, retry: false });
  const roteirosLigacao = useQuery({ queryKey: ["sg-roteiros-ligacao"], queryFn: () => lLig({}), enabled: open, retry: false });
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
  type DuvidaSearchRow = { id: string; tema: string; pergunta: string; resposta: string; status: string };
  type RoteiroSearchRow = { id: string; titulo: string; texto: string; status: string; categoria?: string; etapa?: string };
  type TeleSearchRow = { id: string; nome: string; tipo: string; ativo?: boolean };
  type ProcedimentoSearchRow = { id: string; nome: string; categoria: string | null };
  type ChangelogSearchRow = { id: string; title: string; summary: string; published: boolean };
  type ClinicaSearchRow = { id: string; tipo: string; nome_regiao: string; regiao?: string | null; endereco: string | null };
  type ContatoSearchRow = { id: string; tipo: string; nome_regiao: string; bairro?: string | null; cidade?: string | null; subtitulo?: string | null };

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
    unidadesCdt: ((contatos.data ?? []) as ContatoSearchRow[]).filter((r) => r.tipo === "cartao_de_todos").map((r) => ({ id: r.id, title: r.nome_regiao, preview: [r.bairro, r.cidade].filter(Boolean).join(" · ") || "Unidade Cartão de TODOS", icon: Building2, route: "/contatos", search: { item: r.id } })),
    suporte: ((contatos.data ?? []) as ContatoSearchRow[]).filter((r) => r.tipo === "outros").map((r) => ({ id: r.id, title: r.nome_regiao, preview: r.subtitulo || "Suporte e setores", icon: LifeBuoy, route: "/contatos", search: { item: r.id } })),
    problems: ((prob.data ?? []) as ContentSearchRow[]).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: Wrench, route: "/problemas" })),
    tutorials: ((tut.data ?? []) as ContentSearchRow[]).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: GraduationCap, route: "/tutoriais" })),
    profiles: ((profiles.data ?? []) as ProfileSearchRow[]).map((r) => ({ id: r.id, title: r.name, preview: r.category?.name ? `${r.category.name} · dificuldade ${r.difficulty}` : `Dificuldade ${r.difficulty}`, icon: Users, route: "/simulador-ia" })),
    categories: ((cats.data ?? []) as CategorySearchRow[]).map((r) => ({ id: r.id, title: r.name, preview: `Categoria · ${r.scope}`, icon: Tag, route: "/admin" })),
    metas: ((metas.data ?? []) as MetaSearchRow[]).map((r) => ({ id: r.nome, title: r.nome, preview: `Meta de ${r.mes_referencia}`, icon: UserCog, route: "/funcionarios" })),
    unidades: ((unidades.data ?? []) as UnidadeSearchRow[]).map((r) => ({ id: r.id, title: r.nome, preview: [r.cidade, r.estado].filter(Boolean).join("/") || "Unidade", icon: MapPin, route: "/admin" })),
    exames: ((exames.data ?? []) as ExameSearchRow[]).map((r) => ({ id: r.id, title: r.nome, preview: `${r.tipo === "imagem" ? "Imagem" : "Laboratorial"}${r.categoria ? ` · ${r.categoria}` : ""}`, icon: FlaskConical, route: "/amor-saude/exames", search: { item: r.id } })),
    telemedicina: ((telemedicina.data ?? []) as TeleSearchRow[]).filter((r) => r.ativo !== false).map((r) => ({
      id: r.id,
      title: r.tipo === "pa_digital" ? `PA digital · ${r.nome}` : `Teleconsulta · ${r.nome}`,
      preview: r.tipo === "pa_digital" ? "Pronto atendimento por vídeo" : "Consulta por vídeo, agendada",
      icon: Video,
      route: "/amor-saude/telemedicina",
      search: { item: r.id },
    })),
    duvidas: ((duvidas.data ?? []) as DuvidaSearchRow[]).filter((r) => r.status === "publicada").map((r) => ({
      id: r.id, title: r.pergunta, preview: `${r.tema} · ${r.resposta.slice(0, 70)}`, icon: MessageCircleQuestion,
      route: "/amor-saude/duvidas", search: { duvida: r.id },
    })),
    roteirosAudio: ((roteirosAudio.data?.roteiros ?? []) as RoteiroSearchRow[]).filter((r) => r.status === "publicada").map((r) => ({
      id: r.id, title: r.titulo, preview: `Roteiro de áudio${r.categoria ? ` · ${r.categoria}` : ""}`, icon: AudioLines,
      route: "/scripts/roteiros-audio", search: { item: r.id },
    })),
    roteirosLigacao: ((roteirosLigacao.data ?? []) as RoteiroSearchRow[]).filter((r) => r.status === "publicada").map((r) => ({
      id: r.id, title: r.titulo, preview: `Script de ligação${r.etapa ? ` · ${r.etapa}` : ""}`, icon: PhoneCall,
      route: "/scripts/ligacao", search: { item: r.id },
    })),
    procedimentos: ((procedimentos.data ?? []) as ProcedimentoSearchRow[]).map((r) => ({ id: r.id, title: r.nome, preview: r.categoria ?? "Procedimento odontológico", icon: Stethoscope, route: "/amor-saude/odontologia", search: { item: r.id } })),
    changelog: ((changelog.data ?? []) as ChangelogSearchRow[]).filter((r) => r.published).map((r) => ({ id: r.id, title: r.title, preview: r.summary.slice(0, 80), icon: Star, route: "/" })),
  } satisfies Record<string, Item[]>), [
    messages.data, knowledge.data, pricing.data, prob.data, tut.data, profiles.data,
    cats.data, metas.data, unidades.data, exames.data, telemedicina.data, duvidas.data, roteirosAudio.data, roteirosLigacao.data, procedimentos.data, changelog.data, contatos.data,
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

  // "O cliente disse": mais de 3 palavras e nenhum resultado com o texto exato.
  const falaCliente = query.trim();
  const temExato = useMemo(() => {
    const n = normalizeText(falaCliente);
    if (!n) return false;
    return Object.values(items).some((list) => (list as Item[]).some((i) => normalizeText(`${i.title} ${i.preview}`).includes(n)));
  }, [items, falaCliente]);
  const mostrarClienteDisse = clienteDisse && scope === "all" && falaCliente.split(/\s+/).filter(Boolean).length > 3 && !temExato;
  const abrirClienteDisse = () => {
    setOpen(false);
    navigate({ to: "/scripts/cliente-disse", search: { aba: "objecoes", fala: falaCliente } });
  };

  const groups: { key: keyof typeof items; heading: string; limit: number }[] = [
    { key: "messages", heading: "Scripts / Mensagens", limit: 8 },
    { key: "knowledge", heading: "Base de Conhecimento", limit: 6 },
    { key: "pricing", heading: "Amor Saúde · Consultas", limit: 6 },
    { key: "exames", heading: "Amor Saúde · Exames", limit: 6 },
    { key: "procedimentos", heading: "Amor Saúde · Odontologia", limit: 6 },
    { key: "telemedicina", heading: "Amor Saúde · Teleconsulta e PA digital", limit: 6 },
    { key: "duvidas", heading: "Amor Saúde · Dúvidas frequentes", limit: 6 },
    { key: "roteirosAudio", heading: "Scripts · Roteiros de áudio", limit: 6 },
    { key: "roteirosLigacao", heading: "Scripts · Scripts de ligação", limit: 6 },
    { key: "clinicas", heading: "Amor Saúde · Clínicas", limit: 6 },
    { key: "profiles", heading: "Perfis de Cliente", limit: 6 },
    { key: "unidades", heading: "Unidades", limit: 6 },
    { key: "unidadesCdt", heading: "Contatos · Unidades CDT", limit: 6 },
    { key: "suporte", heading: "Contatos · Suporte e setores", limit: 6 },
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
        {mostrarClienteDisse && (
          <CommandGroup heading="O cliente disse" forceMount>
            <CommandItem forceMount value={falaCliente} onSelect={abrirClienteDisse}>
              <MessageCircleQuestion className="h-4 w-4 text-gold-text" />
              <span className="min-w-0 truncate">
                O cliente disse: <span className="font-medium">“{falaCliente}”</span>
              </span>
              <span className="ml-auto shrink-0 text-xs font-semibold text-gold-text">ver resposta →</span>
            </CommandItem>
          </CommandGroup>
        )}
        <CommandEmpty>
          {[messages, knowledge, pricing, unidades, exames, procedimentos].some((q) => q.isLoading)
            ? "Carregando conteúdo…"
            : "Nenhum resultado. Tente outra palavra."}
        </CommandEmpty>
        {groups.map(({ key, heading, limit }) => {
          if (scope === "messages" && !SCRIPTS_KEYS.includes(key)) return null;
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
