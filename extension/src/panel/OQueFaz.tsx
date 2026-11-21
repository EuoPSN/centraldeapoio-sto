export function OQueFaz({
  primeiraVez, onEntendi, onPausar, pausada, onIgnorar, podeIgnorar, onVoltar,
}: {
  primeiraVez: boolean;
  onEntendi: () => void;
  onPausar: () => void;
  pausada: boolean;
  onIgnorar: () => void;
  podeIgnorar: boolean;
  onVoltar: () => void;
}) {
  return (
    <div>
      <div className="card destaque">
        <h2>O que a extensão faz</h2>
        <p className="suave" style={{ margin: 0 }}>Em palavras simples, para você saber o que acontece.</p>
      </div>
      <ul className="lista" style={{ marginBottom: 14 }}>
        <li className="ok" style={{ display: "block" }}>Lê <strong>só a conversa que você abriu</strong>, e só quando você clica em “Ler esta conversa”.</li>
        <li className="ok" style={{ display: "block" }}>Olha a <strong>lista de conversas</strong> (nome, prévia, horário) para medir o tempo de resposta. Não abre nenhuma.</li>
        <li className="ok" style={{ display: "block" }}>Tira <strong>telefone, CPF e e-mail</strong> antes de usar a IA. A conversa <strong>não é guardada</strong>.</li>
        <li className="ok" style={{ display: "block" }}>Guarda no ticket só: primeiro nome, telefone (só você vê), etapa, ponto de parada e observação.</li>
        <li className="nao" style={{ display: "block" }}><strong>Nunca lê grupos</strong>, comunidades, listas de transmissão e Status.</li>
        <li className="nao" style={{ display: "block" }}><strong>Nunca envia</strong> mensagem nem escreve na caixa de texto. Você copia e cola.</li>
        <li className="nao" style={{ display: "block" }}>Não rola o histórico nem abre conversas sozinha.</li>
      </ul>
      {primeiraVez ? (
        <button className="btn primario bloco" onClick={onEntendi}>Entendi</button>
      ) : (
        <>
          <div className="linha">
            <button className="btn" onClick={onPausar}>{pausada ? "Retomar a extensão" : "Pausar a extensão"}</button>
            <button className="btn" onClick={onIgnorar} disabled={!podeIgnorar}>Ignorar este contato</button>
          </div>
          <button className="btn bloco" style={{ marginTop: 8 }} onClick={onVoltar}>Voltar</button>
        </>
      )}
      <p className="suave" style={{ marginTop: 12 }}>O Paulo vê só números (tickets, tempo de resposta). Nunca o conteúdo das conversas.</p>
    </div>
  );
}
