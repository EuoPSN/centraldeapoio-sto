import { beforeEach, describe, expect, it, vi } from "vitest";
import { acharPainel, avaliarConversa, elementosDeMensagem, identificar, lerConversa, normalizarNome } from "../src/content/ler";
import { montarDiagnostico, mascarar, mascararPrePlain } from "../src/content/diagnostico";
import {
  CONVERSA_INDIVIDUAL, NOVO_GRUPO_DOIS_REMETENTES, NOVO_INDIVIDUAL, NOVO_MIDIA_E_TEXTO,
  NOVO_REMETENTE_ILEGIVEL, NOVO_SO_ENVIADAS, msg, msgNovo, pagina,
} from "./fixtures/whatsapp";

const abrir = (html: string) => { document.body.innerHTML = html; };
const av = (html: string) => { abrir(html); return avaliarConversa(acharPainel(document)!); };

describe("1c · direção sem depender do formato do data-id", () => {
  it("(a) individual com data-id desconhecido: direção pelo remetente, citação ignorada", async () => {
    const a = av(NOVO_INDIVIDUAL);
    expect(a.veredito.tipo).toBe("individual");
    expect(a.metodosDeDirecao).toMatchObject({ remetente: 3, data_id_antigo: 0, indefinida: 0 });
    expect(a.autoresEmCitacao).toBe(1);
    expect(a.sinais.sinal_remetente_nas_mensagens).toBe("não");
    const r = await lerConversa(document);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conversa.mensagens.map((m) => [m.de, m.texto])).toEqual([
      ["cliente", "Oi, vi o anúncio do cartão"], ["atendente", "Oi! Posso te explicar?"], ["cliente", "Pode sim"],
    ]);
  });

  it("(b) grupo com dois remetentes: não lê, com a mensagem do motivo", () => {
    const a = av(NOVO_GRUPO_DOIS_REMETENTES);
    expect(a.veredito).toEqual({ tipo: "grupo", motivo: "Há mais de um remetente nas mensagens recebidas: parece um grupo." });
    expect(a.codigo).toBe("grupo_varios_remetentes");
    expect(identificar(document)).toMatchObject({ ok: false, naoLe: true, codigo: "grupo_varios_remetentes" });
  });

  it("(c) só mensagens enviadas: não lê e pede mensagem do cliente", () => {
    abrir(NOVO_SO_ENVIADAS);
    expect(identificar(document)).toEqual({ ok: false, motivo: "Ainda não há mensagem do cliente nesta conversa.", naoLe: true, codigo: "sem_mensagem_do_cliente" });
  });

  it("(d) data-id no formato antigo continua decidindo a direção (método 1)", () => {
    const a = av(CONVERSA_INDIVIDUAL);
    expect(a.veredito.tipo).toBe("individual");
    expect(a.metodosDeDirecao.data_id_antigo).toBe(6);
  });

  it("(e) mídia e texto: mídia vira [mídia], com legenda mantém o texto", async () => {
    abrir(NOVO_MIDIA_E_TEXTO);
    const r = await lerConversa(document);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.conversa.mensagens.map((m) => m.texto)).toEqual(["[mídia]", "[mídia] Segue a foto", "Recebi, obrigada"]);
  });

  it("remetente ilegível (formato novo): não lê e registra o motivo", () => {
    abrir(NOVO_REMETENTE_ILEGIVEL);
    // sem remetente nem sinal de status/alinhamento, a direção nem chega a ser decidida
    expect(identificar(document)).toMatchObject({ ok: false, naoLe: true });
  });

  it("citação com author NÃO vira sinal de grupo; author no corpo da mensagem SIM", () => {
    expect(av(NOVO_INDIVIDUAL).sinais.sinal_remetente_nas_mensagens).toBe("não");
    const comAutor = NOVO_INDIVIDUAL.replace('<div data-pre-plain-text="[14:31, 21/11/2026] Marlene R.: "', '<span data-testid="author">Ana</span><div data-pre-plain-text="[14:31, 21/11/2026] Marlene R.: "');
    expect(av(comAutor).veredito.tipo).toBe("grupo");
  });

  it("conversa consigo mesmo: individual só se título e remetentes baterem", () => {
    expect(av(pagina({ nome: "Você", mensagens: msgNovo({ quem: "Você", texto: "lembrete" }, 1) })).veredito.tipo).toBe("individual");
    expect(av(pagina({ nome: "Você", mensagens: msgNovo({ quem: "Paulo", texto: "lembrete" }, 1) })).codigo).toBe("sem_mensagem_do_cliente");
  });

  it("normaliza espaços, caixa e telefone ao comparar com o título", () => {
    expect(normalizarNome("  MARLENE   r. ")).toBe("marlene r.");
    expect(normalizarNome("+55 31 99123-4567")).toBe(normalizarNome("+5531991234567"));
    const html = pagina({ nome: "+55 31 99123-4567", mensagens: msgNovo({ quem: "+55 31 99123-4567", texto: "oi" }, 1) + msgNovo({ quem: "Atendente", texto: "olá" }, 2) });
    expect(av(html).veredito.tipo).toBe("individual");
  });

  describe("métodos 3 e 4 (remetente do atendente ilegível)", () => {
    const semNome = (i: number, extra = "", meta = "") =>
      `<div role="row"><div data-id="ZZ${i}"><div data-pre-plain-text="[14:30, 21/11/2026]"><span class="selectable-text">resposta ${i}</span></div>${meta}${extra}</div></div>`;
    it("ícones de status indicam ENVIADA; msg-meta sem ícone indica RECEBIDA", () => {
      const meta = (ticks: boolean) => `<div data-testid="msg-meta">${ticks ? '<span data-icon="msg-dblcheck"></span>' : ""}</div>`;
      abrir(pagina({ nome: "Marlene R.", mensagens: msgNovo({ quem: "Marlene R.", texto: "oi" }, 1) + semNome(2, "", meta(true)) }));
      const m = elementosDeMensagem(acharPainel(document)!, "Marlene R.");
      expect(m.map((x) => [x.saiu, x.metodo])).toEqual([[false, "remetente"], [true, "icones_de_status"]]);
    });
    it("alinhamento à direita indica ENVIADA (último recurso)", () => {
      abrir(pagina({ nome: "Marlene R.", mensagens: msgNovo({ quem: "Marlene R.", texto: "oi" }, 1) + semNome(2) }));
      const painel = acharPainel(document)!;
      const rect = (left: number, width: number) => ({ left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON() {} }) as DOMRect;
      vi.spyOn(painel, "getBoundingClientRect").mockReturnValue(rect(0, 1000));
      const alvo = painel.querySelector('[data-id="ZZ2"]')!;
      vi.spyOn(alvo, "getBoundingClientRect").mockReturnValue(rect(600, 300));
      const m = elementosDeMensagem(painel, "Marlene R.");
      expect(m[1]).toMatchObject({ saiu: true, metodo: "alinhamento" });
    });
    it("sem nenhum método decisivo: direção indefinida → não lê", () => {
      abrir(pagina({ nome: "Marlene R.", mensagens: msgNovo({ quem: "Marlene R.", texto: "oi" }, 1) + semNome(2) }));
      const a = avaliarConversa(acharPainel(document)!);
      expect(a.codigo).toBe("direcao_indefinida");
      expect(a.veredito.tipo).toBe("duvida");
    });
  });

  it("separadores de data e avisos do sistema (sem texto de mensagem) não são mensagens", () => {
    const html = pagina({ nome: "Marlene R.", mensagens: `<div data-id="sep1"><span>HOJE</span></div><div data-id="sis1"><span>As mensagens são protegidas</span></div>` + msgNovo({ quem: "Marlene R.", texto: "oi" }, 1) });
    abrir(html);
    expect(elementosDeMensagem(acharPainel(document)!, "Marlene R.")).toHaveLength(1);
  });
});

