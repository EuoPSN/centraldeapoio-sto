import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAmorSaude, registerAmorSaudeUse } from "@/lib/amorsaude.functions";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ItemTipo = "consulta" | "exame" | "odontologia" | "telemedicina";

export interface Clinica {
  id: string;
  nome: string;
  regiao: string | null;
  endereco: string | null;
  numero: string | null;
  pontoReferencia: string | null;
  telefone: string | null;
  telefone2: string | null;
  mapsUrl: string;
  principal: boolean;
  position: number;
}

interface Base {
  id: string;
  nome: string;
  descricao: string | null;
  clinicaIds: string[];
  useCount: number;
}
export interface Consulta extends Base {
  tipo: "consulta";
  cartao: number | null;
  particular: number | null;
  notes: string | null;
  area: string | null;
  paraQuem: string | null;
  comoAgendar: string | null;
}
export interface Exame extends Base {
  tipo: "exame";
  kind: "laboratorial" | "imagem";
  categoria: string | null;
  media: number | null;
  preparo: string[];
}
export interface Procedimento extends Base {
  tipo: "odontologia";
  categoria: string | null;
  cuidadosPos: string | null;
}
export type Modalidade = "teleconsulta" | "pa_digital";
export interface Telemedicina extends Base {
  tipo: "telemedicina";
  modalidade: Modalidade;
  paraQuem: string | null;
  cartao: number | null;
  particular: number | null;
  passos: string[];
  indiqueQuando: string | null;
  linkAgendamento: string | null;
  tempoEsperaMin: number | null;
  ativo: boolean;
  position: number;
}
export type AmorItem = Consulta | Exame | Procedimento | Telemedicina;

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const n = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const links = (v: unknown) => (Array.isArray(v) ? (v as { clinica_id?: string }[]).map((l) => l.clinica_id).filter((x): x is string => !!x) : []);

