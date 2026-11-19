import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Símbolo da MarcIAna: olho orbital (duas pálpebras em crescente = órbitas OMNIA,
// anel da íris e pupila). Desenho fiel a docs/redesign-omnia/marciana-olho.svg;
// animações portadas de docs/redesign-omnia/marciana-animacoes.html.
export type MarcianaEyeState = "idle" | "listening" | "thinking" | "writing" | "done" | "miss";

interface MarcianaEyeProps {
  /** Tamanho em px (largura = altura). */
  size?: number;
  state?: MarcianaEyeState;
  className?: string;
}

export function MarcianaEye({ size = 32, state = "idle", className }: MarcianaEyeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const irisRef = useRef<SVGGElement>(null);

  // Estado "listening": a pupila acompanha o mouse (campo de pergunta em foco).
  useEffect(() => {
    if (state !== "listening") return;
    const svg = svgRef.current;
    const iris = irisRef.current;
    if (!svg || !iris) return;
    const handler = (e: MouseEvent) => {
      const r = svg.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 300);
      iris.style.transform = `translate(${(dx / d) * 7 * k}px, ${(dy / d) * 3.5 * k}px)`;
    };
    window.addEventListener("mousemove", handler);
    return () => {
      window.removeEventListener("mousemove", handler);
      iris.style.transform = "";
    };
  }, [state]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("marciana-eye", `marciana-eye--${state}`, className)}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <g className="marciana-eye__eye" fill="currentColor">
        <path d="M10 52 Q50 4 90 42 Q50 20 10 52Z" />
        <path d="M90 48 Q50 96 10 58 Q50 80 90 48Z" />
        <g ref={irisRef} className="marciana-eye__iris">
          <circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" strokeWidth="4.5" />
          <circle className="marciana-eye__pupil" cx="50" cy="50" r="4" />
          <g className="marciana-eye__moon">
            <circle cx="50" cy="38" r="3.2" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/**
 * Adapta o MarcianaEye para a mesma assinatura dos ícones lucide-react
 * ({ className, strokeWidth }) — usado como ícone do grupo "Inteligência"
 * no menu lateral (estático, `idle`).
 */
export function MarcianaEyeIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <MarcianaEye state="idle" className={className} />;
}
