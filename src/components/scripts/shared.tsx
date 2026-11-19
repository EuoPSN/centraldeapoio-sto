import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Copy } from "lucide-react";
import { listMessages, incrementMessageUseCount } from "@/lib/messages.functions";
import { listFlowStages, listFlowPaths } from "@/lib/messageflow.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos e dados
// ---------------------------------------------------------------------------

export interface MessageRow {
  id: string;
  title: string;
  content: string;
  internal_note: string | null;
  tags: string[];
  category: { id: string; name: string } | null;
  subcategory: { id: string; name: string } | null;
  position: number;
  shortcut?: string | null;
  use_count?: number | null;
  updated_at?: string | null;
  flow_links?: { id: string; flow_stage_id: string; position: number }[];
  image_url?: string | null;
  image_ext?: string | null;
}

export interface StageRow { id: string; name: string; position: number; category_id: string | null; path_id: string | null }
export interface PathRow { id: string; name: string; category_id: string | null; branches_from_stage_id: string; merges_into_stage_id: string | null; position: number }
export interface CategoryRow { id: string; name: string; slug: string; parent_id: string | null; position: number }

export function useMessages() {
  const fn = useServerFn(listMessages);
  const q = useQuery({ queryKey: ["messages"], queryFn: () => fn({}) });
  return { ...q, rows: (q.data ?? []) as unknown as MessageRow[] };
}

export function useMessageCategories() {
  const fn = useServerFn(listCategories);
  const q = useQuery({ queryKey: ["cats", "message"], queryFn: () => fn({ data: { scope: "message" } }) });
  return { ...q, rows: (q.data ?? []) as CategoryRow[] };
}

export function useFlowData() {
  const stageFn = useServerFn(listFlowStages);
  const pathFn = useServerFn(listFlowPaths);
  const stageQ = useQuery({ queryKey: ["flow-stages"], queryFn: () => stageFn({}) });
  const pathQ = useQuery({ queryKey: ["flow-paths"], queryFn: () => pathFn({}) });
  return {
    isLoading: stageQ.isLoading || pathQ.isLoading,
    stages: (stageQ.data ?? []) as StageRow[],
    paths: (pathQ.data ?? []) as PathRow[],
  };
}

/** Registra uma cópia na contagem de uso (use_count). */
export function useCountCopy() {
  const inc = useServerFn(incrementMessageUseCount);
  return (id: string) => {
    inc({ data: { id } }).catch(() => {});
  };
}

// Mais usadas primeiro; empate pela ordem do admin.
export function byMostUsed(a: MessageRow, b: MessageRow) {
  return (b.use_count ?? 0) - (a.use_count ?? 0) || a.position - b.position;
}

// "Filiação: Leads frios" → "Leads frios": tira só na exibição o prefixo que
// repete a categoria ou que se repete entre as subcategorias irmãs.
export function shortNames(subs: { id: string; name: string }[], categoryName: string) {
  const split = (name: string) => {
    const m = name.match(/^(.{2,40}?)\s*(?::|\s[-–—]\s)\s*(.+)$/);
    return m ? { prefix: normalize(m[1].trim()), rest: m[2].trim() } : null;
  };
  const prefixCount = new Map<string, number>();
  subs.forEach((s) => {
    const p = split(s.name)?.prefix;
    if (p) prefixCount.set(p, (prefixCount.get(p) ?? 0) + 1);
  });
  const cat = normalize(categoryName);
  return new Map(
    subs.map((s) => {
      const sp = split(s.name);
      const strip = sp && (sp.prefix === cat || (prefixCount.get(sp.prefix) ?? 0) >= 2);
      return [s.id, strip ? sp!.rest : s.name];
    }),
  );
}

// ---------------------------------------------------------------------------
// Fluxos: cada subcategoria (ou categoria sem filhas) com etapas é um fluxo.
// Etapas sem categoria formam o fluxo "Geral".
// ---------------------------------------------------------------------------

export interface FlowDef {
  key: string;          // usado na URL: /scripts/fluxo/<key>
  categoryId: string | null;
  name: string;
  groupId: string;      // aba do catálogo
  groupName: string;
  trunk: StageRow[];    // etapas do tronco, em ordem
}

