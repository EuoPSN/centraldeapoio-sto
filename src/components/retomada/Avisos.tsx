import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useRetomadaContagem } from "@/components/retomada/hooks";

// Aviso de follow-up: toast discreto com a Omnia aberta e, se o atendente permitir,
// notificação do navegador (também com a aba em segundo plano). A checagem é a do
// useRetomadaContagem: a cada minuto enquanto a Omnia estiver aberta em alguma aba.

const KEY = "omnia-followup-avisados";

const suportaNotificacao = () => typeof window !== "undefined" && "Notification" in window;

function lerAvisados(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]); } catch { return new Set(); }
}
function gravarAvisados(s: Set<string>) {
  try { localStorage.setItem(KEY, JSON.stringify([...s].slice(-200))); } catch { /* navegador sem armazenamento */ }
}

/** Botão "Ativar avisos" do cabeçalho de /retomar: pede a permissão uma vez. */
export function useAvisosPermissao() {
  const [perm, setPerm] = useState<NotificationPermission | "indisponivel">(() =>
    suportaNotificacao() ? Notification.permission : "indisponivel");
  const pedir = useCallback(async () => {
    if (!suportaNotificacao()) return;
    try { setPerm(await Notification.requestPermission()); } catch { /* ignorado */ }
  }, []);
  return { podePedir: perm === "default", pedir };
}

/** Montado uma vez no layout logado. Não desenha nada. */
export function AvisosFollowUp() {
  const { data } = useRetomadaContagem();
  const navigate = useNavigate();

  useEffect(() => {
    if (!data?.followUps.length) return;
    const avisados = lerAvisados();
    const novos = data.followUps.filter((f) => !avisados.has(`${f.id}:${f.em}`));
    if (!novos.length) return;
    // Marca antes de avisar: com duas abas abertas, só a primeira avisa.
    novos.forEach((f) => avisados.add(`${f.id}:${f.em}`));
    gravarAvisados(avisados);

    for (const f of novos) {
      const titulo = `Hora do follow-up: ${f.nome}`;
      toast(titulo, { duration: 12_000, action: { label: "Abrir", onClick: () => navigate({ to: "/retomar" }) } });
      if (suportaNotificacao() && Notification.permission === "granted" && (document.hidden || !document.hasFocus())) {
        try {
          const n = new Notification(titulo, { body: "Abra a Omnia para retomar este cliente.", tag: `followup-${f.id}` });
          n.onclick = () => { window.focus(); navigate({ to: "/retomar" }); n.close(); };
        } catch { /* alguns navegadores só permitem via service worker */ }
      }
    }
  }, [data, navigate]);

  return null;
}
