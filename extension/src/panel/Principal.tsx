import { useState } from "react";
import { ClienteDisse } from "./ClienteDisse";
import { ConversaAba, type ContextoConversa } from "./Conversa";
import { Hoje } from "./Hoje";

type Aba = "conversa" | "hoje";

export function Principal({ usuarioId, email, onSair }: { usuarioId: string; email: string; onSair: () => void }) {
  const [aba, setAba] = useState<Aba>("conversa");
  const [contexto, setContexto] = useState<ContextoConversa | null>(null);
  const [vista, setVista] = useState<"ticket" | "cliente_disse">("ticket");
  const [contagem, setContagem] = useState(0);
  const [atualizarHoje, setAtualizarHoje] = useState(0);
  return (
    <div className="app">
      <header className="topo">
        <span className="marca">OMNIA<small>APOIO</small></span>
      </header>
      <nav className="abas" role="tablist">
        <button className="aba" role="tab" aria-selected={aba === "conversa"} onClick={() => setAba("conversa")}>Esta conversa</button>
        <button className="aba" role="tab" aria-selected={aba === "hoje"} onClick={() => setAba("hoje")}>
          Hoje{contagem > 0 && <span className="selo">{contagem}</span>}
        </button>
      </nav>
      <main className="conteudo">
        {/* Tudo fica montado: trocar de aba ou voltar ao ticket não perde a proposta em edição. */}
        <div hidden={aba !== "conversa"}>
          <div hidden={vista !== "ticket"}>
            <ConversaAba
              usuarioId={usuarioId}
              onSalvo={() => setAtualizarHoje((n) => n + 1)}
              onContexto={setContexto}
              onIgnorar={() => undefined}
              onAbrirClienteDisse={() => setVista("cliente_disse")}
              reiniciar={0}
            />
          </div>
          {vista === "cliente_disse" && <ClienteDisse contexto={contexto} onVoltar={() => setVista("ticket")} />}
        </div>
        <Hoje ativa={aba === "hoje"} atualizar={atualizarHoje} onContagem={setContagem} />
      </main>
      <footer className="rodape">
        <span>{email}</span>
        <button onClick={onSair}>Sair</button>
      </footer>
    </div>
  );
}