export function buildFlows(categories: CategoryRow[], stages: StageRow[]): { groups: { id: string; name: string }[]; flows: FlowDef[] } {
  const trunkOf = (catId: string | null) =>
    stages.filter((s) => (s.category_id ?? null) === catId && !s.path_id).sort((a, b) => a.position - b.position);

  const sorted = [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const parents = sorted.filter((c) => !c.parent_id);
  const raw: Omit<FlowDef, "key">[] = [];
  const groups: { id: string; name: string }[] = [];

  for (const p of parents) {
    const kids = sorted.filter((c) => c.parent_id === p.id);
    const members = [p, ...kids].filter((c) => trunkOf(c.id).length > 0);
    if (members.length === 0) continue;
    groups.push({ id: p.id, name: p.name });
    const short = shortNames(kids, p.name);
    for (const c of members) raw.push({ categoryId: c.id, name: short.get(c.id) ?? c.name, groupId: p.id, groupName: p.name, trunk: trunkOf(c.id) });
  }
  const geral = trunkOf(null);
  if (geral.length > 0) {
    groups.push({ id: "geral", name: "Geral" });
    raw.push({ categoryId: null, name: "Geral", groupId: "geral", groupName: "Geral", trunk: geral });
  }

  // Chave legível (slug) quando não houver repetição; senão, o id.
  const slugOf = (f: Omit<FlowDef, "key">) => (f.categoryId ? (categories.find((c) => c.id === f.categoryId)?.slug ?? f.categoryId) : "geral");
  const counts = new Map<string, number>();
  raw.forEach((f) => counts.set(slugOf(f), (counts.get(slugOf(f)) ?? 0) + 1));
  const flows = raw.map((f) => ({ ...f, key: counts.get(slugOf(f)) === 1 ? slugOf(f) : (f.categoryId ?? "geral") }));
  return { groups, flows };
}

export function etapasLabel(n: number) {
  return `${n} ${n === 1 ? "etapa" : "etapas"}`;
}
export function mensagensLabel(n: number) {
  return `${n} ${n === 1 ? "mensagem" : "mensagens"}`;
}

// ---------------------------------------------------------------------------
// Texto da mensagem no estilo do WhatsApp
// ---------------------------------------------------------------------------

// Palavras que, sozinhas em itálico (ex.: _nome_), indicam um campo para o
// atendente preencher. Também valem [nome], {nome} e {{nome}}.
const FIELD_WORDS = new Set([
  "nome", "seu nome", "nome do cliente", "cliente", "nome cliente", "atendente",
  "cidade", "unidade", "valor", "preco", "preço", "data", "dia", "horario", "horário", "hora",
  "link", "plano", "telefone", "cpf", "email", "e-mail", "especialidade", "consultor", "produto",
]);
const isFieldWord = (s: string) => FIELD_WORDS.has(s.trim().toLowerCase());

// `plain` é o que vai para "Sem formatação": tira só os marcadores do WhatsApp.
type Token = { kind: "text" | "bold" | "italic" | "strike" | "field"; text: string; plain?: string };

// **negrito** (markdown) vale como *negrito*.
const INLINE = /(\{\{[^{}\n]+\}\}|\{[^{}\n]+\}|\[[^\][\n]+\]|\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

function tokenize(line: string): Token[] {
  return line.split(INLINE).filter(Boolean).map<Token>((p) => {
    if (/^\{\{.+\}\}$/.test(p)) return { kind: "field", text: p.slice(2, -2).trim(), plain: p };
    if (/^\{.+\}$/.test(p)) return { kind: "field", text: p.slice(1, -1).trim(), plain: p };
    if (/^\[.+\]$/.test(p)) return { kind: "field", text: p.slice(1, -1).trim(), plain: p };
    if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) return { kind: "bold", text: p.slice(2, -2) };
    if (p.length > 2 && p.startsWith("*") && p.endsWith("*")) return { kind: "bold", text: p.slice(1, -1) };
    if (p.length > 2 && p.startsWith("_") && p.endsWith("_")) {
      const t = p.slice(1, -1);
      return isFieldWord(t) ? { kind: "field", text: t } : { kind: "italic", text: t };
    }
    if (p.length > 2 && p.startsWith("~") && p.endsWith("~")) return { kind: "strike", text: p.slice(1, -1) };
    return { kind: "text", text: p };
  });
}

/** Texto limpo, sem os marcadores do WhatsApp (para "Sem formatação" e prévias). */
export function plainText(content: string) {
  return content
    .split("\n")
    .map((line) => tokenize(line).map((t) => t.plain ?? t.text).join(""))
    .join("\n")
    .replace(/[ \t]+$/gm, "");
}

/** Uma linha de prévia: texto limpo, quebras viram espaço. */
export function previewLine(content: string) {
  return plainText(content).replace(/\s+/g, " ").trim();
}

/** Renderiza *negrito*, _itálico_, ~tachado~, emojis e campos para preencher (só na visualização). */
export function WhatsAppMessage({ content, className }: { content: string; className?: string }) {
  const lines = content.split("\n");
  return (
    <div className={cn("whitespace-pre-wrap break-words text-[15px] leading-[1.65] text-ink", className)}>
      {lines.map((line, i) => (
        <span key={i}>
          {tokenize(line).map((t, j) => {
            switch (t.kind) {
              case "bold": return <strong key={j} className="font-semibold">{t.text}</strong>;
              case "italic": return <em key={j}>{t.text}</em>;
              case "strike": return <s key={j}>{t.text}</s>;
              case "field":
                return (
                  <span key={j} title="Campo para preencher" className="font-medium text-gold-text underline decoration-dashed decoration-1 underline-offset-[5px]">
                    {t.text}
                  </span>
                );
              default: return <span key={j}>{t.text}</span>;
            }
          })}
          {i < lines.length - 1 && "\n"}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copiar
// ---------------------------------------------------------------------------

export function useCopy(onCopied?: () => void) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* navegador sem permissão de área de transferência */
    }
  };
  return { copied, copy };
}

export function GoldButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gold px-[18px] text-[15px] font-semibold text-on-gold transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-[18px] text-[15px] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Ícone de copiar da linha: sem moldura; com moldura quando a linha está selecionada. */
export function CopyIconButton({ text, framed, label, onCopied }: { text: string; framed?: boolean; label: string; onCopied?: () => void }) {
  const { copied, copy } = useCopy(onCopied);
  return (
    <button
      type="button"
      aria-label={copied ? "Copiado" : label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        copy(text);
      }}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gold-text transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        framed ? "border border-line-strong bg-surface" : "border border-transparent",
      )}
    >
      {copied ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Trilha de navegação no topo (renderizada na barra superior do app)
// ---------------------------------------------------------------------------

export function TopbarBreadcrumb({ items }: { items: { label: string; to?: string; search?: Record<string, unknown> }[] }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById("topbar-breadcrumb"));
  }, []);
  if (!slot) return null;
  return createPortal(
    <ol className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.5} />}
            {last || !it.to ? (
              <span aria-current={last ? "page" : undefined} className={cn("truncate", last ? "font-semibold text-ink" : "text-ink-muted")}>{it.label}</span>
            ) : (
              <Link to={it.to} search={it.search as never} className="truncate text-ink-muted hover:text-ink">{it.label}</Link>
            )}
          </li>
        );
      })}
    </ol>,
    slot,
  );
}