describe("1c · diagnóstico: forma mascarada dos identificadores", () => {
  it("mascarar: dígito→9, letra→a, preserva separadores", () => {
    expect(mascarar("false_5531991234567@c.us_3EB0AB12")).toBe("aaaaa_9999999999999@a.aa_9aa9aa99");
    expect(mascararPrePlain("[14:32, 21/11/2026] Marlene Rodrigues: ")).toBe("[99:99, 99/99/9999] [nome]: ");
  });

  const COM_DADOS = pagina({
    nome: "Marlene Rodrigues",
    mensagens: msg({ saiu: false, texto: "Meu CPF é 123.456.789-00, ligue 31 99123-4567", quem: "Marlene Rodrigues", chat: "5531991234567@c.us" }, 1)
      + msgNovo({ quem: "Marlene Rodrigues", texto: "segredo da Rua das Flores" }, 2),
  });

  it("traz formas com contagem, nomes de atributos e método de direção; nunca nome, número nem texto", () => {
    document.body.innerHTML = COM_DADOS;
    const rel = montarDiagnostico(document, { versao: "0.1.0", dominio: "web.whatsapp.com" });
    const f = rel.formas_dos_identificadores!;
    expect(Object.keys(f.data_pre_plain_text)).toEqual(["[99:99, 99/99/9999] [nome]: "]);
    expect(f.data_pre_plain_text["[99:99, 99/99/9999] [nome]: "]).toBe(2);
    expect(Object.values(f.data_id).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(f.atributos_de_mensagem_de_texto).toContain("data-id");
    expect(f.atributos_de_mensagem_de_texto).toContain("data-pre-plain-text");
    expect(rel.direcao!.metodos.data_id_antigo).toBeGreaterThan(0);
    const txt = JSON.stringify(rel);
    for (const p of ["Marlene", "Rodrigues", "5531991234567", "99123-4567", "123.456.789", "CPF", "Rua das Flores", "segredo", "Outro contato", "prévia"]) {
      expect(txt, p).not.toContain(p);
    }
  });

  it("limita a 5 elementos e registra autores ignorados em citação", () => {
    const muitas = Array.from({ length: 9 }, (_, i) => msgNovo({ quem: "Marlene R.", texto: "x" + i }, i)).join("");
    document.body.innerHTML = pagina({ nome: "Marlene R.", mensagens: muitas });
    const rel = montarDiagnostico(document, { versao: "0.1.0", dominio: "web.whatsapp.com" });
    expect(Object.values(rel.formas_dos_identificadores!.data_id).reduce((a, b) => a + b, 0)).toBe(5);
    document.body.innerHTML = NOVO_INDIVIDUAL;
    expect(montarDiagnostico(document, { versao: "0.1.0", dominio: "web.whatsapp.com" }).direcao!.autores_ignorados_em_citacao).toBe(1);
  });
});

describe("1d · A · falso positivo de grupo", () => {
  const enviadas = (n: number) => Array.from({ length: n }, (_, i) => msgNovo({ quem: "Atendente Paulo", texto: `resposta ${i}`, ticks: true }, 10 + i)).join("");

  it("conversa individual real: 1 recebida com nome diferente do título + 5 enviadas → LÊ", async () => {
    const a = av(pagina({ nome: "Maria Cliente", mensagens: msgNovo({ quem: "Marlene R.", texto: "oi", ticks: false }, 1) + enviadas(5) }));
    expect(a.veredito.tipo).toBe("individual");
    expect(a.codigo).toBe("individual_confirmado");
    expect(a.observacoes).toEqual(["titulo_diferente_do_remetente"]);
    expect(a.remetentes).toEqual({ distintos_recebidas: 1, distintos_enviadas: 1 });
    expect(a.metodosDeDirecao.icones_de_status).toBe(6);
    expect(a.sinais.sinal_remetente_nas_mensagens).toBe("não");
    expect((await lerConversa(document)).ok).toBe(true);
  });

  it("grupo com 2 remetentes recebidos → NÃO LÊ", () => {
    const a = av(pagina({ nome: "Maria Cliente", mensagens: msgNovo({ quem: "Ana", texto: "oi", ticks: false }, 1) + msgNovo({ quem: "Bruno", texto: "oi", ticks: false }, 2) + enviadas(2) }));
    expect(a.veredito.tipo).toBe("grupo");
    expect(a.codigo).toBe("grupo_varios_remetentes");
    expect(a.remetentes.distintos_recebidas).toBe(2);
  });

  it("grupo com rótulo de autor visível → NÃO LÊ", () => {
    const html = pagina({ nome: "Maria Cliente", mensagens: msgNovo({ quem: "Ana", texto: "oi", ticks: false }, 1) + enviadas(1) })
      .replace('<div data-pre-plain-text="[14:31, 21/11/2026] Ana: "', '<span data-testid="author">Ana</span><div data-pre-plain-text="[14:31, 21/11/2026] Ana: "');
    expect(av(html).veredito.tipo).toBe("grupo");
  });

  it("individual com autor só dentro de mensagem citada → LÊ", () => {
    const a = av(pagina({ nome: "Maria Cliente", mensagens: msgNovo({ quem: "Marlene R.", texto: "ok", ticks: false, citada: { autor: "Você", texto: "pode?" } }, 1) + enviadas(2) }));
    expect(a.veredito.tipo).toBe("individual");
    expect(a.autoresEmCitacao).toBe(1);
  });

  it("só mensagens enviadas → NÃO LÊ com a mensagem do motivo", () => {
    abrir(pagina({ nome: "Maria Cliente", mensagens: enviadas(3) }));
    expect(identificar(document)).toEqual({ ok: false, motivo: "Ainda não há mensagem do cliente nesta conversa.", naoLe: true, codigo: "sem_mensagem_do_cliente" });
  });

  it("remetente das recebidas ilegível → NÃO LÊ (na dúvida)", () => {
    abrir(NOVO_REMETENTE_ILEGIVEL);
    expect(identificar(document).ok).toBe(false);
  });

  it("diagnóstico: subtítulo mascarado e contagem de nomes; só contagens de remetentes", () => {
    const rel = (sub: string) => {
      document.body.innerHTML = pagina({ nome: "Maria Cliente", mensagens: msgNovo({ quem: "Marlene R.", texto: "oi", ticks: false }, 1) + enviadas(1) })
        .replace("</header>", `<span data-testid="chat-subtitle" dir="auto">${sub}</span></header>`);
      return montarDiagnostico(document, { versao: "0.1.0", dominio: "web.whatsapp.com" });
    };
    const g = rel("Ana, Bruno, você");
    expect(g.deteccao.subtitulo).toEqual({ forma_mascarada: "[nome], [nome], [nome]", nomes: "2+" });
    expect(g.deteccao.decisao).toBe("nao_le");
    expect(rel("visto por último hoje às 14:30").deteccao.subtitulo).toEqual({ forma_mascarada: "aaaaa aaa aaaaaa aaaa aa 99?99", nomes: "0" });
    const txt = JSON.stringify(rel("Ana, Bruno, você"));
    for (const p of ["Ana", "Bruno", "Marlene", "Maria Cliente", "Atendente Paulo"]) expect(txt, p).not.toContain(p);
    expect(rel("Ana").deteccao.subtitulo!.nomes).toBe("1");
    expect(rel("online").deteccao.remetentes).toEqual({ distintos_recebidas: 1, distintos_enviadas: 1 });
  });
});
