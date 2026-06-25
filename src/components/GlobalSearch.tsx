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
import { listContent, listScripts, listPricing } from "@/lib/content.functions";
import { BookOpen, DollarSign, GraduationCap, MessageSquareQuote, Wrench } from "lucide-react";

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
  const lsScripts = useServerFn(listScripts);
  const lpPricing = useServerFn(listPricing);

  const conh = useQuery({ queryKey: ["sg-conh"], queryFn: () => lcConh({ data: { section: "conhecimento" } }), enabled: open });
  const prob = useQuery({ queryKey: ["sg-prob"], queryFn: () => lcProb({ data: { section: "problemas" } }), enabled: open });
  const tut = useQuery({ queryKey: ["sg-tut"], queryFn: () => lcTut({ data: { section: "tutoriais" } }), enabled: open });
  const scripts = useQuery({ queryKey: ["sg-scripts"], queryFn: () => lsScripts({}), enabled: open });
  const pricing = useQuery({ queryKey: ["sg-pricing"], queryFn: () => lpPricing({}), enabled: open });

  type Item = { id: string; title: string; preview: string; icon: typeof BookOpen; route: string };
  const items = useMemo<{ knowledge: Item[]; scripts: Item[]; pricing: Item[]; problems: Item[]; tutorials: Item[] }>(() => ({
    knowledge: (conh.data ?? []).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: BookOpen, route: "/conhecimento" })),
    scripts: (scripts.data ?? []).map((r) => ({ id: r.id, title: r.title, preview: r.body.slice(0, 80), icon: MessageSquareQuote, route: "/scripts" })),
    pricing: (pricing.data ?? []).map((r) => ({ id: r.id, title: r.specialty, preview: `${r.category}${r.cartao_price ? ` · R$ ${Number(r.cartao_price).toFixed(2)}` : ""}`, icon: DollarSign, route: "/precos" })),
    problems: (prob.data ?? []).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: Wrench, route: "/problemas" })),
    tutorials: (tut.data ?? []).map((r) => ({ id: r.id, title: r.title, preview: r.content.slice(0, 80), icon: GraduationCap, route: "/tutoriais" })),
  }), [conh.data, scripts.data, pricing.data, prob.data, tut.data]);

  const go = (path: string) => {
    setOpen(false);
    navigate({ to: path });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar em scripts, conhecimento, preços, tutoriais..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        {items.scripts.length > 0 && (
          <CommandGroup heading="Scripts">
            {items.scripts.slice(0, 8).map((i) => (
              <CommandItem key={i.id} onSelect={() => go(i.route)} value={`script ${i.title} ${i.preview}`}>
                <i.icon className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-medium">{i.title}</span>
                  <span className="text-xs text-muted-foreground truncate">{i.preview}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {items.knowledge.length > 0 && (
          <CommandGroup heading="Conhecimento Geral">
            {items.knowledge.slice(0, 6).map((i) => (
              <CommandItem key={i.id} onSelect={() => go(i.route)} value={`conh ${i.title} ${i.preview}`}>
                <i.icon className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-medium">{i.title}</span>
                  <span className="text-xs text-muted-foreground truncate">{i.preview}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {items.pricing.length > 0 && (
          <CommandGroup heading="Tabela de Preços">
            {items.pricing.slice(0, 6).map((i) => (
              <CommandItem key={i.id} onSelect={() => go(i.route)} value={`preco ${i.title}`}>
                <i.icon className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-medium">{i.title}</span>
                  <span className="text-xs text-muted-foreground truncate">{i.preview}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {items.problems.length > 0 && (
          <CommandGroup heading="Problemas Técnicos">
            {items.problems.slice(0, 6).map((i) => (
              <CommandItem key={i.id} onSelect={() => go(i.route)} value={`prob ${i.title}`}>
                <i.icon className="h-4 w-4 text-primary" />
                <span>{i.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {items.tutorials.length > 0 && (
          <CommandGroup heading="Tutoriais">
            {items.tutorials.slice(0, 6).map((i) => (
              <CommandItem key={i.id} onSelect={() => go(i.route)} value={`tut ${i.title}`}>
                <i.icon className="h-4 w-4 text-primary" />
                <span>{i.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
