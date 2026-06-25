import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, listScripts, listContent, listPricing } from "@/lib/content.functions";
import { BookOpen, Bot, DollarSign, GraduationCap, MessageSquareQuote, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

const shortcuts = [
  { title: "Scripts de Atendimento", desc: "Mensagens prontas para copiar", icon: MessageSquareQuote, route: "/scripts", color: "from-primary/20 to-primary/5" },
  { title: "Conhecimento Geral", desc: "Tudo sobre o Cartão de Todos", icon: BookOpen, route: "/conhecimento", color: "from-accent/30 to-accent/5" },
  { title: "Tabela de Preços", desc: "Especialidades e procedimentos", icon: DollarSign, route: "/precos", color: "from-primary/15 to-accent/10" },
  { title: "Problemas Técnicos", desc: "Soluções para o dia a dia", icon: Wrench, route: "/problemas", color: "from-warning/20 to-warning/5" },
  { title: "Tutoriais", desc: "Passo a passo de procedimentos", icon: GraduationCap, route: "/tutoriais", color: "from-primary/15 to-primary/5" },
  { title: "Assistente IA", desc: "Tire dúvidas durante o atendimento", icon: Bot, route: "/assistente", color: "from-primary/25 to-accent/15" },
] as const;

function Home() {
  const me = useServerFn(getMe);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => me({}) });

  const scripts = useServerFn(listScripts);
  const sQ = useQuery({ queryKey: ["scripts"], queryFn: () => scripts({}) });
  const pricing = useServerFn(listPricing);
  const pQ = useQuery({ queryKey: ["pricing"], queryFn: () => pricing({}) });
  const conh = useServerFn(listContent);
  const cQ = useQuery({ queryKey: ["content", "conhecimento"], queryFn: () => conh({ data: { section: "conhecimento" } }) });

  const name = meQ.data?.profile?.display_name ?? meQ.data?.email?.split("@")[0] ?? "";

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Olá{name ? `, ${name}` : ""} 👋</p>
        <h1 className="text-3xl font-bold mt-1">Bem-vindo à Central CDT</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Sua central de apoio para atendimentos. Tudo o que você precisa em um só lugar — e quando faltar algo, pergunte ao Assistente IA.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {shortcuts.map((s) => (
          <Link key={s.route} to={s.route} className="group">
            <Card className={`p-5 h-full transition-all hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 bg-gradient-to-br ${s.color} border-border`}>
              <s.icon className="h-7 w-7 text-primary mb-3" />
              <h3 className="font-semibold text-base">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Scripts cadastrados</p>
          <p className="text-3xl font-bold text-primary mt-1">{sQ.data?.length ?? 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Itens de preço</p>
          <p className="text-3xl font-bold text-primary mt-1">{pQ.data?.length ?? 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Conteúdos institucionais</p>
          <p className="text-3xl font-bold text-primary mt-1">{cQ.data?.length ?? 0}</p>
        </Card>
      </section>

      <section className="mt-10 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground p-6 md:p-8">
        <h2 className="text-xl font-semibold">Dica do dia</h2>
        <p className="mt-2 text-primary-foreground/90 max-w-2xl">
          Use <kbd className="rounded bg-white/20 px-2 py-0.5 text-xs">Ctrl + K</kbd> em qualquer página para buscar instantaneamente em scripts, preços, conhecimento e tutoriais.
        </p>
      </section>
    </div>
  );
}