// ---------------------------------------------------------------------------
// Abas de texto (categorias), mesmo estilo na Biblioteca e no Fluxo
// ---------------------------------------------------------------------------

export function TextTabs<T extends string>({
  items, value, onChange, label, trailing,
}: {
  items: { id: T; name: string }[];
  value: T | null;
  onChange: (id: T) => void;
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-line">
      <div role="tablist" aria-label={label} className="-mb-px flex min-w-0 flex-1 gap-6 overflow-x-auto [scrollbar-width:none]">
        {items.map((it) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(it.id)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active ? "border-gold font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {it.name}
            </button>
          );
        })}
      </div>
      {trailing && <div className="mb-2 w-full sm:w-auto">{trailing}</div>}
    </div>
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block rounded bg-surface-2 motion-safe:animate-pulse", className)} />;
}

// Busca tolerante: ignora acento e tolera pequenos erros de digitação por palavra.
export function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
function fuzzyWordMatch(words: string[], q: string) {
  if (q.length < 3) return words.some((w) => w.startsWith(q));
  const maxDist = q.length <= 5 ? 1 : 2;
  return words.some((w) => w.startsWith(q) || w.includes(q) || levenshtein(w, q) <= maxDist);
}
export function matchesMessage(m: MessageRow, query: string) {
  const qWords = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (qWords.length === 0) return true;
  const hay = normalize([m.title, m.content, m.shortcut ? `/${m.shortcut}` : "", m.subcategory?.name ?? "", (m.tags ?? []).join(" ")].join(" "));
  if (qWords.every((w) => hay.includes(w))) return true;
  const words = hay.split(/\s+/).filter(Boolean);
  return qWords.every((w) => fuzzyWordMatch(words, w));
}
