import { useState } from "react";
import { ConversaAba, type ContextoConversa } from "./Conversa";

export function Principal({ usuarioId, email, onSair }: { usuarioId: string; email: string; onSair: () => void }) {
  const [, setContexto] = useState<ContextoConversa | null>(null);
  return (
    <div className="app">
      <header className="topo">
        <span className="marca">OMNIA<small>APOIO</small></span>
      </header>
      <main className="conteudo">
        <ConversaAba
          usuarioId={usuarioId}
          onSalvo={() => undefined}
          onContexto={setContexto}
          onIgnorar={() => undefined}
          onAbrirClienteDisse={() => undefined}
          reiniciar={0}
        />
      </main>
      <footer className="rodape">
        <span>{email}</span>
        <button onClick={onSair}>Sair</button>
      </footer>
    </div>
  );
}
