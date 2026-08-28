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
import { listMessages } from "@/lib/messages.functions";
import { listClientProfilesForTraining } from "@/lib/clientprofiles.functions";
import { listAllCategories } from "@/lib/taxonomy.functions";
import { listMetas } from "@/lib/metas.functions";
import { listUnidades } from "@/lib/unidades.functions";
import { listExames } from "@/lib/exames.functions";
import { listProcedimentos } from "@/lib/odontologia.functions";
import { listChangelog } from "@/lib/changelog.functions";
import {
  BookOpen, DollarSign, GraduationCap, MessageSquareQuote, Wrench,
  Users, Tag, UserCog, MapPin, FlaskConical, Stethoscope, Star,
} from "lucide-react";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const lcConh = useServerFn(listContent);
  const lcProb = useServerFn(listContent);
  const lcTut = useServerFn(listContent);
  const lsMessages = useServerFn(listMessages);
  const lpPricing = useServerFn(listPricing);
  const lProfiles = useServerFn(listClientProfilesForTraining);
  const lCats = useServerFn(listAllCategories);
  const lMetas = useServerFn(listMetas);
  const lUnidades = useServerFn(listUnidades);
  const lExames = useServerFn(listExames);
  const lProced = useServerFn(listProcedimentos);
  const lChangelog = useServerFn(listChangelog);

  const conh = useQuery({ queryKey: ["sg-conh"], queryFn: () => lcConh({ data: { section: "conhecimento" } }), enabled: open });
  const prob = useQuery({ queryKey: ["sg-prob"], queryFn: () => lcProb({ data: { section: "problemas" } }), enabled: open });
  const tut = useQuery({ queryKey: ["sg-tut"], queryFn: () => lcTut({ data: { section: "tutoriais" } }), enabled: open });
  const messages = useQuery({ queryKey: ["sg-messages"], queryFn: () => lsMessages({}), enabled: open });
  const pricing = useQuery({ queryKey: ["sg-pricing"], queryFn: () => lpPricing({}), enabled: open });
  const profiles = useQuery({ queryKey: ["sg-profiles"], queryFn: () => lProfiles({}), enabled: open });
  const cats = useQuery({ queryKey: ["sg-cats"], queryFn: () => lCats({}), enabled: open });
  // Funcionários/Metas é restrito a admin — para quem não é admin essa consulta simplesmente
  // falha silenciosamente (React Query não propaga o erro pra UI) e o grupo não aparece.
  const metas = useQuery({ queryKey: ["sg-metas"], queryFn: () => lMetas({}), enabled: open, retry: false });
  const unidades = useQuery({ queryKey: ["sg-unidades"], queryFn: () => lUnidades({}), enabled: open });
  const exames = useQuery({ queryKey: ["sg-exames"], queryFn: () => lExames({}), enabled: open });
  const procedimentos = useQuery({ queryKey: ["sg-procedimentos"], queryFn: () => lProced({}), enabled: open });
  const changelog = useQuery({ queryKey: ["sg-changelog"], queryFn: () => lChangelog({}), enabled: open });

  type Item = { id: string; title: string; preview: string; icon: typeof BookOpen; route: string };
  type ContentSearchRow = { id: string; title: string; content: string };
  type MessageSearchRow = { id: string; title: string; content: string; category?: { name: string } | null };
  type PricingSearchRow = { id: string; specialty: string; category: string; cartao_price: number | null };
  type ProfileSearchRow = { id: string; name: string; difficulty: string; category?: { name: string } | null };
  type CategorySearchRow = { id: string; name: string; scope: string };
  type MetaSearchRow = { nome: string; mes_referencia: string };
  type UnidadeSearchRow = { id: string; nome: string; cidade: string | null; estado: string | null };
  type ExameSearchRow = { id: string; nome: string; tipo: string; categoria: string | null };
  type ProcedimentoSearchRow = { id: string; nome: string; categoria: string | null };
  type ChangelogSearchRow = { id: string; title: string; summary: string; published: boolean };

  const items = useMemo(() => ({
    messages: ((messages.data ?? []) as MessageSearchRow[]).map((r) => ({ id: r.id, title: r.title, preview: r.category?.name ? `${r.category.name} · ${r.content.slice(0, 60)}` : r.content.slice(0, 80), icon: MessageSquareQuote, route: "/scripts" })),
    knowledge: ((conh.data ?? []) as ContentSearchRow[]).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: BookOpen, route: "/conhecimento" })),
    pricing: ((pricing.data ?? []) as PricingSearchRow[]).map((r) => ({ id: r.id, title: r.specialty, preview: `${r.category}${r.cartao_price ? ` · R$ ${Number(r.cartao_price).toFixed(2)}` : ""}`, icon: DollarSign, route: "/precos" })),
    problems: ((prob.data ?? []) as ContentSearchRow[]).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: Wrench, route: "/problemas" })),
    tutorials: ((tut.data ?? []) as ContentSearchRow[]).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: GraduationCap, route: "/tutoriais" })),
    profiles: ((profiles.data ?? []) as ProfileSearchRow[]).map((r) => ({ id: r.id, title: r.name, preview: r.category?.name ? `${r.category.name} · dificuldade ${r.difficulty}` : `Dificuldade ${r.difficulty}`, icon: Users, route: "/simulador-ia" })),
    categories: ((cats.data ?? []) as CategorySearchRow[]).map((r) => ({ id: r.id, title: r.name, preview: `Categoria · ${r.scope}`, icon: Tag, route: "/admin" })),
    metas: ((metas.data ?? []) as MetaSearchRow[]).map((r) => ({ id: r.nome, title: r.nome, preview: `Meta de ${r.mes_referencia}`, icon: UserCog, route: "/funcionarios" })),
    unidades: ((unidades.data ?? []) as UnidadeSearchRow[]).map((r) => ({ id: r.id, title: r.nome, preview: [r.cidade, r.estado].filter(Boolean).join("/") || "Unidade", icon: MapPin, route: "/admin" })),
    exames: ((exames.data ?? []) as ExameSearchRow[]).map((r) => ({ id: r.id, title: r.nome, preview: `${r.tipo === "imagem" ? "Imagem" : "Laboratorial"}${r.categoria ? ` · ${r.categoria}` : ""}`, icon: FlaskConical, route: "/precos" })),
    procedimentos: ((procedimentos.data ?? []) as ProcedimentoSearchRow[]).map((r) => ({ id: r.id, title: r.nome, preview: r.categoria ?? "Procedimento odontológico", icon: Stethoscope, route: "/precos" })),
    changelog: ((changelog.data ?? []) as ChangelogSearchRow[]).filter((r) => r.published).map((r) => ({ id: r.id, title: r.title, preview: r.summary.slice(0, 80), icon: Star, route: "/" })),
  } satisfies Record<string, Item[]>), [
    messages.data, conh.data, pricing.data, prob.data, tut.data, profiles.data,
    cats.data, metas.data, unidades.data, exames.data, procedimentos.data, changelog.data,
  ]);

  const go = (path: string) => {
    setOpen(false);
    navigate({ to: path });
  };

  const groups: { key: keyof typeof items; heading: string; limit: number }[] = [
    { key: "messages", heading: "Scripts / Mensagens", limit: 8 },
    { key: "knowledge", heading: "Conhecimento Geral", limit: 6 },
    { key: "pricing", heading: "Tabela de Preços", limit: 6 },
    { key: "exames", heading: "Exames", limit: 6 },
    { key: "procedimentos", heading: "Procedimentos Odontológicos", limit: 6 },
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
      <CommandInput placeholder="Buscar em scripts, conhecimento, preços, perfis, unidades..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        {groups.map(({ key, heading, limit }) => {
          const list = items[key];
          if (list.length === 0) return null;
          return (
            <CommandGroup key={key} heading={heading}>
              {list.slice(0, limit).map((i) => (
                <CommandItem key={i.id} onSelect={() => go(i.route)} value={`${key} ${i.title} ${i.preview}`}>
                  <i.icon className="h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium">{i.title}</span>
                    <span className="text-xs text-muted-foreground truncate">{i.preview}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
