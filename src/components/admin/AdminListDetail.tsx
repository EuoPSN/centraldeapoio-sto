import { useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// Padrão de seção do Admin: lista à esquerda e painel de edição fixo à direita.

export function AdminListDetail({
  title, subtitle, actions, belowHeader, filters, search, onSearch, children, panel,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Entre o título e os filtros (ex.: abas da seção). */
  belowHeader?: ReactNode;
  filters?: ReactNode;
  search?: string;
  onSearch?: (v: string) => void;
  children: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_480px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-medium leading-8 text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13.5px] text-ink-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {belowHeader && <div className="mt-4">{belowHeader}</div>}
        {(filters || onSearch) && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">{filters}</div>
            {onSearch && (
              <label className="relative w-full max-w-[220px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <span className="sr-only">Buscar</span>
                <input
                  value={search ?? ""}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Buscar…"
                  className="h-8 w-full rounded-md border border-line-strong bg-surface pl-8 pr-2 text-sm outline-none focus:border-gold"
                />
              </label>
            )}
          </div>
        )}
        <div className="mt-3">{children}</div>
      </div>
      <aside className="min-w-0 border-line lg:border-l lg:pl-6">
        <div className="lg:sticky lg:top-4">{panel}</div>
      </aside>
    </div>
  );
}

export function FilterPill({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 rounded-full border px-3 text-[13px] transition-colors",
        active ? "border-ink bg-surface-2 font-semibold text-ink" : "border-line-strong text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function ListRow({ active, onClick, children, trailing }: { active?: boolean; onClick: () => void; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 border-b border-l-2 border-b-line px-3 py-2 transition-colors",
        active ? "border-l-gold bg-sidebar" : "border-l-transparent hover:bg-sidebar/60",
      )}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {children}
      </button>
      {trailing}
    </div>
  );
}

export function PanelEmpty({ children = "Escolha um item na lista ou crie um novo." }: { children?: ReactNode }) {
  return <p className="py-8 text-[14px] text-ink-muted">{children}</p>;
}

export function PanelHeader({ overline, title, onClose }: { overline: string; title: string; onClose?: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="type-overline text-ink-muted">{overline}</p>
        <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink [overflow-wrap:anywhere]">{title}</h3>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Fechar painel" className="text-ink-muted hover:text-ink lg:hidden">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1 mt-4 block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted first:mt-0">{children}</label>;
}

export const inputCls = "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-gold";

/** "Excluir" em texto muted, com confirmação em diálogo pequeno. */
export function DeleteLink({ onConfirm, label = "Excluir", title = "Excluir este item?", description = "Não dá para desfazer." }: {
  onConfirm: () => void; label?: string; title?: string; description?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="ml-auto text-[14px] text-ink-muted hover:text-ink">{label}</button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>{label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Campo de etiquetas: Enter (ou vírgula) adiciona; "x" remove. */
export function TagsField({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="rounded-md border border-line-strong p-1.5 focus-within:border-gold">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] text-ink">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remover ${t}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[140px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
    </div>
  );
}

export function StatusTag({ status }: { status: "rascunho" | "publicada" }) {
  return status === "publicada" ? (
    <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[11.5px] font-semibold text-gold-text">Publicada</span>
  ) : (
    <span className="shrink-0 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11.5px] text-ink-muted">Rascunho</span>
  );
}

export const fmtDia = (iso: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");