export function mapsLink(c: { nome: string; endereco: string | null; numero: string | null; regiao: string | null; mapsUrl?: string | null }) {
  if (c.mapsUrl) return c.mapsUrl;
  const q = [c.nome, enderecoCurto(c), c.regiao].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q).replace(/%20/g, "+")}`;
}

/** Preparo como lista: usa os itens cadastrados ou monta a partir dos campos antigos. */
function preparoDe(r: Raw): string[] {
  const itens = Array.isArray(r.preparo_itens) ? (r.preparo_itens as unknown[]).map(s).filter((x): x is string => !!x) : [];
  if (itens.length) return itens;
  const preparo = s(r.preparo);
  const out: string[] = [];
  if (preparo) out.push(preparo);
  if (r.jejum && !/jejum/i.test(preparo ?? "")) out.push("Jejum necessário (confirme o tempo com a clínica)");
  if (!r.jejum && !preparo) out.push("Não é necessário jejum");
  if (s(r.material)) out.push(`Material/método: ${s(r.material)}`);
  if (s(r.observacoes)) out.push(s(r.observacoes)!);
  return out;
}

export function useAmorSaude() {
  const fn = useServerFn(getAmorSaude);
  const q = useQuery({ queryKey: ["amor-saude"], queryFn: () => fn({}), staleTime: 60_000 });

  const data = useMemo(() => {
    const raw = q.data;
    const clinicas: Clinica[] = ((raw?.clinicas ?? []) as Raw[]).map((r) => {
      const c = {
        id: String(r.id),
        nome: String(r.nome_regiao ?? ""),
        regiao: s(r.regiao),
        endereco: s(r.endereco),
        numero: s(r.numero),
        pontoReferencia: s(r.ponto_referencia),
        telefone: s(r.contato1),
        telefone2: s(r.contato2) && s(r.contato2) !== s(r.contato1) ? s(r.contato2) : null,
        principal: !!r.destaque,
        position: Number(r.position ?? 0),
        mapsUrl: "",
      };
      return { ...c, mapsUrl: mapsLink({ ...c, mapsUrl: s(r.maps_url) }) };
    });
    const consultas: Consulta[] = ((raw?.consultas ?? []) as Raw[]).map((r) => ({
      tipo: "consulta",
      id: String(r.id),
      nome: String(r.specialty ?? ""),
      descricao: s(r.description),
      clinicaIds: links(r.clinicas),
      useCount: Number(r.use_count ?? 0),
      cartao: n(r.cartao_price),
      particular: n(r.particular_price),
      notes: s(r.notes),
      area: s(r.area),
      paraQuem: s(r.para_quem),
      comoAgendar: s(r.como_agendar),
    }));
    const exames: Exame[] = ((raw?.exames ?? []) as Raw[]).map((r) => ({
      tipo: "exame",
      id: String(r.id),
      nome: String(r.nome ?? ""),
      descricao: s(r.descricao),
      clinicaIds: links(r.clinicas),
      useCount: Number(r.use_count ?? 0),
      kind: r.tipo === "imagem" ? "imagem" : "laboratorial",
      categoria: s(r.categoria),
      media: n(r.media_referencia),
      preparo: preparoDe(r),
    }));
    const procedimentos: Procedimento[] = ((raw?.procedimentos ?? []) as Raw[]).map((r) => ({
      tipo: "odontologia",
      id: String(r.id),
      nome: String(r.nome ?? ""),
      descricao: s(r.descricao),
      clinicaIds: links(r.clinicas),
      useCount: Number(r.use_count ?? 0),
      categoria: s(r.categoria),
      cuidadosPos: s(r.cuidados_pos),
    }));
    const telemedicina: Telemedicina[] = ((raw?.telemedicina ?? []) as Raw[])
      .map((r): Telemedicina => ({
        tipo: "telemedicina",
        id: String(r.id),
        nome: String(r.nome ?? ""),
        descricao: s(r.descricao),
        clinicaIds: [],
        useCount: Number(r.use_count ?? 0),
        modalidade: r.tipo === "pa_digital" ? "pa_digital" : "teleconsulta",
        paraQuem: s(r.para_quem),
        cartao: n(r.cartao),
        particular: n(r.particular),
        passos: Array.isArray(r.passos) ? (r.passos as unknown[]).map(s).filter((x): x is string => !!x) : [],
        indiqueQuando: s(r.indique_quando),
        linkAgendamento: s(r.link_agendamento),
        tempoEsperaMin: n(r.tempo_espera_min),
        ativo: r.ativo !== false,
        position: Number(r.position ?? 0),
      }))
      .filter((t) => t.ativo);
    const regioes = [...new Set(clinicas.map((c) => c.regiao).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { clinicas, consultas, exames, procedimentos, telemedicina, regioes, siteUrl: s(raw?.siteUrl), avaliacaoOdonto: n(raw?.avaliacaoOdonto) };
  }, [q.data]);

  return { ...data, isLoading: q.isLoading, isError: q.isError };
}

/** Registra uma cópia (alimenta "Mais procuradas"). */
export function useCountUse() {
  const fn = useServerFn(registerAmorSaudeUse);
  return (tipo: ItemTipo, id: string) => {
    fn({ data: { tipo, id } }).catch(() => {});
  };
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const reais = (v: number) => `R$ ${brl(v)}`;

export function economia(c: Consulta) {
  if (c.cartao == null || c.particular == null || c.particular <= 0 || c.particular <= c.cartao) return null;
  const valor = c.particular - c.cartao;
  return { valor, pct: Math.round((valor / c.particular) * 100) };
}

export function enderecoCurto(c: { endereco: string | null; numero: string | null }) {
  return [c.endereco, c.numero].filter(Boolean).join(", ");
}

/** "Clínica Amor Saúde Centro de Neves" → "Centro de Neves". */
export function nomeCurto(c: Clinica) {
  return c.nome.replace(/^\s*cl[íi]nica\s+amor\s+sa[úu]de\s*/i, "").trim() || c.nome;
}

export function tipoExameLabel(k: Exame["kind"]) {
  return k === "imagem" ? "Imagem" : "Laboratorial";
}

// Busca que ignora acento.
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
// Clínicas perto do cliente primeiro
// ---------------------------------------------------------------------------

export type Proximidade = "proxima" | "principal" | "outra";
export interface ClinicaOrdenada { clinica: Clinica; selo: Proximidade }

const byPos = (a: Clinica, b: Clinica) => a.position - b.position || a.nome.localeCompare(b.nome, "pt-BR");

/**
 * Da região escolhida (MAIS PRÓXIMA), depois as principais (PRINCIPAL),
 * depois as demais (OUTRA REGIÃO). Sem região: principais primeiro.
 */
export function ordenarClinicas(clinicas: Clinica[], regiao: string | null): ClinicaOrdenada[] {
  const selo = (c: Clinica): Proximidade => (regiao && c.regiao === regiao ? "proxima" : c.principal ? "principal" : "outra");
  const rank: Record<Proximidade, number> = { proxima: 0, principal: 1, outra: 2 };
  return [...clinicas]
    .map((clinica) => ({ clinica, selo: selo(clinica) }))
    .sort((a, b) => rank[a.selo] - rank[b.selo] || byPos(a.clinica, b.clinica));
}

export function clinicasDoItem(item: AmorItem, todas: Clinica[], regiao: string | null) {
  const set = new Set(item.clinicaIds);
  return ordenarClinicas(todas.filter((c) => set.has(c.id)), regiao);
}

// ---------------------------------------------------------------------------
// Textos para copiar
// ---------------------------------------------------------------------------

const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

/** "Ribeirão das Neves (Centro de Neves), Veneza, Belo Horizonte (Barreiro, BH Norte)". */
function porRegiao(clinicas: Clinica[]) {
  const grupos = new Map<string, Clinica[]>();
  clinicas.forEach((c) => {
    const k = c.regiao ?? nomeCurto(c);
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  });
  return [...grupos.entries()]
    .map(([regiao, cs]) => {
      const nomes = cs.map(nomeCurto).filter((nm) => norm(nm) !== norm(regiao));
      return nomes.length ? `${regiao} (${nomes.join(", ")})` : regiao;
    })
    .join(", ");
}

/** Linhas 📍 / "Também atende em" comuns a consulta, exame e procedimento. */
function linhasOnde(ordenadas: ClinicaOrdenada[], regiao: string | null) {
  if (!ordenadas.length) return [];
  const proxima = regiao ? ordenadas.find((o) => o.selo === "proxima")?.clinica : undefined;
  if (proxima) {
    const end = enderecoCurto(proxima);
    const resto = ordenadas.filter((o) => o.clinica.id !== proxima.id).map((o) => o.clinica);
    return [
      `📍 Mais perto de você: ${proxima.nome}${end ? ` – ${end}` : ""}`,
      resto.length ? `Também atende em: ${porRegiao(resto)}.` : null,
    ];
  }
  const principais = ordenadas.filter((o) => o.clinica.principal).map((o) => o.clinica);
  const demais = ordenadas.filter((o) => !o.clinica.principal).map((o) => o.clinica);
  const primeiro = principais.length ? principais : demais;
  const resto = principais.length ? demais : [];
  return [
    `📍 Atende em: ${joinList(primeiro.map(nomeCurto))}`,
    resto.length ? `Também atende em: ${porRegiao(resto)}.` : null,
  ];
}

const clean = (lines: (string | null | undefined | false)[]) => lines.filter(Boolean).join("\n");

export function textoConsulta(c: Consulta, ordenadas: ClinicaOrdenada[], regiao: string | null) {
  const eco = economia(c);
  return clean([
    `*${c.nome} pelo Cartão de TODOS* 🩺`,
    c.cartao != null && `💚 Cartão de TODOS: *${reais(c.cartao)}*`,
    c.particular != null && `Particular: ${reais(c.particular)}${eco ? ` (você economiza ${reais(eco.valor)})` : ""}`,
    ...linhasOnde(ordenadas, regiao),
  ]);
}

export function textoExame(e: Exame, ordenadas: ClinicaOrdenada[], regiao: string | null) {
  return clean([
    `*${e.nome} pelo Cartão de TODOS* 🔬`,
    e.media != null
      ? `Valor: consulte a clínica (média de ${reais(e.media)}, varia conforme o pedido médico)`
      : "Valor: consulte a clínica",
    ...linhasOnde(ordenadas, regiao),
  ]);
}

export function textoPreparo(e: Exame) {
  return clean([`*Preparo para ${e.nome}*`, ...e.preparo.map((p) => `• ${p}`)]);
}

export function textoProcedimento(p: Procedimento, ordenadas: ClinicaOrdenada[], regiao: string | null, avaliacao: number | null) {
  return clean([
    `*${p.nome} pelo Cartão de TODOS* 🦷`,
    "Valor após avaliação odontológica",
    avaliacao != null && `Avaliação odontológica pelo Cartão de TODOS: *${reais(avaliacao)}*`,
    ...linhasOnde(ordenadas, regiao),
  ]);
}

export const nomeModalidade = (m: Modalidade) => (m === "pa_digital" ? "PA digital" : "Teleconsulta");

/** Texto do serviço para o cliente (sem "consulte o valor": valor vazio simplesmente não aparece). */
export function textoTelemedicina(t: Telemedicina) {
  const pa = t.modalidade === "pa_digital";
  return clean([
    pa ? `*PA digital – ${t.nome} pelo Cartão de TODOS* 💻` : `*Teleconsulta de ${t.nome} pelo Cartão de TODOS* 💻`,
    t.descricao,
    pa && t.tempoEsperaMin != null && `⏱️ Atendimento por vídeo em até ${t.tempoEsperaMin} minutos depois de agendar.`,
    t.cartao != null && `💚 Cartão de TODOS: *${reais(t.cartao)}*`,
    t.particular != null && `Particular: ${reais(t.particular)}${t.cartao != null && t.particular > t.cartao ? ` (você economiza ${reais(t.particular - t.cartao)})` : ""}`,
    pa && "Em caso grave ou urgência, procure um pronto-socorro.",
  ]);
}

export function textoPassosTelemedicina(t: Telemedicina) {
  if (!t.passos.length) return "";
  return clean([`*Como usar: ${nomeModalidade(t.modalidade)} – ${t.nome}*`, ...t.passos.map((p, i) => `${i + 1}. ${p}`)]);
}

/** Até 4 clínicas, a mais próxima primeiro. */
export function textoClinicas(nomeItem: string, ordenadas: ClinicaOrdenada[]) {
  const blocos = ordenadas.slice(0, 4).flatMap(({ clinica: c }) => {
    const end = enderecoCurto(c);
    return [
      `*${c.nome}*${end ? ` – ${end}` : ""}`,
      [c.telefone && `📞 ${c.telefone}`, `Rota: ${c.mapsUrl}`].filter(Boolean).join(" · "),
    ];
  });
  return clean([`📍 *Clínicas Amor Saúde para ${nomeItem}*`, ...blocos]);
}

export function textoEnderecoClinica(c: Clinica) {
  return clean([
    `*${c.nome}*`,
    enderecoCurto(c) || null,
    c.pontoReferencia && `Ponto de referência: ${c.pontoReferencia}`,
    [c.telefone, c.telefone2].filter(Boolean).length ? `📞 ${[c.telefone, c.telefone2].filter(Boolean).join(" / ")}` : null,
    `Rota: ${c.mapsUrl}`,
  ]);
}

// ---------------------------------------------------------------------------
// Áreas (Todas as especialidades)
// ---------------------------------------------------------------------------

export const AREAS = ["Clínica e família", "Coração e circulação", "Ossos e movimento", "Mente", "Pele e visão", "Outras"] as const;

/** "Cardiologista - primeira consulta + eletrocardiograma" → "Cardiologista". */
export function nomeBase(nome: string) {
  return nome.split(/\s[-–—]\s/)[0].trim();
}

/** Especialidades agrupadas por área, na ordem das sugestões; sem área → Outras. */
export function especialidadesPorArea(consultas: Consulta[]) {
  const porNome = new Map<string, { nome: string; area: string }>();
  consultas.forEach((c) => {
    const base = nomeBase(c.nome);
    const key = norm(base);
    const prev = porNome.get(key);
    if (!prev || (prev.area === "Outras" && c.area)) porNome.set(key, { nome: base, area: c.area?.trim() || "Outras" });
  });
  const grupos = new Map<string, string[]>();
  porNome.forEach(({ nome, area }) => {
    const known = AREAS.find((a) => norm(a) === norm(area)) ?? area;
    grupos.set(known, [...(grupos.get(known) ?? []), nome]);
  });
  const ordem = (a: string) => {
    if (a === "Outras") return 999;
    const i = AREAS.indexOf(a as (typeof AREAS)[number]);
    return i >= 0 ? i : 500;
  };
  return [...grupos.entries()]
    .sort(([a], [b]) => ordem(a) - ordem(b) || a.localeCompare(b, "pt-BR"))
    .map(([area, nomes]) => ({ area, nomes: nomes.sort((a, b) => a.localeCompare(b, "pt-BR")) }));
}

export function menorValor(consultas: Consulta[]) {
  const vs = consultas.map((c) => c.cartao).filter((v): v is number => v != null && v > 0);
  return vs.length ? Math.min(...vs) : null;
}

export function textoTodasEspecialidades(consultas: Consulta[]) {
  const menor = menorValor(consultas);
  const grupos = especialidadesPorArea(consultas);
  return clean([
    menor != null
      ? `No Cartão de TODOS você tem consultas a partir de *${reais(menor)}* nestas especialidades:`
      : "No Cartão de TODOS você tem consultas nestas especialidades:",
    ...grupos.map((g) => `🩺 *${g.area}:* ${g.nomes.map((nm) => nm.toLocaleLowerCase("pt-BR")).join(", ")}`),
    "Quer saber o valor de alguma delas? 😊",
  ]);
}
