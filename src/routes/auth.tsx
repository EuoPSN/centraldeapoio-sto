import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OmniaLockup, OmniaVertical } from "@/components/OmniaLogo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — OMNIA Apoio" },
      { name: "description", content: "Acesse a OMNIA Apoio." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  // Voltando pelo link de "Esqueci minha senha", o Supabase manda type=recovery na URL.
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" && window.location.hash.includes("type=recovery") ? "reset" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    supabase.auth.getUser().then(({ data }) => {
      const recovering = window.location.hash.includes("type=recovery");
      if (data.user && !recovering) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Cadastro realizado! Você já pode entrar.");
        setMode("signin");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("Se o e-mail estiver cadastrado, você vai receber um link para criar a nova senha.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Senha atualizada.");
        window.history.replaceState(null, "", "/auth");
        navigate({ to: "/" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message);
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no Google");
      setLoading(false);
    }
  };

  const copy = {
    signin: { title: "Bem-vindo de volta", sub: "Entre para acessar scripts, preços e a MarcIAna.", cta: "Entrar", busy: "Entrando…" },
    signup: { title: "Criar conta", sub: "Depois do cadastro, um administrador libera o seu acesso.", cta: "Criar conta", busy: "Criando…" },
    forgot: { title: "Esqueci minha senha", sub: "Informe o seu e-mail e enviaremos um link para criar uma nova senha.", cta: "Enviar link", busy: "Enviando…" },
    reset: { title: "Nova senha", sub: "Escolha a nova senha de acesso.", cta: "Salvar senha", busy: "Salvando…" },
  }[mode];

  return (
    <div className="grid min-h-screen bg-surface md:grid-cols-2">
      {/* Metade clara: formulário */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[440px]">
          <OmniaLockup className="mb-14" />

          <h1 className="font-institutional text-[26px] leading-tight tracking-[0.08em] text-ink sm:text-[32px]">{copy.title}</h1>
          <p className="mt-3 text-[15px] text-ink-muted">{copy.sub}</p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5">
            {mode === "signup" && (
              <Field id="name" label="Nome de exibição">
                <Input id="name" type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={fieldClass} />
              </Field>
            )}
            {mode !== "reset" && (
              <Field id="email" label={mode === "signup" ? "E-mail corporativo" : "E-mail"}>
                <Input id="email" type="email" autoComplete="email" required placeholder="seuemail@cartaodetodos.com.br"
                  value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
              </Field>
            )}
            {mode !== "forgot" && (
              <Field id="password" label={mode === "signin" ? "Senha" : "Senha (mín. 8 caracteres)"}>
                <Input id="password" type="password" required minLength={mode === "signin" ? undefined : 8}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
              </Field>
            )}
            <Button type="submit" disabled={loading} className="h-11 w-full rounded-lg text-[15px]">
              {loading ? copy.busy : copy.cta}
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            {mode === "signin" ? (
              <>
                <TextLink onClick={() => setMode("forgot")}>Esqueci minha senha</TextLink>
                <TextLink onClick={() => setMode("signup")}>Criar conta</TextLink>
              </>
            ) : mode !== "reset" ? (
              <TextLink onClick={() => setMode("signin")}>Voltar para entrar</TextLink>
            ) : null}
          </div>

          {(mode === "signin" || mode === "signup") && (
            <>
              <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-ink-muted">
                <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
              </div>
              <Button type="button" variant="outline" className="h-11 w-full gap-2 rounded-lg" onClick={handleGoogle} disabled={loading}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continuar com Google
              </Button>
            </>
          )}
        </div>
      </main>

      {/* Metade escura: só a partir do tablet */}
      <aside aria-hidden className="relative hidden overflow-hidden md:block" style={{ background: "linear-gradient(160deg, #0B0B0B 0%, #17131F 55%, #2A1A42 100%)" }}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 720 900" preserveAspectRatio="xMidYMid slice" fill="none">
          <circle cx="360" cy="450" r="380" stroke="#D4AF37" strokeOpacity="0.35" strokeWidth="1.5" />
          <circle cx="430" cy="400" r="300" stroke="#D4AF37" strokeOpacity="0.22" strokeWidth="1" />
        </svg>
        <div className="relative flex h-full flex-col items-center justify-center px-10">
          <OmniaVertical className="w-[min(360px,70%)]" />
          <p className="absolute bottom-14 text-sm tracking-[0.04em] text-[#B8B2A6]">Atendimento da equipe de Venda Interna</p>
        </div>
      </aside>
    </div>
  );
}

const fieldClass = "h-11 rounded-lg border-line-strong bg-surface text-[15px]";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-ink">{label}</Label>
      {children}
    </div>
  );
}

function TextLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="font-medium text-gold-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
      {children}
    </button>
  );
}
