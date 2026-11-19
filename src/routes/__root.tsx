import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { RouteLoadingOverlay } from "@/components/RouteLoadingOverlay";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-5xl font-bold tracking-tight text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Algo deu errado ao carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente recarregar ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OMNIA Apoio" },
      {
        name: "description",
        content:
          "OMNIA Apoio: scripts, preços e a MarcIAna para a equipe de Venda Interna.",
      },
      { property: "og:title", content: "OMNIA Apoio" },
      { name: "twitter:title", content: "OMNIA Apoio" },
      { name: "description", content: "OMNIA Apoio: scripts, preços e a MarcIAna para a equipe de Venda Interna." },
      { property: "og:description", content: "OMNIA Apoio: scripts, preços e a MarcIAna para a equipe de Venda Interna." },
      { name: "twitter:description", content: "OMNIA Apoio: scripts, preços e a MarcIAna para a equipe de Venda Interna." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/46f60b4a-ed72-4672-98df-d3b31dca7bd8/id-preview-d33fb85a--4b742393-3645-4ee4-ac37-09246ab18a0f.lovable.app-1782407255174.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/46f60b4a-ed72-4672-98df-d3b31dca7bd8/id-preview-d33fb85a--4b742393-3645-4ee4-ac37-09246ab18a0f.lovable.app-1782407255174.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
     links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        // OMNIA: Cinzel (nome, saudação e títulos institucionais, sempre em
        // caixa alta) e Montserrat (todo o resto). Barlow Condensed fica só
        // no numeral da etiqueta de preço.
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Montserrat:wght@300;400;500;600&family=Barlow+Condensed:wght@700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&family=Playfair+Display:wght@600;700&family=Fredoka:wght@500;700&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <RouteLoadingOverlay />
      <Toaster richColors closeButton position="top-right" />
    </QueryClientProvider>
  );
}
