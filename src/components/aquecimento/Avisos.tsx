import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { diaBR, inicioDiaBR } from "@/lib/retomada";
import { HORARIO } from "@/lib/aquecimento";
import { useStatusAquecimento } from "@/components/aquecimento/hooks";

// Aviso do aquecimento no começo do dia: notificação do Chrome nos horários do Admin
// (padrão 08:30, 12:00 e 15:00, Brasília), com a mesma permissão das notificações da retomada.
//
// Regras: só com a Omnia aberta, só se a pessoa ainda não concluiu o aquecimento diário,
// só se "Avisos do aquecimento" estiver ligado, no máximo uma notificação por horário por dia
// (controle em localStorage). Se a pessoa abre a Omnia depois de um horário, não há aviso
// atrasado: só a faixa no Início. Nada de cobrança: faltar não gera mensagem para ninguém.

const chave = (dia: string, h: string) => `omnia-aquecimento-aviso:${dia}:${h}`;
const jaAvisou = (dia: string, h: string) => { try { return localStorage.getItem(chave(dia, h)) === "1"; } catch { return false; } };
const marcar = (dia: string, h: string) => { try { localStorage.setItem(chave(dia, h), "1"); } catch { /* sem armazenamento */ } };

/** Montado uma vez no layout logado. Não desenha nada. */
export function AvisosAquecimento() {
  const { data } = useStatusAquecimento();
  const navigate = useNavigate();
  const ultimo = useRef(Date.now());
  const dados = useRef(data);
  dados.current = data;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const tick = () => {
      const agora = Date.now();
      const desde = ultimo.current;
      ultimo.current = agora;
      const d = dados.current;
      if (!d || !d.notificar || !d.disponivel || d.concluido_hoje) return;
      if (Notification.permission !== "granted") return;
      const dia = diaBR(agora);
      for (const h of d.horarios) {
        if (!HORARIO.test(h)) continue;
        const [hh, mm] = h.split(":").map(Number);
        const quando = inicioDiaBR(dia).getTime() + (hh * 60 + mm) * 60_000;
        // O horário só vale se passou enquanto a Omnia estava aberta (entre uma checagem e outra).
        if (quando <= desde || quando > agora) continue;
        if (jaAvisou(dia, h)) continue;
        // Marca antes de avisar: com duas abas abertas, só a primeira avisa.
        marcar(dia, h);
        try {
          const n = new Notification("Seu aquecimento de hoje está pronto · 5 minutos", {
            body: "Abra a Omnia e comece quando quiser.",
            tag: `aquecimento-${dia}-${h}`,
          });
          n.onclick = () => { window.focus(); navigate({ to: "/aquecimento" }); n.close(); };
        } catch { /* alguns navegadores só permitem via service worker */ }
        break;
      }
    };
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [navigate]);

  return null;
}
