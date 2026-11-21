import { describe, expect, it } from "vitest";
import { validarTelefoneManual } from "../src/lib/numeros";
import { acharTelefone, lerDadosDoContato } from "../src/content/contato";
import { montarDiagnostico } from "../src/content/diagnostico";
import { msgNovo, pagina } from "./fixtures/whatsapp";

const abrir = (html: string) => { document.body.innerHTML = html; };
const CONVERSA = pagina({ nome: "Dona Marlene", mensagens: msgNovo({ quem: "Dona Marlene", texto: "oi" }, 1) });
const aba = (titulo: string, corpo: string, label = "Dados do contato") =>
  `<aside aria-label="${label}"><h2><span title="${titulo}">${titulo}</span></h2><div>${corpo}</div></aside>`;
const com = (html: string) => CONVERSA.replace("</div></div>", `</div></div>`) + html;

describe("1d·B · telefone manual", () => {
  it.each([
    ["(31) 99999-1234", "31999991234"], ["+55 31 99999-1234", "5531999991234"], ["31 9999-1234", "3199991234"], ["", ""],
  ])("aceita %s", (t, d) => expect(validarTelefoneManual(t)).toEqual({ ok: true, digitos: d }));
  it.each(["abc", "31 99999-12a4", "123", "55 31 99999-12345678", "31.99999.1234"])("recusa %s com erro amigável", (t) => {
    const r = validarTelefoneManual(t);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/Confira o número/);
  });
});

describe("1d·C · Dados do contato", () => {
  it("acha o telefone em formatos tolerantes", () => {
    expect(acharTelefone("Recado +55 31 99999-1234")?.numero).toBe("5531999991234");
    expect(acharTelefone("(31) 9999-1234")?.numero).toBe("3199991234");
    expect(acharTelefone("sem número aqui")).toBeNull();
  });
  it("aba aberta com número: detecta e devolve só dígitos", () => {
    abrir(com(aba("Dona Marlene", "<span>+55 31 99999-1234</span>")));
    expect(lerDadosDoContato(document)).toMatchObject({ detectada: true, seletor: "aside", numero: "5531999991234", formaDoTexto: "+99 99 99999-9999" });
  });
  it("aba aberta sem número: detecta e não devolve número", () => {
    abrir(com(aba("Dona Marlene", "<span>Recado: oi</span>")));
    expect(lerDadosDoContato(document)).toMatchObject({ detectada: true, numero: "" });
  });
  it("título diferente do chat aberto: ignora", () => {
    abrir(com(aba("Outra Pessoa", "<span>+55 31 99999-1234</span>")));
    expect(lerDadosDoContato(document)).toMatchObject({ detectada: false, numero: "" });
  });
  it("região sem rótulo de contato, ou aba fechada: não faz nada", () => {
    abrir(com(aba("Dona Marlene", "<span>(31) 99999-1234</span>", "Outra coisa")));
    expect(lerDadosDoContato(document).detectada).toBe(false);
    abrir(CONVERSA);
    expect(lerDadosDoContato(document).detectada).toBe(false);
  });
  it("não confunde a lista de conversas com a aba", () => {
    abrir(CONVERSA.replace('<div id="pane-side">', '<div id="pane-side"><aside aria-label="info"><span title="Dona Marlene">x</span> (31) 99999-1234</aside>'));
    expect(lerDadosDoContato(document).detectada).toBe(false);
  });
  it("diagnóstico traz a detecção e a forma mascarada, nunca número nem nome", () => {
    abrir(com(aba("Dona Marlene", "<span>+55 31 99999-1234</span>")));
    const rel = montarDiagnostico(document, { versao: "t", dominio: "web.whatsapp.com" });
    expect(rel.dados_do_contato).toEqual({ aba_detectada: true, seletor_que_decidiu: "aside", numero_encontrado: true, forma_do_texto: "+99 99 99999-9999" });
    const txt = JSON.stringify(rel);
    expect(txt).not.toMatch(/99999-1234|5531999991234|Marlene/);
  });
});
