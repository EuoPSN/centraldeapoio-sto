import { Link, useRouterState } from "@tanstack/react-router";

// Rota do site → seção correspondente do Admin (chave usada em /admin/<chave>).
// Checado do prefixo mais específico pro mais genérico. Página sem seção
// correspondente (Ranking, Criar Scripts, o próprio Admin...) não mostra o link.
const ROUTE_TO_ADMIN_SECTION: [string, string][] = [
  ["/amor-saude", "pricing"],
  ["/scripts/cliente-disse", "objecoes"],
  ["/scripts", "messages"],
  ["/assistente", "marciana"],
  ["/simulador-ia", "perfis"],
  ["/contatos", "contatos"],
  ["/biblioteca", "imagelibrary"],
  ["/treinamentos", "treinamentos"],
  ["/checklist", "checklist"],
  ["/problemas", "problemastecnicos"],
  ["/tutoriais", "procedimentos"],
  ["/sugestoes", "suggestions"],
];

function sectionFor(pathname: string): string | null {
  if (pathname === "/") return "homemsg";
  const hit = ROUTE_TO_ADMIN_SECTION
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? null;
}

/** Link dourado "Editar" no topo, só para admin, que abre a seção do Admin
 * correspondente à página atual (vazio quando a página não tem uma). */
export function EditPageLink({ isAdmin }: { isAdmin: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!isAdmin) return null;
  const section = sectionFor(pathname);
  if (!section) return null;
  return (
    <Link
      to="/admin/$key"
      params={{ key: section }}
      className="shrink-0 text-sm font-medium text-gold-text hover:underline"
    >
      Editar
    </Link>
  );
}
