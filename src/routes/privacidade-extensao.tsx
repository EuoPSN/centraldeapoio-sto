import { createFileRoute } from "@tanstack/react-router";
import { OmniaSymbol } from "@/components/OmniaLogo";
import {
  PRIVACIDADE_ATUALIZADA, PRIVACIDADE_CONTATO, PRIVACIDADE_INTRO, PRIVACIDADE_SECOES,
} from "@/lib/privacidade-extensao";

// Página PÚBLICA (sem login): política de privacidade da extensão do Chrome.
// O endereço desta página é o que vai no campo de política da Chrome Web Store.
export const Route = createFileRoute("/privacidade-extensao")({
  head: () => ({
    meta: [
      { title: "Privacidade da extensão — OMNIA Apoio" },
      { name: "description", content: "O que a extensão OMNIA Apoio para WhatsApp Web lê, envia e guarda, em linguagem simples." },
    ],
  }),
  component: PrivacidadeExtensao,
});

function PrivacidadeExtensao() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <div className="flex items-center gap-3">
          <OmniaSymbol size={36} />
          <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">OMNIA Apoio</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">Política de privacidade da extensão OMNIA Apoio para WhatsApp Web</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {PRIVACIDADE_ATUALIZADA}</p>
        <p className="mt-6 text-[15px] leading-relaxed">{PRIVACIDADE_INTRO}</p>

        {PRIVACIDADE_SECOES.map((s) => (
          <section key={s.titulo} className="mt-9">
            <h2 className="text-lg font-semibold">{s.titulo}</h2>
            {s.paragrafos?.map((p) => (
              <p key={p} className="mt-2 text-[15px] leading-relaxed">{p.replace("{contato}", PRIVACIDADE_CONTATO)}</p>
            ))}
            {s.itens && (
              <ul className="mt-2 list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
                {s.itens.map((i) => <li key={i}>{i}</li>)}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
