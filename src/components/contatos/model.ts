import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContatos, registerContatoUse } from "@/lib/contatos.functions";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ContatoTipo = "unidade" | "suporte";
export type Filtro = "todos" | "unidade" | "suporte";

export interface Contato {
  id: string;
  tipo: ContatoTipo;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  endereco: string | null;
  numero: string | null;
  pontoReferencia: string | null;
  horario: string | null;
  telefones: string[];
  mapsUrl: string | null;
  atendeTambem: string[];
  destaque: boolean;
  position: number;
  updatedAt: string | null;
  // Suporte e setores
  subtitulo: string | null;
  quandoIndicar: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function buildMapsUrl(c: { nome: string; endereco: string | null; numero: string | null; bairro: string | null; cidade: string | null }) {
  if (!c.endereco) return null;
  const q = [c.nome, [c.endereco, c.numero ? `nº ${c.numero}` : null].filter(Boolean).join(", "), c.bairro, c.cidade]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q).replace(/%20/g, "+")}`;
}

function mapRow(r: Raw): Contato {
  const nome = String(r.nome_regiao ?? "");
  const endereco = s(r.endereco);
  const numero = s(r.numero);
  const bairro = s(r.bairro);
  const cidade = s(r.cidade);
  return {
    id: String(r.id),
    tipo: r.tipo === "outros" ? "suporte" : "unidade",
    nome,
    bairro,
    cidade,
    endereco,
    numero,
    pontoReferencia: s(r.ponto_referencia),
    horario: s(r.horario),
    telefones: [r.contato1, r.contato2, r.contato3].map(s).filter((x): x is string => !!x),
    mapsUrl: s(r.maps_url) ?? buildMapsUrl({ nome, endereco, numero, bairro, cidade }),
    atendeTambem: Array.isArray(r.atende_tambem) ? (r.atende_tambem as unknown[]).filter((x): x is string => typeof x === "string" && !!x.trim()) : [],
    destaque: !!r.destaque,
    position: Number(r.position ?? 0),
    updatedAt: s(r.updated_at),
    subtitulo: s(r.subtitulo),
    quandoIndicar: s(r.quando_indicar),
    whatsapp: s(r.whatsapp),
    email: s(r.email),
    site: s(r.site),
  };
}

/** Todos os contatos, exceto as clínicas Amor Saúde (que ficam em Amor Saúde → Clínicas). */
export function useContatos() {
  const fn = useServerFn(listContatos);
  const q = useQuery({ queryKey: ["contatos"], queryFn: () => fn({}) });
  const contatos = useMemo(
    () => ((q.data ?? []) as Raw[]).filter((r) => r.tipo !== "clinica_amor_saude").map(mapRow),
    [q.data],
  );
  return { contatos, isLoading: q.isLoading, isError: q.isError };
}

/** Registra uma cópia (use_count; alimenta "mais procurados" no futuro). */
export function useCountContatoUse() {
  const fn = useServerFn(registerContatoUse);
  return (id: string) => {
    fn({ data: { id } }).catch(() => {});
  };
}

// ---------------------------------------------------------------------------
// Exibição
// ---------------------------------------------------------------------------

export function subtituloLinha(c: Contato) {
  return c.tipo === "unidade" ? [c.bairro, c.cidade].filter(Boolean).join(" · ") : (c.subtitulo ?? "");
}

export function telefonePrincipal(c: Contato) {
  return c.telefones[0] ?? null;
}

export function formatAtualizado(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Busca tolerante: ignora acento e maiúsculas/minúsculas.
export function norm(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
export function matches(query: string, ...fields: (string | null | undefined)[]) {
  const words = norm(query.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm(fields.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}

// ---------------------------------------------------------------------------
// Agrupamento e busca (lista)
// ---------------------------------------------------------------------------

export interface Grupo {
  label: string;
  itens: Contato[];
  /** Mostra "· N" no overline (só quando há mais de um grupo visível, como no esboço). */
  showCount: boolean;
}
export type Resultado =
  | { kind: "grupos"; grupos: Grupo[] }
  | { kind: "sem-unidade"; termo: string; itens: Contato[] }
  | { kind: "vazio"; termo: string };

const byPosicao = (a: Contato, b: Contato) => a.position - b.position || a.nome.localeCompare(b.nome, "pt-BR");

// Campos "de identidade" de uma unidade/suporte: nome, local e os textos do atendente.
const matchDireto = (c: Contato, q: string) => matches(q, c.nome, c.bairro, c.cidade, c.pontoReferencia, c.subtitulo, c.quandoIndicar);
const matchAtende = (c: Contato, q: string) => c.atendeTambem.some((t) => matches(q, t));

function agrupar(unidades: Contato[], suportes: Contato[], filtro: Filtro, contarSuporte: boolean): Grupo[] {
  const grupos: Grupo[] = [];
  if (filtro !== "suporte") {
    grupos.push({ label: "Unidades principais", itens: unidades.filter((c) => c.destaque).sort(byPosicao), showCount: false });
    grupos.push({ label: "Outras regiões", itens: unidades.filter((c) => !c.destaque).sort(byPosicao), showCount: false });
  }
  if (filtro !== "unidade") {
    grupos.push({ label: "Suporte e setores", itens: suportes.sort(byPosicao), showCount: contarSuporte });
  }
  return grupos.filter((g) => g.itens.length > 0);
}

/** Lista agrupada (sem busca) ou os três estados de busca descritos no esboço. */
export function buildResultado(contatos: Contato[], filtro: Filtro, query: string): Resultado {
  const unidades = contatos.filter((c) => c.tipo === "unidade");
  const suportes = contatos.filter((c) => c.tipo === "suporte");
  const q = query.trim();

  if (!q) return { kind: "grupos", grupos: agrupar(unidades, suportes, filtro, filtro === "todos") };

  const unidadesDiretas = filtro !== "suporte" ? unidades.filter((c) => matchDireto(c, q)) : [];
  const unidadesViaAtende = filtro !== "suporte" ? unidades.filter((c) => !matchDireto(c, q) && matchAtende(c, q)) : [];
  const suporteMatches = filtro !== "unidade" ? suportes.filter((c) => matchDireto(c, q) || matchAtende(c, q)) : [];

  // Não há unidade que bata direto, mas alguma atende a região buscada.
  if (filtro !== "suporte" && unidadesDiretas.length === 0 && unidadesViaAtende.length > 0) {
    return { kind: "sem-unidade", termo: q, itens: unidadesViaAtende.sort(byPosicao) };
  }
  if (unidadesDiretas.length + unidadesViaAtende.length + suporteMatches.length === 0) {
    return { kind: "vazio", termo: q };
  }
  return { kind: "grupos", grupos: agrupar([...unidadesDiretas, ...unidadesViaAtende], suporteMatches, filtro, filtro === "todos") };
}

/** Todos os itens visíveis, em ordem (para selecionar o primeiro e rolar até o item do link). */
export function flatten(resultado: Resultado): Contato[] {
  if (resultado.kind === "grupos") return resultado.grupos.flatMap((g) => g.itens);
  if (resultado.kind === "sem-unidade") return resultado.itens;
  return [];
}

// ---------------------------------------------------------------------------
// Textos para copiar
// ---------------------------------------------------------------------------

const linhas = (xs: (string | null | undefined | false)[]) => xs.filter(Boolean).join("\n");

function linhaEndereco(c: Contato) {
  if (!c.endereco) return null;
  return `${c.endereco}${c.numero ? `, nº ${c.numero}` : ""}${c.bairro ? ` – ${c.bairro}` : ""}`;
}

export function textoUnidade(c: Contato) {
  return linhas([
    `Cartão de TODOS – ${c.nome}`,
    linhaEndereco(c) && `Endereço: ${linhaEndereco(c)}`,
    c.pontoReferencia && `Ponto de referência: ${c.pontoReferencia}`,
    c.horario && `Horário: ${c.horario}`,
    c.telefones.length > 0 && `Telefone: ${c.telefones.join(" · ")}`,
    c.mapsUrl && `Como chegar: ${c.mapsUrl}`,
  ]);
}

export function textoSoEndereco(c: Contato) {
  return linhas([c.nome, linhaEndereco(c), c.pontoReferencia && `Ponto de referência: ${c.pontoReferencia}`]);
}

export function textoSuporte(c: Contato) {
  return linhas([
    `Para falar com o suporte ${c.nome}, use:`,
    c.whatsapp && `WhatsApp: ${c.whatsapp}`,
    c.telefones.length > 0 && `Telefone: ${c.telefones.join(" · ")}`,
    c.email && `E-mail: ${c.email}`,
    c.site && `Site: ${c.site}`,
    c.horario && `Atendimento: ${c.horario}.`,
  ]);
}

/** WhatsApp se houver; senão o primeiro telefone. */
export function contatoRapido(c: Contato) {
  return c.whatsapp || c.telefones[0] || null;
}
