import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyTheme, cachePreference, isThemePreference, readCachedPreference, resolveTheme, systemTheme,
  type ResolvedTheme, type ThemePreference,
} from "@/lib/theme";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeCtx {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function useOmniaTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOmniaTheme fora do ThemeController");
  return c;
}

async function saveToProfile(pref: ThemePreference) {
  // Função criada pela migração 20261119120000_profile_theme_preference.sql.
  // Se a migração ainda não rodou, a escolha fica só neste navegador.
  // (A função ainda não está nos tipos gerados do Supabase, daí o cast.)
  const client = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }> };
  try {
    await client.rpc("set_theme_preference", { pref });
  } catch {
    /* sem rede ou sem a migração: fica o cache local */
  }
}

/**
 * Controla o tema claro/escuro da área logada.
 * `profilePreference`: valor de profiles.theme_preference (undefined enquanto
 * carrega; null quando a pessoa ainda não escolheu).
 */
export function ThemeController({ profilePreference, children }: { profilePreference: string | null | undefined; children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(() => readCachedPreference() ?? "system");
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readCachedPreference() ?? "system"));
  const [askOpen, setAskOpen] = useState(false);

  const commit = useCallback((p: ThemePreference, opts: { animate?: boolean; persist?: boolean } = {}) => {
    const r = resolveTheme(p);
    setPref(p);
    setResolved(r);
    applyTheme(r, opts.animate ?? true);
    cachePreference(p);
    if (opts.persist !== false) void saveToProfile(p);
  }, []);

  // Sincroniza com o perfil quando ele carrega.
  useEffect(() => {
    if (profilePreference === undefined) return;
    if (isThemePreference(profilePreference)) {
      commit(profilePreference, { animate: false, persist: false });
      return;
    }
    const cached = readCachedPreference();
    if (cached) {
      // Já escolheu neste navegador (ou a coluna ainda não existe): leva para o perfil.
      void saveToProfile(cached);
    } else {
      setAskOpen(true);
    }
  }, [profilePreference, commit]);

  // "Seguir o sistema" acompanha a mudança do sistema operacional.
  useEffect(() => {
    if (preference !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => { const r = systemTheme(); setResolved(r); applyTheme(r, true); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [preference]);

  const value = useMemo<ThemeCtx>(() => ({
    preference,
    resolved,
    setPreference: (p) => commit(p),
    toggle: () => commit(resolved === "dark" ? "light" : "dark"),
  }), [preference, resolved, commit]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <FirstThemeDialog
        open={askOpen}
        onChoose={(p) => { commit(p); setAskOpen(false); }}
      />
    </Ctx.Provider>
  );
}

/** Pílula sol/lua do topo: o lado ativo ganha o círculo dourado. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useOmniaTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Tema escuro ativo. Mudar para o claro" : "Tema claro ativo. Mudar para o escuro"}
      onClick={toggle}
      className={cn(
        "relative inline-flex h-8 w-16 shrink-0 items-center justify-between rounded-full border border-line-strong/60 bg-surface px-[3px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[3px] h-6 w-6 rounded-full bg-gold transition-transform duration-[250ms] ease-out motion-reduce:transition-none",
          dark ? "translate-x-[32px]" : "translate-x-0",
        )}
      />
      <span aria-hidden className={cn("relative z-10 grid h-6 w-6 place-items-center", dark ? "text-ink-muted" : "text-on-gold")}>
        <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
      <span aria-hidden className={cn("relative z-10 grid h-6 w-6 place-items-center", dark ? "text-on-gold" : "text-ink-muted")}>
        <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
    </button>
  );
}

/** Pergunta do primeiro acesso. "Seguir o sistema" vem marcado. */
function FirstThemeDialog({ open, onChoose }: { open: boolean; onChoose: (p: ThemePreference) => void }) {
  const [choice, setChoice] = useState<ThemePreference>("system");
  const continueRef = useRef<HTMLButtonElement>(null);
  const sys = typeof window === "undefined" ? "light" : systemTheme();
  const shown: ResolvedTheme = choice === "system" ? sys : choice;

  const Card = ({ value, label }: { value: ResolvedTheme; label: string }) => {
    const active = shown === value;
    return (
      <button
        type="button"
        onClick={() => setChoice(value)}
        aria-pressed={choice === value}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "border-gold" : "border-border hover:border-line-strong",
        )}
      >
        <span className={cn("block h-20 overflow-hidden rounded border", value === "dark" ? "border-[#2A2433] bg-[#0B0B0B]" : "border-[#E4E0D6] bg-white")}>
          <span className="flex h-full">
            <span className={cn("h-full w-1/3 border-r", value === "dark" ? "border-[#2A2433] bg-[#111014]" : "border-[#E4E0D6] bg-[#FAF9F6]")} />
            <span className="flex flex-1 flex-col gap-1.5 p-2">
              <span className={cn("h-1.5 w-10 rounded-sm", value === "dark" ? "bg-[#D4AF37]" : "bg-[#B58A35]")} />
              <span className={cn("h-1.5 w-16 rounded-sm", value === "dark" ? "bg-[#2A2433]" : "bg-[#E4E0D6]")} />
              <span className={cn("h-1.5 w-12 rounded-sm", value === "dark" ? "bg-[#2A2433]" : "bg-[#E4E0D6]")} />
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1.5 px-1 text-sm font-medium">
          {value === "dark" ? <Moon className="h-4 w-4" strokeWidth={1.5} /> : <Sun className="h-4 w-4" strokeWidth={1.5} />}
          {label}
        </span>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onChoose(choice); }}>
      <DialogContent
        className="max-w-md"
        // Foco inicial no "Continuar", para nenhum cartão parecer escolhido sem estar.
        onOpenAutoFocus={(e) => { e.preventDefault(); continueRef.current?.focus(); }}
      >
        <DialogHeader>
          <DialogTitle>Como você prefere ver a OMNIA Apoio?</DialogTitle>
          <DialogDescription>Dá para trocar depois no botão sol/lua do topo.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          <Card value="light" label="Claro" />
          <Card value="dark" label="Escuro" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--gold)]"
            checked={choice === "system"}
            onChange={(e) => setChoice(e.target.checked ? "system" : sys)}
          />
          <Monitor className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />
          Seguir o sistema ({sys === "dark" ? "escuro" : "claro"} agora)
        </label>
        <Button ref={continueRef} onClick={() => onChoose(choice)} className="w-full">Continuar</Button>
      </DialogContent>
    </Dialog>
  );
}
