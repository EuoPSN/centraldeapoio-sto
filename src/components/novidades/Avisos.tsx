import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStatusMudancas } from "@/components/novidades/hooks";

// Notificação do Chrome só para mudança Urgente: uma vez por mudança por pessoa (localStorage),
// com a mesma permissão das notificações da retomada. Só com a Omnia aberta: o status é consultado
// ao abrir a página e a cada 10 minutos (useStatusMudancas). Quando o Admin usa "Lembrar quem falta",
// a mesma notificação sai de novo, uma vez por valor de lembrete_em, para quem ainda não confirmou.
// Sem mensagem automática e sem bloqueio de tela.

const chave = (k: string) => `omnia-mudanca-aviso:${k}`;
const jaAvisou = (k: string) => { try { return localStorage.getItem(chave(k)) === "1"; } catch { return false; } };
const marcar = (k: string) => { try { localStorage.setItem(chave(k), "1"); } catch { /* sem armazenamento */ } };

/** Montado uma vez no layout logado. Não desenha nada. */
export function AvisosMudancas() {
  const { data } = useStatusMudancas();
  const navigate = useNavigate();

  useEffect(() => {
    if (!data?.avisos.length) return;
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    for (const a of data.avisos) {
      const chaves: string[] = [];
      if (a.tipo === "urgente") chaves.push(a.id);
      if (a.lembrete_em) chaves.push(`${a.id}:${a.lembrete_em}`);
      const novas = chaves.filter((k) => !jaAvisou(k));
      if (!novas.length) continue;
      // Marca antes de avisar: com duas abas abertas, só a primeira avisa. Uma notificação por mudança.
      chaves.forEach(marcar);
      try {
        const n = new Notification(`Mudança importante: ${a.title}`, {
          body: "Abra a Omnia para ler e confirmar.",
          tag: `mudanca-${a.id}`,
        });
        n.onclick = () => { window.focus(); navigate({ to: "/novidades" }); n.close(); };
      } catch { /* alguns navegadores só permitem via service worker */ }
    }
  }, [data, navigate]);

  return null;
}
