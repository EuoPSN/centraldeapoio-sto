import { beforeEach, describe, expect, it } from "vitest";
import { MOTIVO_DUVIDA, MOTIVO_GRUPO, MOTIVO_SEM_CONVERSA, detectarGrupo, acharPainel, identificar, lerConversa, subtituloDeGrupo } from "../src/content/ler";
import { CONVERSA_INDIVIDUAL, msg, pagina } from "./fixtures/whatsapp";

function abrir(html: string) {
  document.body.innerHTML = html;
}

describe("leitura da conversa individual", () => {
  beforeEach(() => abrir(CONVERSA_INDIVIDUAL));

  it("identifica nome e número (do id do chat)", () => {
    const r = identificar(document);
    expect(r).toEqual({ ok: true, id: { nome: "Marlene R.", numero: "5531991234567" } });
  });

  it("lê direção, texto e horário; mídia vira [mídia]; ignora mensagem citada e a lista lateral", async () => {
    const r = await lerConversa(document);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.conversa.mensagens;
    expect(m).toHaveLength(6);
    expect(m[0]).toEqual({ de: "cliente", texto: "Oi, vi o anúncio do cartão. Queria saber como funciona", hora: "14:20", data: "21/11/2026" });
    expect(m[1].de).toBe("atendente");
    expect(m[1].texto).toBe("Oi, Marlene! Que bom falar com você 😊");
    expect(m[3].texto).toBe("[mídia]");
    expect(m[4].texto).toBe("[mídia]");
    expect(m[5].texto).toBe("Pode. Mas vou conversar com meu marido e te falo");
    expect(JSON.stringify(m)).not.toContain("prévia");
  });

  it("lê no máximo as últimas 60 mensagens", async () => {
    const muitas = Array.from({ length: 80 }, (_, i) => msg({ saiu: i % 2 === 0, texto: `mensagem ${i}` }, i)).join("");
    abrir(pagina({ nome: "Cliente 2", mensagens: muitas }));
    const r = await lerConversa(document);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conversa.mensagens).toHaveLength(60);
    expect(r.conversa.mensagens[0].texto).toBe("mensagem 20");
    expect(r.conversa.mensagens[59].texto).toBe("mensagem 79");
  });

  it("nome exibido que é número vira número e nome vazio", () => {
    abrir(pagina({ nome: "+55 31 99123-4567", mensagens: msg({ saiu: false, texto: "oi" }, 1) }));
    expect(identificar(document)).toEqual({ ok: true, id: { nome: "", numero: "5531991234567" } });
  });

  it("recusa quando o contato é aprovado como ignorado, antes de ler as mensagens", async () => {
    const r = await lerConversa(document, async () => "Este contato está ignorado.");
    expect(r).toEqual({ ok: false, motivo: "Este contato está ignorado.", naoLe: true });
  });
});

describe("detecção de grupo: na dúvida, não lê", () => {
  it("grupo pelo id do chat (@g.us)", () => {
    abrir(pagina({ nome: "Equipe", mensagens: msg({ saiu: false, texto: "oi", chat: "120363000000000000@g.us" }, 1) }));
    const r = identificar(document);
    expect(r).toEqual({ ok: false, motivo: MOTIVO_GRUPO, naoLe: true });
  });
  it("lista de transmissão e Status (@broadcast)", () => {
    abrir(pagina({ nome: "Lista", mensagens: msg({ saiu: true, texto: "promo", chat: "123@broadcast" }, 1) }));
    expect(identificar(document).ok).toBe(false);
    abrir(pagina({ nome: "Status", mensagens: msg({ saiu: false, texto: "x", chat: "status@broadcast" }, 1) }));
    expect(identificar(document).ok).toBe(false);
  });
  it("canal (@newsletter)", () => {
    abrir(pagina({ nome: "Canal", mensagens: msg({ saiu: false, texto: "x", chat: "120@newsletter" }, 1) }));
    expect(identificar(document).ok).toBe(false);
  });
  it("grupo pelo ícone do cabeçalho, mesmo com id de chat que parece individual", () => {
    abrir(pagina({ nome: "Família", icones: ["default-group"], mensagens: msg({ saiu: false, texto: "oi" }, 1) }));
    expect(identificar(document)).toEqual({ ok: false, motivo: MOTIVO_GRUPO, naoLe: true });
  });
  it("comunidade pelo ícone", () => {
    abrir(pagina({ nome: "Bairro", icones: ["community-announcement"], mensagens: msg({ saiu: false, texto: "oi" }, 1) }));
    expect(identificar(document).ok).toBe(false);
  });
  it("grupo pelo subtítulo com participantes", () => {
    abrir(pagina({ nome: "Time", subtitulo: "Ana, Bruno, Você", mensagens: msg({ saiu: false, texto: "oi" }, 1) }));
    expect(identificar(document)).toEqual({ ok: false, motivo: MOTIVO_GRUPO, naoLe: true });
  });
  it("vários remetentes diferentes nas mensagens recebidas", () => {
    abrir(pagina({ nome: "Time", mensagens: msg({ saiu: false, texto: "a", quem: "Ana" }, 1) + msg({ saiu: false, texto: "b", quem: "Bruno" }, 2) }));
    expect(identificar(document).ok).toBe(false);
  });
  it("AMBÍGUO: id de chat desconhecido → não lê", () => {
    abrir(pagina({ nome: "Alguém", mensagens: msg({ saiu: false, texto: "oi", chat: "abc123@novo.tipo" }, 1) }));
    expect(identificar(document)).toEqual({ ok: false, motivo: MOTIVO_DUVIDA, naoLe: true });
  });
  it("AMBÍGUO: sem mensagens carregadas → não confirma → não lê", () => {
    abrir(pagina({ nome: "Alguém", mensagens: "" }));
    expect(identificar(document).ok).toBe(false);
  });
  it("AMBÍGUO: sem cabeçalho → não lê", () => {
    abrir(pagina({ nome: "x", semHeader: true, mensagens: msg({ saiu: false, texto: "oi" }, 1) }));
    expect(identificar(document).ok).toBe(false);
  });
  it("AMBÍGUO: mensagens de chats diferentes misturados → não lê", () => {
    abrir(pagina({ nome: "Alguém", mensagens: msg({ saiu: false, texto: "a", chat: "5531900000001@c.us" }, 1) + msg({ saiu: false, texto: "b", chat: "5531900000002@c.us" }, 2) }));
    expect(identificar(document).ok).toBe(false);
  });
  it("sem conversa aberta: pede para abrir uma e não lê", () => {
    abrir(pagina({ nome: "x", mensagens: "", semMain: true }));
    expect(acharPainel(document)).toBeNull();
    expect(identificar(document)).toEqual({ ok: false, motivo: MOTIVO_SEM_CONVERSA, naoLe: false });
  });
  it("detectarGrupo devolve 'dúvida' com motivo e 'grupo' com motivo", () => {
    abrir(pagina({ nome: "Alguém", mensagens: "" }));
    const v = detectarGrupo(acharPainel(document)!);
    expect(v.tipo).toBe("duvida");
  });
});

describe("subtituloDeGrupo", () => {
  it.each([
    ["Ana, Bruno, Você", true],
    ["clique aqui para dados do grupo", true],
    ["visto por último hoje às 14:30", false],
    ["online", false],
    ["", false],
    ["conta comercial", false],
  ])("%s → %s", (t, esperado) => expect(subtituloDeGrupo(t)).toBe(esperado));
});
