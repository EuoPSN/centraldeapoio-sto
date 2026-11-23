import { useEffect, useState } from "react";
import { ClienteDisse } from "./ClienteDisse";
import { ConversaAba, type ContextoConversa } from "./Conversa";
import { Diagnostico } from "./Diagnostico";
import { Hoje } from "./Hoje";
import { OQueFaz } from "./OQueFaz";
import { Tempo } from "./Tempo";
import { alternarPausa, aceiteConfirmado, confirmarAceite, usePausada } from "../lib/estado";
import { ignorarContato } from "../lib/ignorados";
import { registrarEvento } from "../lib/eventos";

type Aba = "conversa" | "hoje" | "tempo";
type Vista = "ticket" | "cliente_disse" | "oquefaz" | "diagnostico";

export function Principal({ usuarioId, email, onSair }: { usuarioId: string; email: string; onSair: () => void }) {
  const [aba, setAba] = useState<Aba>("conversa");
  const [contexto, setContexto] = useState<ContextoConversa | null>(null);
  const [vista, setVista] = useState<Vista>("ticket");
  const [contagem, setContagem] = useState(0);
  const [atualizarHoje, setAtualizarHoje] = useState(0);
  const [aceito, setAceito] = useState<boolean | null>(null);
  const [reiniciar, setReiniciar] = useState(0);
  const [aviso, setAviso] = useState<string>();
  const pausada = usePausada();

  useEffect(() => { void aceiteConfirmado(usuarioId).then(setAceito); }, [usuarioId]);

  async function ignorar(c: { nome: string; numero: string }) {
    const ok = await ignorarContato(usuarioId, c);
    if (!ok) { setAviso("Não consegui ignorar este contato agora. Tente de novo."); setReiniciar((n) => n + 1); return; }
    void registrarEvento(usuarioId, "conversa_ignorada");
    setContexto(null);
    setAviso("Contato ignorado. Esta conversa não será lida, nem com clique. Para voltar a ler, clique em “Ler esta conversa” e depois em “Voltar a ler”.");
    setReiniciar((n) => n + 1);
    setVista("ticket");
    setAba("conversa");
  }

  async function entendi() {
    await confirmarAceite(usuarioId);
    setAceito(true);
  }

  const conteudoPrincipal = () => {
    if (aceito === null) return <p className="carregando">Carregando…</p>;
    if (aceito === false) {
      return <OQueFaz primeiraVez onEntendi={entendi} onPausar={() => undefined} pausada={pausada} onIgnorar={() => undefined} podeIgnorar={false} onVoltar={() => undefined} />;
    }
    return null;
  };
  const travado = aceito !== true;

  return (
    <div className="app">
      <header className="topo">
        <span className="marca">OMNIA<small>APOIO</small></span>
        <button className="pilula" onClick={() => void alternarPausa(usuarioId)} aria-pressed={pausada} style={{ letterSpacing: ".12em", fontWeight: 600 }}>
          {pausada ? "▶ Retomar" : "❚❚ Pausar"}
        </button>
      </header>
      {pausada && <p className="aviso" role="status" style={{ margin: "0 16px 8px" }}>Extensão pausada: nada é lido e nenhuma chamada é feita.</p>}
      {!travado && (
        <nav className="abas" role="tablist">
          <button className="aba" role="tab" aria-selected={aba === "conversa"} onClick={() => setAba("conversa")}>Esta conversa</button>
          <button className="aba" role="tab" aria-selected={aba === "hoje"} onClick={() => setAba("hoje")}>
            Hoje{contagem > 0 && <span className="selo">{contagem}</span>}
          </button>
          <button className="aba" role="tab" aria-selected={aba === "tempo"} onClick={() => setAba("tempo")}>Tempo de resposta</button>
        </nav>
      )}
      <main className="conteudo">
        {travado ? conteudoPrincipal() : vista === "oquefaz" ? (
          <OQueFaz
            primeiraVez={false} onEntendi={() => undefined} pausada={pausada}
            onPausar={() => void alternarPausa(usuarioId)}
            podeIgnorar={!!contexto} onIgnorar={() => contexto && void ignorar(contexto)}
            onVoltar={() => setVista("ticket")}
          />
        ) : vista === "diagnostico" ? (
          <Diagnostico onVoltar={() => setVista("ticket")} />
        ) : null}
        {/* Tudo fica montado: trocar de aba ou voltar ao ticket não perde a proposta em edição. */}
        {!travado && vista !== "oquefaz" && vista !== "diagnostico" && <Tempo usuarioId={usuarioId} ativa={aba === "tempo"} pausada={pausada} />}
        <div hidden={travado || vista === "oquefaz" || vista === "diagnostico" || aba !== "conversa"}>
          <div hidden={vista !== "ticket"}>
            <ConversaAba
              usuarioId={usuarioId}
              bloqueio={pausada ? "A extensão está pausada. Toque em “Retomar” para voltar a ler." : undefined}
              aviso={aviso}
              onSalvo={() => setAtualizarHoje((n) => n + 1)}
              onContexto={setContexto}
              onIgnorar={ignorar}
              onAbrirClienteDisse={() => setVista("cliente_disse")}
              onAbrirDiagnostico={() => setVista("diagnostico")}
              reiniciar={reiniciar}
            />
          </div>
          {vista === "cliente_disse" && <ClienteDisse contexto={contexto} onVoltar={() => setVista("ticket")} />}
        </div>
        {!travado && vista !== "oquefaz" && vista !== "diagnostico" && <Hoje ativa={aba === "hoje"} atualizar={atualizarHoje} onContagem={setContagem} pausada={pausada} />}
      </main>
      <footer className="rodape">
        <span>{email}</span>
        <span style={{ display: "flex", gap: 12 }}>
          {!travado && <button onClick={() => setVista("oquefaz")}>O que a extensão faz</button>}
          {!travado && <button onClick={() => setVista("diagnostico")}>Diagnóstico</button>}
          <button onClick={onSair}>Sair</button>
        </span>
      </footer>
    </div>
  );
}
