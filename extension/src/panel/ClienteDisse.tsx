import { useEffect, useState } from "react";
import { chamar } from "../lib/api";
import { primeiroNome } from "../lib/sanitizar";
import type { ContextoConversa } from "./Conversa";

// Espelho de ClienteDisseResposta (src/lib/extensao.ts na Omnia).
interface Resposta {
  itens: { tipo: "objecao" | "sinal" | "travamento"; id: string; nome: string }[];
  objecao: {
    id: string | null; nome: string; sugestao_ia: boolean;
    leituras: { titulo: string; pergunta: string }[];
    angulos: { tipo: string; rotulo: string; texto: string }[];
    pergunta_avancar: string | null; evite_dizer: string | null;
  } | null;
  item_mensagem: { titulo: string; mensagem: string | null; passos: string[] } | null;
  casos: { titulo: string; mensagem_chave: string; por_que_funcionou: string; dias_ate_fechar: number | null }[];
}

const TIPO_ITEM = { objecao: "Objeção", sinal: "Sinal de compra", travamento: "Travamento" } as const;

/** Copia para a área de transferência. NUNCA escreve na caixa do WhatsApp e nunca envia. */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Este código roda no painel da extensão (não na página do WhatsApp).
    const ta = document.createElement("textarea");
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function ClienteDisse({ contexto, onVoltar }: { contexto: ContextoConversa | null; onVoltar: () => void }) {
  const [estado, setEstado] = useState<"vazio" | "carregando" | "ok" | "erro">("vazio");
  const [resp, setResp] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [indice, setIndice] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const fala = contexto?.ultimaFala ?? "";

  useEffect(() => {
    let cancelado = false;
    setResp(null); setIndice(0); setCopiado(false);
    if (!fala) { setEstado("vazio"); return; }
    setEstado("carregando");
    chamar<Resposta>("cliente-disse", { op: "responder", fala, ponto: contexto?.ponto ?? null }).then((r) => {
      if (cancelado) return;
      if (r.ok) { setResp(r.dados); setEstado("ok"); } else { setErro(r.erro); setEstado("erro"); }
    });
    return () => { cancelado = true; };
  }, [fala, contexto?.ponto]);

  if (!contexto || !fala) {
    return (
      <div className="card">
        <h2>O cliente disse…</h2>
        <p className="suave">Primeiro leia a conversa na aba “Esta conversa”. Aqui aparece a última fala do cliente e o que responder.</p>
        <button className="btn bloco" onClick={onVoltar}>Voltar ao ticket</button>
      </div>
    );
  }

  const nome = primeiroNome(contexto.nome);
  const personalizar = (t: string) => t.replace(/\{nome\}|\[nome\]/gi, nome || "").replace(/\s{2,}/g, " ").trim();
  const angulos = resp?.objecao?.angulos ?? [];
  const angulo = angulos.length ? angulos[indice % angulos.length] : null;
  const texto = angulo ? personalizar(angulo.texto) : resp?.item_mensagem?.mensagem ? personalizar(resp.item_mensagem.mensagem) : "";

  async function aoCopiar() {
    if (!texto) return;
    if (await copiar(texto)) {
      setCopiado(true);
      if (resp?.objecao?.id) void chamar("cliente-disse", { op: "copiou", objecao_id: resp.objecao.id, angulo: angulo?.tipo ?? null });
      setTimeout(() => setCopiado(false), 2500);
    }
  }

  return (
    <div>
      <p className="suave"><span className="ponto" />Lendo só esta conversa · não é um grupo</p>
      <div className="card destaque">
        <p className="rotulo">O cliente disse…</p>
        <p style={{ fontWeight: 600 }}>“{fala}”</p>
        {resp && resp.itens.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {resp.itens.map((i) => <span key={i.id} className="pilula fixa">{TIPO_ITEM[i.tipo]}: {i.nome}</span>)}
          </div>
        )}
      </div>

      {estado === "carregando" && <p className="carregando">Analisando a fala…</p>}
      {estado === "erro" && <div className="aviso" role="alert">{erro}</div>}

      {estado === "ok" && resp && !resp.objecao && !resp.item_mensagem && (
        <div className="card"><p style={{ margin: 0 }}>Não encontrei uma objeção ou sinal conhecido nesta fala. Responda do seu jeito, olhando a conversa.</p></div>
      )}

      {resp?.objecao && resp.objecao.leituras.length > 0 && (
        <div className="card">
          <h2>O que pode estar por trás</h2>
          {resp.objecao.leituras.slice(0, 3).map((l, i) => (
            <p key={i} style={{ marginBottom: 6 }}>{l.titulo}{l.pergunta ? <span className="suave"> · Vale perguntar: {l.pergunta}</span> : null}</p>
          ))}
        </div>
      )}

      {texto && (
        <div className="card destaque">
          <p className="rotulo">Resposta sugerida · você decide{resp?.objecao?.sugestao_ia ? " · sugestão da IA, ainda não aprovada" : ""}</p>
          {angulo?.rotulo && <p className="suave" style={{ margin: "0 0 4px" }}>{angulo.rotulo}</p>}
          <p style={{ whiteSpace: "pre-wrap" }}>{texto}</p>
          <div className="linha">
            <button className="btn primario" onClick={aoCopiar}>{copiado ? "Copiado ✓" : "Copiar"}</button>
            <button className="btn" onClick={() => { setIndice((i) => i + 1); setCopiado(false); }} disabled={angulos.length < 2}>Outro ângulo</button>
          </div>
        </div>
      )}
      {resp?.objecao?.evite_dizer && <p className="suave">Evite dizer: {resp.objecao.evite_dizer}</p>}

      {resp && resp.casos.length > 0 && (
        <div className="card">
          <p className="rotulo">Casos parecidos que fecharam</p>
          {resp.casos.map((c, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <strong>{c.titulo}</strong>
              {c.mensagem_chave && <p style={{ margin: "2px 0" }}>“{c.mensagem_chave}”</p>}
              <span className="suave">{c.por_que_funcionou}{c.dias_ate_fechar != null ? ` · fechou em ${c.dias_ate_fechar} dia(s)` : ""}</span>
            </div>
          ))}
        </div>
      )}

      <p className="suave">Você cola no WhatsApp e envia. A extensão não escreve nem envia nada sozinha.</p>
      <button className="btn bloco" onClick={onVoltar}>Voltar ao ticket</button>
    </div>
  );
}
