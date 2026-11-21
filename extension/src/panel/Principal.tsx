import { useState } from "react";
import { ClienteDisse } from "./ClienteDisse";
import { ConversaAba, type ContextoConversa } from "./Conversa";

export function Principal({ usuarioId, email, onSair }: { usuarioId: string; email: string; onSair: () => void }) {
  const [contexto, setContexto] = useState<ContextoConversa | null>(null);
  const [vista, setVista] = useState<"ticket" | "cliente_disse">("ticket");
  return (
    <div className="app">
      <header className="topo">
        <span className="marca">OMNIA<small>APOIO</small></span>
      </header>
      <main className="conteudo">
        {/* As duas vistas ficam montadas: voltar ao ticket não perde a proposta em edição. */}
        <div hidden={vista !== "ticket"}>
          <ConversaAba
            usuarioId={usuarioId}
            onSalvo={() => undefined}
            onContexto={setContexto}
            onIgnorar={() => undefined}
            onAbrirClienteDisse={() => setVista("cliente_disse")}
            reiniciar={0}
          />
        </div>
        {vista === "cliente_disse" && <ClienteDisse contexto={contexto} onVoltar={() => setVista("ticket")} />}
      </main>
      <footer className="rodape">
        <span>{email}</span>
        <button onClick={onSair}>Sair</button>
      </footer>
    </div>
  );
}
