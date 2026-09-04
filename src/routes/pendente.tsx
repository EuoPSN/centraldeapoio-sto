import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppLogo } from "@/components/AppLogo";
import { Loader2, Clock } from "lucide-react";

export const Route = createFileRoute("/pendente")({
  head: () => ({
    meta: [{ title: "Aguardando aprovação — Central CDT" }],
  }),
  component: PendentePage,
});

function PendentePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth" });
    });
  }, [navigate]);

  const verificarNovamente = async () => {
    setChecking(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { navigate({ to: "/auth" }); return; }
      const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", userData.user.id).maybeSingle();
      if (profile?.is_active) {
        navigate({ to: "/" });
      }
    } finally {
      setChecking(false);
    }
  };

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="p-8 max-w-md w-full text-center space-y-4">
        <AppLogo size="lg" className="mx-auto" />
        <Clock className="h-10 w-10 text-primary mx-auto" />
        <h1 className="text-xl font-semibold">Sua conta está aguardando aprovação</h1>
        <p className="text-sm text-muted-foreground">
          Um administrador precisa liberar seu acesso antes de você poder entrar na Central CDT.
          Assim que for aprovado, você já pode acessar normalmente.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={verificarNovamente} disabled={checking} className="gap-2">
            {checking ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</> : "Já fui aprovado, verificar novamente"}
          </Button>
          <Button variant="outline" onClick={sair}>Sair</Button>
        </div>
      </Card>
    </div>
  );
}
