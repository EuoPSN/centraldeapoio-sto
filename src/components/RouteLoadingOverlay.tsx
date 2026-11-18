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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70">
      <div role="status" className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3.5 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="font-medium">Carregando…</span>
      </div>
    </div>
  );
}
