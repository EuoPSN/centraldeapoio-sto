import { useState } from "react";
import { chamar } from "../lib/api";
import { identificarConversa, lerConversaAberta } from "../lib/conteudo";
import { carregarHashesIgnorados } from "../lib/ignorados";
import { registrarEvento } from "../lib/eventos";
import { numeroMascarado } from "../lib/numeros";
import { sanitizarMensagens, ultimaFalaDoCliente } from "../lib/sanitizar";
import { CONFIG } from "../config";
import { dataCurta, rotuloCampo, rotuloValor, type QuandoId } from "../lib/rotulos";
import { FormTicket, type CamposForm } from "./FormTicket";

// Tipos das respostas de /api/extensao/* (espelho de src/lib/extensao.ts na Omnia).
export interface TicketDTO {
  id: string; codigo: string; primeiro_nome: string; etapa_funil: string | null; ponto_parada: string; plano: string | null;
  dependentes: number | null; observacao: string; status: string; etapa_atual: string; proxima_em: string | null; created_at: string; updated_at: string;
}
interface Proposta { etapa_funil: string; ponto_parada: string; plano: string; dependentes: number | null; observacao: string; quando_retomar: string; objecoes_detectadas: string[] }
interface Hist { campo: string; valor_anterior: string | null; valor_novo: string | null; origem: string; created_at: string }
interface Consulta { existente: TicketDTO | null; historico: Hist[]; outroAtendente: boolean }
export interface Mudanca { campo: string; de: string | null; para: string | null }
interface Salvo { acao: "criado" | "atualizado"; ticket: TicketDTO; mudancas: Mudanca[]; outroAtendente: boolean }

export interface ContextoConversa { nome: string; numero: string; ultimaFala: string; ponto: string | null }

type Fase =
  | { t: "inicial" }
  | { t: "lendo"; passo: string }
  | { t: "erro"; motivo: string; naoLe: boolean; ignorado?: boolean }
  | { t: "proposta"; nome: string; numero: string; campos: CamposForm; original: CamposForm; consulta: Consulta; objecoes: string[] }
  | { t: "salvo"; r: Salvo };

const paraForm = (p: Proposta): CamposForm => ({
  etapa_funil: p.etapa_funil, ponto_parada: p.ponto_parada, plano: p.plano, dependentes: p.dependentes == null ? "" : String(p.dependentes),
  observacao: p.observacao, quando: p.quando_retomar,
});

/** Diferença (de → para) entre o ticket que já existe e o que está no formulário. */
export function diferencas(existente: TicketDTO, c: CamposForm): Mudanca[] {
  const norm = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());
  const pares: [string, unknown, unknown][] = [
    ["etapa_funil", existente.etapa_funil, c.etapa_funil],
    ["ponto_parada", existente.ponto_parada, c.ponto_parada],
    ["plano", existente.plano, c.plano],
    ["dependentes", existente.dependentes, c.dependentes],
    ["observacao", existente.observacao, c.observacao],
  ];
  return pares.filter(([, a, b]) => norm(a) !== norm(b)).map(([campo, a, b]) => ({ campo, de: norm(a), para: norm(b) }));
}

