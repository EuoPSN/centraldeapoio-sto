import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css";
import { listarToursVistos, marcarTourVisto } from "@/lib/tours.functions";
import { filtrarPassos, situacaoDoTour, tourDaRota as acharTourDaRota, tourPorId, type SituacaoTour, type Tour } from "@/lib/tours";

type Vistos = { tour_id: string; versao: number }[];

type TourContextValue = {
  tourDaRota: Tour | null;
  iniciar: (id?: string) => void;
  iniciarAposNavegar: (id: string) => void;
  situacao: (id: string) => SituacaoTour;
  carregando: boolean;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour precisa estar dentro do TourProvider.");
  return ctx;
}

const POLL_MS = 200;
const POLL_MAX_MS = 3000;
const ASSENTAR_MS = 800;

function alvoVisivel(seletor: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector(seletor);
  if (!el) return false;
  if (el.closest("[hidden]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  return window.getComputedStyle(el).visibility !== "hidden";
}

function dialogoAberto(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).some(
    (el) => !el.classList.contains("omnia-tour"),
  );
}

const reduzMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listarFn = useServerFn(listarToursVistos);
  const marcarFn = useServerFn(marcarTourVisto);

  const vistosQ = useQuery({ queryKey: ["tour-vistos"], queryFn: () => listarFn({}), staleTime: 60_000 });
  const vistos = useMemo<Vistos>(() => vistosQ.data ?? [], [vistosQ.data]);
  const vistosRef = useRef<Vistos>(vistos);
  vistosRef.current = vistos;

  const tourAtual = useMemo(() => acharTourDaRota(pathname) ?? null, [pathname]);

  const driverRef = useRef<Driver | null>(null);
  const naoMarcarRef = useRef(false);
  const pedidoRef = useRef<string | null>(null);
  const [pedido, setPedido] = useState<string | null>(null);
  // Mudar de rota invalida esperas em andamento.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const marcar = useCallback(
    (tour: Tour) => {
      marcarFn({ data: { tour_id: tour.id, versao: tour.versao } })
        .then(() => {
          queryClient.setQueryData<Vistos>(["tour-vistos"], (antigo) => {
            const resto = (antigo ?? []).filter((v) => v.tour_id !== tour.id);
            const atual = (antigo ?? []).find((v) => v.tour_id === tour.id);
            return [...resto, { tour_id: tour.id, versao: Math.max(tour.versao, atual?.versao ?? 1) }];
          });
        })
        .catch(() => {
          /* sem erro na tela: tenta de novo na próxima visita */
        });
    },
    [marcarFn, queryClient],
  );

  const abrir = useCallback(
    (tour: Tour): boolean => {
      if (driverRef.current) return false; // nunca dois tours ao mesmo tempo
      const passos = filtrarPassos(tour, alvoVisivel);
      if (passos.length < 1) return false;

      naoMarcarRef.current = false;
      const total = passos.length;
          const reduz = reduzMovimento();

      const d = driver({
        animate: !reduz,
        smoothScroll: !reduz,
        overlayColor: "#0b0b0b",
        overlayOpacity: 0.58,
        stagePadding: 8,
        stageRadius: 12,
        allowClose: true,
        allowKeyboardControl: true,
        overlayClickBehavior: "none",
        disableActiveInteraction: true,
        showProgress: true,
        progressText: "{{current}}/{{total}}",
        showButtons: ["previous", "next", "close"],
        nextBtnText: "Próximo",
        prevBtnText: "Voltar",
        doneBtnText: "Concluir",
        closeBtnLabel: "Fechar tutorial",
        popoverClass: "omnia-tour",
        steps: passos.map((p) => ({
          element: p.alvo,
          popover: { title: p.titulo, description: p.texto },
        })),
        onPopoverRender: (popover, { driver: drv, state }) => {
          const idx = state.activeIndex ?? 0;
          popover.wrapper.setAttribute("role", "dialog");
          popover.wrapper.setAttribute("aria-label", passos[idx]?.titulo ?? tour.titulo);

          const head = document.createElement("div");
          head.className = "omnia-tour-head";
          popover.wrapper.insertBefore(head, popover.title);
          head.append(popover.progress, popover.title);

          const pular = document.createElement("button");
          pular.type = "button";
          pular.className = "omnia-tour-skip";
          pular.textContent = "Pular";
          pular.addEventListener("click", () => drv.destroy());
          popover.footer.insertBefore(pular, popover.footer.firstChild);

          if (idx === 0) popover.previousButton.style.display = "none";

          const dots = document.createElement("div");
          dots.className = "omnia-tour-dots";
          dots.setAttribute("aria-hidden", "true");
          for (let i = 0; i < total; i++) {
            const dot = document.createElement("span");
            dot.dataset.ativo = String(i === idx);
            dots.append(dot);
          }
          popover.wrapper.append(dots);

          requestAnimationFrame(() => popover.nextButton.focus({ preventScroll: true }));
        },
        onDestroyed: () => {
          clearInterval(vigia);
          driverRef.current = null;
          if (!naoMarcarRef.current) marcar(tour);
          // Devolve o foco ao botão "?".
          document.querySelector<HTMLElement>("[data-help-button]")?.focus({ preventScroll: true });
        },
      });

      driverRef.current = d;
      d.drive(0);

      // Se o elemento do passo sumir (ex.: a lista recarregou), avança; no último, conclui.
      const vigia = setInterval(() => {
        const idx = d.getActiveIndex();
        if (idx === undefined) return;
        const alvo = passos[idx]?.alvo;
        if (alvo && !alvoVisivel(alvo)) {
          if (d.hasNextStep()) d.moveNext();
          else d.destroy();
        }
      }, 400);
      return true;
    },
    [marcar],
  );

  // Espera a página ficar pronta e abre o tour. Devolve uma função de cancelamento.
  const abrirQuandoPronto = useCallback(
    (tour: Tour): (() => void) => {
      const rota = pathnameRef.current;
      const cancelado = () => pathnameRef.current !== rota;
      const timers: ReturnType<typeof setTimeout>[] = [];
      let observer: MutationObserver | undefined;
      const limpar = () => {
        timers.forEach(clearTimeout);
        observer?.disconnect();
      };

      const iniciarSePossivel = () => {
        if (cancelado() || driverRef.current) return;
        abrir(tour);
      };

      const aposPronto = () => {
        if (cancelado()) return;
        // Dá um instante para os avisos (Follow-up, Aquecimento, Mudanças) aparecerem.
        timers.push(
          setTimeout(() => {
            if (cancelado()) return;
            if (!dialogoAberto()) return iniciarSePossivel();
            // Há outro aviso aberto: tenta uma única vez quando ele fechar.
            observer = new MutationObserver(() => {
              if (cancelado()) return limpar();
              if (!dialogoAberto()) {
                limpar();
                timers.push(setTimeout(() => (!cancelado() && !dialogoAberto() ? iniciarSePossivel() : undefined), 300));
              }
            });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true });
          }, ASSENTAR_MS),
        );
      };

      // Considera a página pronta quando um dos dois primeiros alvos aparece
      // (em tela estreita o menu lateral fica recolhido e é removido do tour).
      const primeiros = tour.passos.slice(0, 2).map((p) => p.alvo).filter((s): s is string => !!s);
      const inicio = Date.now();
      const sondar = () => {
        if (cancelado()) return;
        if (primeiros.some(alvoVisivel)) return aposPronto();
        if (Date.now() - inicio >= POLL_MAX_MS) return; // não inicia e não marca
        timers.push(setTimeout(sondar, POLL_MS));
      };
      sondar();
      return () => {
        limpar();
      };
    },
    [abrir],
  );

  // Mudou de rota: fecha o tour aberto sem marcar como visto.
  useEffect(() => {
    if (driverRef.current) {
      naoMarcarRef.current = true;
      driverRef.current.destroy();
    }
  }, [pathname]);

  // Abertura automática na 1ª visita (ou quando a versão do tour sobe).
  const autoTentadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!tourAtual || vistosQ.isLoading || vistosQ.isError) return;
    if (pedidoRef.current) return; // um pedido manual tem prioridade
    if (autoTentadoRef.current === pathname) return;
    if (situacaoDoTour(tourAtual, vistosRef.current) === "visto") {
      autoTentadoRef.current = pathname;
      return;
    }
    autoTentadoRef.current = pathname;
    abrirQuandoPronto(tourAtual);
  }, [pathname, tourAtual, vistosQ.isLoading, vistosQ.isError, abrirQuandoPronto]);

  // Pedido de "Rever": navega e inicia assim que a página estiver pronta.
  useEffect(() => {
    if (!pedido) return;
    const tour = tourPorId(pedido);
    if (!tour) {
      pedidoRef.current = null;
      setPedido(null);
      return;
    }
    if (!tour.rotas.includes(pathname)) return;
    pedidoRef.current = null;
    setPedido(null);
    autoTentadoRef.current = pathname;
    abrirQuandoPronto(tour);
  }, [pedido, pathname, abrirQuandoPronto]);

  const iniciar = useCallback(
    (id?: string) => {
      const tour = id ? tourPorId(id) : tourAtual;
      if (tour) abrir(tour);
    },
    [abrir, tourAtual],
  );

  const iniciarAposNavegar = useCallback(
    (id: string) => {
      const tour = tourPorId(id);
      if (!tour) return;
      pedidoRef.current = id;
      setPedido(id);
      if (!tour.rotas.includes(pathnameRef.current)) navigate({ to: tour.rotas[0] as never });
    },
    [navigate],
  );

  const situacao = useCallback(
    (id: string): SituacaoTour => {
      const tour = tourPorId(id);
      return tour ? situacaoDoTour(tour, vistos) : "nao_visto";
    },
    [vistos],
  );

  const value = useMemo<TourContextValue>(
    () => ({ tourDaRota: tourAtual, iniciar, iniciarAposNavegar, situacao, carregando: vistosQ.isLoading }),
    [tourAtual, iniciar, iniciarAposNavegar, situacao, vistosQ.isLoading],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
