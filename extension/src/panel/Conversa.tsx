import { useEffect, useRef, useState } from "react";
import { chamar } from "../lib/api";
import { identificarConversa, lerConversaAberta, lerDadosDoContato } from "../lib/conteudo";
import { carregarHashesIgnorados, voltarALer } from "../lib/ignorados";
import { registrarEvento } from "../lib/eventos";
import { registrarResultado } from "../lib/diagnostico-estado";
import { numeroMascarado, validarTelefoneManual } from "../lib/numeros";
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
  | { t: "erro"; motivo: string; naoLe: boolean; codigo?: string; ignorado?: { nome: string; numero: string } }
  | { t: "proposta"; nome: string; numero: string; numeroLido: boolean; editandoNumero?: boolean; campos: CamposForm; original: CamposForm; consulta: Consulta; objecoes: string[] }
  | { t: "salvo"; r: Salvo };

const paraForm = (p: Proposta): CamposForm => ({
  etapa_funil: p.etapa_funil, ponto_parada: p.ponto_parada, plano: p.plano, dependentes: p.dependentes == null ? "" : String(p.dependentes),
  observacao: p.observacao, quando: p.quando_retomar,
});

function tituloDoErro(f: { codigo?: string; naoLe: boolean; ignorado?: unknown }): string {
  if (f.ignorado) return "Este contato está ignorado";
  if (f.codigo === "sem_content_script") return "A Omnia não está ativa nesta aba";
  if (f.codigo === "sem_conversa") return "Nenhuma conversa aberta";
  return f.naoLe ? "Não li esta conversa" : "Não consegui ler esta conversa";
}