export function ConversaAba({
  usuarioId, bloqueio, onSalvo, onContexto, onIgnorar, onAbrirClienteDisse, reiniciar,
}: {
  usuarioId: string;
  /** Texto de por que o botão está travado (pausada, aviso não aceito). */
  bloqueio?: string;
  onSalvo: () => void;
  onContexto: (c: ContextoConversa | null) => void;
  onIgnorar: (c: { nome: string; numero: string }) => void;
  onAbrirClienteDisse: () => void;
  reiniciar: number;
}) {
  const [fase, setFase] = useState<Fase>({ t: "inicial" });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [prevReiniciar, setPrevReiniciar] = useState(reiniciar);
  if (prevReiniciar !== reiniciar) { setPrevReiniciar(reiniciar); setFase({ t: "inicial" }); }

  async function ler() {
    setErroSalvar(null);
    onContexto(null);
    setFase({ t: "lendo", passo: "Conferindo a conversa aberta…" });
    const id = await identificarConversa();
    if (!id.ok) return setFase({ t: "erro", motivo: id.motivo, naoLe: id.naoLe });

    const hashes = await carregarHashesIgnorados();
    setFase({ t: "lendo", passo: "Lendo as mensagens que estão na tela…" });
    const lida = await lerConversaAberta(usuarioId, hashes);
    if (!lida.ok) return setFase({ t: "erro", motivo: lida.motivo, naoLe: lida.naoLe, ignorado: lida.motivo.includes("ignorado") });
    const { nome, numero, mensagens } = lida.conversa;
    void registrarEvento(usuarioId, "leitura");

    // 1ª camada de sanitização: antes de enviar qualquer coisa. O telefone NÃO vai para a IA.
    const limpas = sanitizarMensagens(mensagens, { nome });
    if (!limpas.length) return setFase({ t: "erro", motivo: "Não há mensagens de texto para ler nesta conversa.", naoLe: false });
    const ultimaFala = ultimaFalaDoCliente(limpas);
    onContexto({ nome, numero, ultimaFala, ponto: null });

    setFase({ t: "lendo", passo: "A Omnia está montando a proposta…" });
    const [prop, cons] = await Promise.all([
      chamar<{ proposta: Proposta }>("ler-conversa", { mensagens: limpas.map(({ de, texto, hora }) => ({ de, texto, hora })) }),
      numero ? chamar<Consulta>("ticket", { op: "consultar", numero }) : Promise.resolve(null),
    ]);
    if (!prop.ok) return setFase({ t: "erro", motivo: prop.erro, naoLe: false });
    const consulta: Consulta = cons && cons.ok ? cons.dados : { existente: null, historico: [], outroAtendente: false };
    const campos = paraForm(prop.dados.proposta);
    onContexto({ nome, numero, ultimaFala, ponto: campos.ponto_parada });
    setFase({ t: "proposta", nome, numero, campos, original: campos, consulta, objecoes: prop.dados.proposta.objecoes_detectadas });
  }

  async function salvar(f: Extract<Fase, { t: "proposta" }>) {
    setSalvando(true);
    setErroSalvar(null);
    const r = await chamar<Salvo>("ticket", {
      op: "salvar", numero: f.numero, nome: f.nome,
      campos: { ...f.campos, dependentes: f.campos.dependentes === "" ? null : Number(f.campos.dependentes) },
    });
    setSalvando(false);
    if (!r.ok) return setErroSalvar(r.erro);
    setFase({ t: "salvo", r: r.dados });
    onSalvo();
  }

  if (fase.t === "inicial" || fase.t === "erro" || fase.t === "lendo") {
    return (
      <div>
        {fase.t === "erro" && (
          <div className="aviso" role="alert">
            <strong>{fase.ignorado ? "Este contato está ignorado" : fase.naoLe ? "Não li esta conversa" : "Não consegui ler esta conversa"}</strong>
            <p style={{ margin: "4px 0 0" }}>{fase.motivo}</p>
          </div>
        )}
        <div className="card">
          <h2>Esta conversa</h2>
          <p className="suave">Abra uma conversa individual no WhatsApp Web e clique no botão. A Omnia lê só as mensagens que já estão na tela e propõe o ticket para você conferir.</p>
          {bloqueio && <p className="erro" role="status">{bloqueio}</p>}
          <button className="btn primario bloco" onClick={ler} disabled={!!bloqueio || fase.t === "lendo"}>
            {fase.t === "lendo" ? fase.passo : "Ler esta conversa"}
          </button>
        </div>
        {fase.t === "lendo" && <p className="suave">Nada é salvo até você clicar em “Salvar ticket”.</p>}
      </div>
    );
  }

  if (fase.t === "salvo") {
    const { r } = fase;
    return (
      <div>
        <div className="card destaque">
          <h2>{r.acao === "criado" ? "Ticket criado" : "Ticket atualizado"}</h2>
          <p>{r.ticket.primeiro_nome} · {r.ticket.codigo}. Ele já está no <strong>Retomar hoje</strong> com a cadência e as mensagens prontas.</p>
          {r.outroAtendente && <p className="suave">Este contato já está com outro atendente.</p>}
        </div>
        <div className="linha">
          <a className="btn bloco" style={{ textAlign: "center", textDecoration: "none" }} href={`${CONFIG.OMNIA_URL}/retomar`} target="_blank" rel="noreferrer">Abrir o Retomar hoje ↗</a>
          <button className="btn" onClick={() => { setFase({ t: "inicial" }); onContexto(null); }}>Ler outra conversa</button>
        </div>
      </div>
    );
  }

  // Proposta
  const f = fase;
  const existente = f.consulta.existente;
  const muda = existente ? diferencas(existente, f.campos) : [];
  const mascarado = numeroMascarado(f.numero);
  const nomeMostrado = f.nome || (mascarado ? "Contato sem nome" : "Contato");
  return (
    <div>
      <p className="suave"><span className="ponto" />Lendo só esta conversa · não é um grupo</p>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>{nomeMostrado}</h2>
          <span className="suave">{mascarado ? `${mascarado} · só você vê o número` : "Número não visível nesta conversa"}</span>
        </div>
        <span className="pilula fixa">Conversa individual</span>
      </div>

      {f.consulta.outroAtendente && !existente && (
        <div className="card"><strong>Este contato já está com outro atendente.</strong><p className="suave" style={{ margin: "4px 0 0" }}>Você pode criar o seu ticket normalmente.</p></div>
      )}

      {existente ? (
        <>
          <div className="card destaque">
            <h2>Já existe um ticket deste número</h2>
            <p className="suave" style={{ margin: 0 }}>Criado em {dataCurta(existente.created_at)} por você. A Omnia vai atualizar o mesmo ticket, sem criar outro.</p>
          </div>
          <div className="card">
            <p className="rotulo">O que mudou desde o último ticket</p>
            {muda.length === 0 && <p className="suave">Nenhum campo mudou. Só o prazo de retomada será atualizado.</p>}
            {muda.map((m) => (
              <div key={m.campo} style={{ marginBottom: 8 }}>
                {m.campo === "observacao"
                  ? <div><strong>Nova observação:</strong> {m.para ?? "—"}</div>
                  : <div><span className="de">{rotuloValor(m.campo, m.de)}</span> → <strong>{rotuloValor(m.campo, m.para)}</strong></div>}
                <span className="suave">{rotuloCampo(m.campo)}</span>
              </div>
            ))}
            <details>
              <summary className="suave" style={{ cursor: "pointer" }}>Editar antes de atualizar</summary>
              <div style={{ marginTop: 10 }}><FormTicket valor={f.campos} onChange={(campos) => setFase({ ...f, campos })} /></div>
            </details>
          </div>
        </>
      ) : (
        <div className="card destaque">
          <p className="rotulo">Proposta da Omnia · confira antes de salvar</p>
          <FormTicket valor={f.campos} onChange={(campos) => setFase({ ...f, campos })} />
          {f.objecoes.length > 0 && <p className="suave">Objeções que apareceram: {f.objecoes.join("; ")}.</p>}
        </div>
      )}

      {erroSalvar && <p className="erro" role="alert">{erroSalvar}</p>}
      <div className="linha">
        <button className="btn primario" disabled={salvando} onClick={() => salvar(f)}>{salvando ? "Salvando…" : existente ? "Atualizar ticket" : "Salvar ticket"}</button>
        <button className="btn" disabled={salvando} onClick={() => { setFase({ t: "inicial" }); onContexto(null); }}>Corrigir</button>
      </div>
      <p className="suave" style={{ marginTop: 10 }}>
        {existente ? "Ao atualizar, o histórico do ticket guarda o que mudou." : "Ao salvar, o ticket entra no Retomar hoje com a cadência certa."} Você pode editar qualquer campo antes. “Corrigir” descarta esta proposta para você ler de novo.
      </p>
      <div className="linha" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <button className="pilula" style={{ flex: "0 0 auto" }} onClick={() => onIgnorar({ nome: f.nome, numero: f.numero })}>Ignorar este contato</button>
        <button className="pilula" style={{ flex: "0 0 auto" }} onClick={onAbrirClienteDisse}>Abrir em O cliente disse…</button>
      </div>
      {existente && f.consulta.historico.length > 0 && <Historico linhas={f.consulta.historico} />}
    </div>
  );
}

/** Agrupa as linhas do histórico por edição (mesmo horário) e mostra uma por edição. */
function Historico({ linhas }: { linhas: Hist[] }) {
  const grupos = new Map<string, Hist[]>();
  for (const l of linhas) grupos.set(l.created_at, [...(grupos.get(l.created_at) ?? []), l]);
  return (
    <div style={{ marginTop: 16 }}>
      <p className="rotulo">Histórico do ticket</p>
      <ul className="lista" style={{ borderLeft: "2px solid var(--line)", paddingLeft: 10 }}>
        {Array.from(grupos.entries()).map(([quando, ls]) => {
          const criado = ls.some((l) => l.campo === "ticket" && l.valor_novo === "criado");
          const etapa = ls.find((l) => l.campo === "etapa_funil");
          return (
            <li key={quando} style={{ display: "block", border: 0, padding: "6px 0" }}>
              {dataCurta(quando)} · {etapa ? rotuloValor("etapa_funil", etapa.valor_novo) : ls.map((l) => rotuloCampo(l.campo)).join(", ")}
              <div className="suave">{criado ? "Criado" : "Atualizado"} por você{ls[0].origem === "omnia" ? " na Omnia" : ""}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type { QuandoId };
