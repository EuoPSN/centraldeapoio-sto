import { describe, expect, it } from "vitest";
import { acharPainel, avaliarConversa, identificar, lerConversa } from "../src/content/ler";
import { mascararSubtitulo, montarDiagnostico } from "../src/content/diagnostico";
import { msgNovo, pagina } from "./fixtures/whatsapp";

const abrir = (html: string) => { document.body.innerHTML = html; };
const av = (html: string) => { abrir(html); return avaliarConversa(acharPainel(document)!); };

// Conversa real do Paulo: 1 recebida (nome ≠ título) + 5 enviadas, direção por ícones, sem author.
const REAL = pagina({
  nome: "Dona Marlene Cliente",
  mensagens: [
    msgNovo({ quem: "Marlene R.", texto: "Oi, quero saber do cartão" }, 1),
    ...[2, 3, 4, 5, 6].map((i) => msgNovo({ quem: "Atendente", texto: `resposta ${i}`, ticks: true }, i)),
  ].join(""),
});

describe("1d·A · falso positivo de grupo", () => {
  it("individual real (1 recebida com nome diferente do título, 5 enviadas) LÊ", async () => {
    const a = av(REAL);
    expect(a.veredito.tipo).toBe("individual");
    expect(a.codigo).toBe("individual_confirmado");
    expect(a.observacoes).toContain("titulo_diferente_do_remetente");
    expect(a.remetentesDistintos).toEqual({ recebidas: 1, enviadas: 1 });
    expect(a.metodosDeDirecao.icones_de_status).toBeGreaterThan(0);
    const r = await lerConversa(document);
    expect(r.ok).toBe(true);
  });

  it("grupo com 2 remetentes recebidos NÃO lê", () => {
    const a = av(pagina({ nome: "Time", mensagens: msgNovo({ quem: "Ana", texto: "a" }, 1) + msgNovo({ quem: "Bruno", texto: "b" }, 2) + msgNovo({ quem: "Atendente", texto: "c", ticks: true }, 3) }));
    expect(a.veredito.tipo).toBe("grupo");
    expect(a.codigo).toBe("grupo_varios_remetentes");
  });

  it("grupo com rótulo de autor visível NÃO lê", () => {
    const html = REAL.replace('<div data-pre-plain-text="[14:31, 21/11/2026] Marlene R.: "', '<span data-testid="author">Ana</span><div data-pre-plain-text="[14:31, 21/11/2026] Marlene R.: "');
    expect(av(html).veredito.tipo).toBe("grupo");
  });

  it("individual com autor só dentro de mensagem citada LÊ", () => {
    const html = pagina({ nome: "Marlene R.", mensagens: msgNovo({ quem: "Marlene R.", texto: "ok", citada: { autor: "Você", texto: "x" } }, 1) + msgNovo({ quem: "Atendente", texto: "b", ticks: true }, 2) });
    expect(av(html).veredito.tipo).toBe("individual");
  });

  it("só mensagens enviadas NÃO lê, com a mensagem pedida", () => {
    abrir(pagina({ nome: "Marlene R.", mensagens: msgNovo({ quem: "Atendente", texto: "oi", ticks: true }, 1) }));
    expect(identificar(document)).toMatchObject({ ok: false, naoLe: true, motivo: "Ainda não há mensagem do cliente nesta conversa.", codigo: "sem_mensagem_do_cliente" });
  });

  it("nome do atendente nas enviadas nunca conta: 3 nomes diferentes nas enviadas, 1 nas recebidas → individual", () => {
    const html = pagina({ nome: "Marlene R.", mensagens: msgNovo({ quem: "Marlene R.", texto: "oi" }, 1) + msgNovo({ quem: "Ana", texto: "a", ticks: true }, 2) + msgNovo({ quem: "Bia", texto: "b", ticks: true }, 3) });
    expect(av(html).veredito.tipo).toBe("individual");
  });

  it("subtítulo com vários nomes ainda é sinal de grupo", () => {
    expect(av(pagina({ nome: "Marlene R.", subtitulo: "Ana, Bruno, Você", mensagens: msgNovo({ quem: "Marlene R.", texto: "oi" }, 1) })).veredito.tipo).toBe("grupo");
  });

  it("diagnóstico: subtítulo mascarado e contagem de remetentes, sem nomes", () => {
    abrir(REAL.replace("</header>", '<span data-testid="chat-subtitle">Ana, Bruno 31 99999-1234</span></header>'));
    const rel = montarDiagnostico(document, { versao: "t", dominio: "web.whatsapp.com" });
    expect(rel.subtitulo).toEqual({ forma: "[nome], [nome]", nomes: "2+" });
    expect(rel.remetentes_distintos).toEqual({ recebidas: 1, enviadas: 1 });
    const txt = JSON.stringify(rel);
    for (const x of ["Ana", "Bruno", "Marlene", "Atendente", "99999"]) expect(txt).not.toContain(x);
  });

  it("mascararSubtitulo", () => {
    expect(mascararSubtitulo("")).toEqual({ forma: "", nomes: "0" });
    expect(mascararSubtitulo("online")).toEqual({ forma: "[presenca]", nomes: "1" });
    expect(mascararSubtitulo("+55 31 99999-1234")).toEqual({ forma: "+99 99 99999-9999", nomes: "1" });
  });
});