/** O link "Ver diagnóstico" aparece quando a causa pode ser layout/seletor (não grupo, ignorado nem pausa). */
function comLinkDiagnostico(codigo?: string): boolean {
  return !!codigo && !["grupo", "grupo_varios_remetentes", "sem_mensagem_do_cliente", "ignorado", "pausada", "erro_servidor"].includes(codigo);
}

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
  usuarioId, bloqueio, aviso, onSalvo, onContexto, onIgnorar, onAbrirClienteDisse, onAbrirDiagnostico, reiniciar,
}: {
  usuarioId: string;
  /** Mensagem de status vinda de fora (ex.: "Contato ignorado"). */
  aviso?: string;
  /** Texto de por que o botão está travado (pausada, aviso não aceito). */
  bloqueio?: string;
  onSalvo: () => void;
  onContexto: (c: ContextoConversa | null) => void;
  onIgnorar: (c: { nome: string; numero: string }) => void;
  onAbrirClienteDisse: () => void;
  onAbrirDiagnostico: () => void;
  reiniciar: number;
}) {
  const [fase, setFase] = useState<Fase>({ t: "inicial" });
  const ultimaFalaRef = useRef("");
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [prevReiniciar, setPrevReiniciar] = useState(reiniciar);
  if (prevReiniciar !== reiniciar) { setPrevReiniciar(reiniciar); setFase({ t: "inicial" }); }

  async function ler() {
    setErroSalvar(null);
    onContexto(null);
    setFase({ t: "lendo", passo: "Conferindo a conversa aberta…" });
    const falhar = (motivo: string, naoLe: boolean, codigo: string, ignorado?: { nome: string; numero: string }) => {
      registrarResultado(codigo, motivo); // sem conteúdo da conversa: só o código e o texto fixo do motivo
      setFase({ t: "erro", motivo, naoLe, codigo, ignorado });
    };
    const id = await identificarConversa();
    if (!id.ok) return falhar(id.motivo, id.naoLe, id.codigo ?? "falha");

    const hashes = await carregarHashesIgnorados();
    setFase({ t: "lendo", passo: "Lendo as mensagens que estão na tela…" });
    const lida = await lerConversaAberta(usuarioId, hashes);
    if (!lida.ok) return falhar(lida.motivo, lida.naoLe, lida.codigo ?? "falha", lida.codigo === "ignorado" ? { nome: id.id.nome, numero: id.id.numero } : undefined);
    registrarResultado("leitura_ok", "Conversa individual confirmada e mensagens lidas.");
    const { nome, numero, mensagens } = lida.conversa;
    void registrarEvento(usuarioId, "leitura");

    // 1ª camada de sanitização: antes de enviar qualquer coisa. O telefone NÃO vai para a IA.
    const limpas = sanitizarMensagens(mensagens, { nome });
    if (!limpas.length) return falhar("Não há mensagens de texto para ler nesta conversa.", false, "sem_mensagens_de_texto");
    const ultimaFala = ultimaFalaDoCliente(limpas);
    ultimaFalaRef.current = ultimaFala;
    onContexto({ nome, numero, ultimaFala, ponto: null });

    setFase({ t: "lendo", passo: "A Omnia está montando a proposta…" });
    const [prop, cons] = await Promise.all([
      chamar<{ proposta: Proposta }>("ler-conversa", { mensagens: limpas.map(({ de, texto, hora }) => ({ de, texto, hora })) }),
      numero ? chamar<Consulta>("ticket", { op: "consultar", numero }) : Promise.resolve(null),
    ]);
    if (!prop.ok) { registrarResultado("erro_servidor", "A Omnia não conseguiu montar a proposta."); return setFase({ t: "erro", motivo: prop.erro, naoLe: false, codigo: "erro_servidor" }); }
    const consulta: Consulta = cons && cons.ok ? cons.dados : { existente: null, historico: [], outroAtendente: false };
    const campos = paraForm(prop.dados.proposta);
    onContexto({ nome, numero, ultimaFala, ponto: campos.ponto_parada });
    setFase({ t: "proposta", nome, numero, numeroLido: !!numero, campos, original: campos, consulta, objecoes: prop.dados.proposta.objecoes_detectadas });
  }

  // Última consulta pedida: respostas antigas (de números já trocados) são descartadas.
  const consultaAtual = useRef(0);

  /** Telefone digitado/corrigido: refaz a consulta de ticket existente. O número só entra no pedido
   * de consultar/salvar ticket, nunca no de ler conversa (IA). */
  async function definirNumero(f: Extract<Fase, { t: "proposta" }>, digitos: string) {
    const minha = ++consultaAtual.current;
    setFase({ ...f, numero: digitos, editandoNumero: false });
    onContexto({ nome: f.nome, numero: digitos, ultimaFala: ultimaFalaRef.current, ponto: f.campos.ponto_parada });
    const vazia: Consulta = { existente: null, historico: [], outroAtendente: false };
    const cons = digitos ? await chamar<Consulta>("ticket", { op: "consultar", numero: digitos }) : null;
    if (minha !== consultaAtual.current) return;
    setFase((atual) => (atual.t === "proposta" ? { ...atual, consulta: cons && cons.ok ? cons.dados : vazia } : atual));
  }

  async function voltarALerContato(c: { nome: string; numero: string }) {
    await voltarALer(usuarioId, c);
    await ler();
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
        {fase.t === "inicial" && aviso && <p className="aviso" role="status">{aviso}</p>}
        {fase.t === "erro" && (
          <div className="aviso" role="alert">
            <strong>{tituloDoErro(fase)}</strong>
            <p style={{ margin: "4px 0 0" }}>{fase.motivo}</p>
            {comLinkDiagnostico(fase.codigo) && (
              <button className="pilula" style={{ marginTop: 6 }} onClick={onAbrirDiagnostico}>Ver diagnóstico</button>
            )}
            {fase.ignorado && <button className="pilula" style={{ marginTop: 6 }} onClick={() => voltarALerContato(fase.ignorado!)}>Voltar a ler</button>}
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
        {fase.t === "lendo" && <p className="suave"><span className="ponto" />Lendo só esta conversa. Nada é salvo até você clicar em “Salvar ticket”.</p>}
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
          {mascarado && !f.editandoNumero && (
            <span className="suave">{mascarado} · só você vê o número{" "}
              <button className="pilula" style={{ flex: "0 0 auto" }} onClick={() => setFase({ ...f, editandoNumero: true })}>Corrigir</button>
            </span>
          )}
        </div>
        <span className="pilula fixa">Conversa individual</span>
      </div>

      {(!mascarado || f.editandoNumero) && (
        <CampoTelefone
          inicial=""
          onValido={(d) => void definirNumero(f, d)}
          onCancelar={f.editandoNumero ? () => setFase({ ...f, editandoNumero: false }) : undefined}
          comAviso={!f.numero}
        />
      )}

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

/** Campo "Telefone (opcional)": valida ao digitar e só avisa o painel quando o número é válido. */
function CampoTelefone({ inicial, onValido, onCancelar, comAviso }: {
  inicial: string; onValido: (digitos: string) => void; onCancelar?: () => void; comAviso: boolean;
}) {
  const [texto, setTexto] = useState(inicial);
  const v = validarTelefoneManual(texto);
  // Número em "Dados do contato": só se o atendente abriu a aba. Consulta leve (só leitura) a cada 2 s.
  const [daAba, setDaAba] = useState("");
  useEffect(() => {
    let vivo = true;
    const ver = async () => { const d = await lerDadosDoContato(); if (vivo) setDaAba(d?.numero ?? ""); };
    void ver();
    const t = setInterval(() => void ver(), 2000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  const muda = (t: string) => {
    setTexto(t);
    const r = validarTelefoneManual(t);
    if (r.ok && r.digitos) onValido(r.digitos);
  };
  return (
    <div className="card">
      <label className="campo"><span>Telefone (opcional)</span>
        <input type="tel" inputMode="tel" autoComplete="off" value={texto} placeholder="(31) 99999-1234" onChange={(e) => muda(e.target.value)} />
      </label>
      <p className="suave" style={{ margin: "4px 0 0" }}>Se quiser, digite o número do cliente para evitar ticket duplicado.</p>
      {daAba
        ? <button className="pilula" style={{ marginTop: 6 }} onClick={() => muda(daAba)}>Usar o número de Dados do contato</button>
        : <p className="suave" style={{ margin: "4px 0 0" }}>Para preencher o número, abra Dados do contato no WhatsApp e clique em “Usar o número”.</p>}
      {!v.ok && <p className="erro" role="alert" style={{ margin: "4px 0 0" }}>{v.erro}</p>}
      {comAviso && v.ok && !v.digitos && (
        <p className="suave" style={{ margin: "4px 0 0" }}>Sem número, o Omnia não evita ticket duplicado nem fecha o ticket pela planilha do CRM.</p>
      )}
      {onCancelar && <button className="pilula" style={{ marginTop: 6 }} onClick={onCancelar}>Cancelar</button>}
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
