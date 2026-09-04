import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

// Só mostra o overlay se a troca de página demorar mais que isso — evita "piscar"
// em navegações rápidas, que são a maioria.
const DELAY_MS = 200;

export function RouteLoadingOverlay() {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-lg bg-primary text-primary-foreground px-6 py-4 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-medium">Aguarde, carregando...</span>
      </div>
    </div>
  );
}
