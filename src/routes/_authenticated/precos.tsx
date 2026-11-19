import { createFileRoute, redirect } from "@tanstack/react-router";

// A antiga "Tabela de Preços" agora é o Amor Saúde. Links antigos continuam
// funcionando e mantêm a aba (?aba=exames, ?tab=odontologia…) e o item.
const ABAS: Record<string, string> = {
  consultas: "/amor-saude/consultas",
  consulta: "/amor-saude/consultas",
  precos: "/amor-saude/consultas",
  exames: "/amor-saude/exames",
  exame: "/amor-saude/exames",
  odontologia: "/amor-saude/odontologia",
  odonto: "/amor-saude/odontologia",
  procedimentos: "/amor-saude/odontologia",
  clinicas: "/amor-saude/clinicas",
  unidades: "/amor-saude/clinicas",
};
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/_authenticated/precos")({
  beforeLoad: ({ search }) => {
    const s = search as Record<string, unknown>;
    const aba = (str(s.aba) ?? str(s.tab) ?? str(s.modo) ?? "").toLowerCase();
    const item = str(s.item);
    const to = ABAS[aba];
    if (to) throw redirect({ to, search: item ? { item } : {}, replace: true } as never);
    throw redirect({ to: "/amor-saude", replace: true });
  },
});
