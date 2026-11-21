import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { mensagemDeLogin } from "../lib/supabase-mensagens";
import { CONFIG } from "../config";

export function Login({ aviso }: { aviso?: string }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) setErro(mensagemDeLogin(error.message));
    } catch (err) {
      setErro(mensagemDeLogin(err instanceof Error ? err.message : ""));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="app">
      <header className="topo"><span className="marca">OMNIA<small>APOIO</small></span></header>
      <main className="conteudo">
        <h2>Entrar</h2>
        <p className="suave">Use o mesmo e-mail e a mesma senha da Omnia.</p>
        {aviso && <p className="aviso" role="status">{aviso}</p>}
        <form onSubmit={entrar}>
          <label className="campo"><span>E-mail</span>
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="campo"><span>Senha</span>
            <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="btn primario bloco" disabled={enviando || !email || !senha}>{enviando ? "Entrando…" : "Entrar"}</button>
        </form>
        <p className="suave" style={{ marginTop: 16 }}>
          Ainda não tem conta? A conta é criada na Omnia: <a href={CONFIG.OMNIA_URL} target="_blank" rel="noreferrer">abrir a Omnia</a>.
        </p>
      </main>
    </div>
  );
}
