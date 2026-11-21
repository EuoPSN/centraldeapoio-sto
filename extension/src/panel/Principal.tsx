// Painel depois do login. As abas e telas entram nas próximas seções.
export function Principal({ email, onSair }: { usuarioId: string; email: string; onSair: () => void }) {
  return (
    <div className="app">
      <header className="topo">
        <span className="marca">OMNIA<small>APOIO</small></span>
      </header>
      <main className="conteudo">
        <p className="suave">Conectada como {email}.</p>
      </main>
      <footer className="rodape">
        <span>{email}</span>
        <button onClick={onSair}>Sair</button>
      </footer>
    </div>
  );
}
