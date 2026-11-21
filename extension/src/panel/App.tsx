import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Login } from "./Login";
import { Principal } from "./Principal";

export function App() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const tinhaSessao = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      tinhaSessao.current = !!data.session;
      setPronto(true);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      // Sessão expirada (não foi o botão Sair): volta ao login com aviso. O que é local
      // (Pausar, aceite do aviso) fica guardado e não se perde.
      if (evento === "SIGNED_OUT" && tinhaSessao.current && !saiuDeProposito.current) setAviso("Sua sessão expirou. Entre de novo.");
      if (evento === "SIGNED_IN") setAviso(undefined);
      saiuDeProposito.current = false;
      tinhaSessao.current = !!s;
      setSessao(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const saiuDeProposito = useRef(false);
  async function sair() {
    saiuDeProposito.current = true;
    setAviso(undefined);
    await supabase.auth.signOut();
  }

  if (!pronto) return <div className="app"><p className="carregando">Carregando…</p></div>;
  if (!sessao) return <Login aviso={aviso} />;
  return <Principal usuarioId={sessao.user.id} email={sessao.user.email ?? ""} onSair={sair} />;
}
