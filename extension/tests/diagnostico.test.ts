import { describe, expect, it } from "vitest";
import { montarDiagnostico } from "../src/content/diagnostico";
import { SELETORES } from "../src/content/selectors";
import { CONVERSA_INDIVIDUAL, GRUPO, SEM_DATA_ID_COM_PRESENCA, msg, pagina } from "./fixtures/whatsapp";

const extra = { versao: "0.1.0", dominio: "web.whatsapp.com" };
const gerar = (html: string) => { document.body.innerHTML = html; return montarDiagnostico(document, extra); };

/** Fixture com dados pessoais espalhados em texto E em atributos (title, aria-label, data-*). */
const COM_DADOS = `<div id="app"><div id="main">
  <header aria-label="Conversa com Marlene Rodrigues" data-contato="5531991234567">
    <div title="Marlene Rodrigues" data-testid="conversation-info-header">
      <span dir="auto" title="Marlene Rodrigues">Marlene Rodrigues</span>
      <span dir="auto" title="online">online</span>
      <span data-icon="default-user" aria-label="Foto de Marlene Rodrigues"></span>
    </div>
  </header>
  <div role="application" aria-label="Mensagens com 5531991234567">
    <div role="row"><div data-id="false_5531991234567@c.us_AAA" data-testid="conv-msg-false_5531991234567@c.us_AAA">
      <div class="copyable-text" data-pre-plain-text="[14:20, 21/11/2026] Marlene Rodrigues: ">
        <span dir="ltr" class="selectable-text">Oi, meu CPF é 123.456.789-00 e moro na Rua das Flores</span></div></div></div>
    <div role="row"><div data-id="true_5531991234567@c.us_BBB">
      <div class="copyable-text" data-pre-plain-text="[14:21, 21/11/2026] Atendente Paulo: ">
        <span dir="ltr" class="selectable-text">Claro, Marlene! Me passa seu telefone 31 99123-4567</span></div></div></div>
  </div></div></div>`;

const PROIBIDOS = [
  "Marlene", "Rodrigues", "5531991234567", "99123-4567", "123.456.789", "CPF", "Rua das Flores", "Atendente Paulo",
  "Oi, meu", "Claro", "prévia", "Outro contato", "Posso te explicar", "meu marido", "vi o anúncio",
];

describe("diagnóstico: só estrutura, nunca conteúdo", () => {
  it.each([["fixture com dados pessoais", COM_DADOS], ["conversa individual padrão", CONVERSA_INDIVIDUAL], ["grupo", GRUPO]])(
    "%s: o relatório não contém nomes, números nem mensagens", (_n, html) => {
      const txt = JSON.stringify(gerar(html));
      for (const p of PROIBIDOS) expect(txt, p).not.toContain(p);
    },
  );

  it("valores de atributos com nome ou dígitos longos viram [omitido:N]", () => {
    const rel = gerar(COM_DADOS);
    const txt = JSON.stringify(rel);
    expect(txt).toContain("[omitido:");
    expect(txt).toContain("conversation-info-header"); // data-testid seguro aparece
    expect(txt).toContain("default-user"); // data-icon seguro aparece
    expect(txt).not.toMatch(/\d{5,}/); // nenhum número longo (o horário gerado não passa de 4 dígitos seguidos... exceto ano)
  });

  it("relata cada seletor de selectors.ts com contagem e fallback que bateu", () => {
    const rel = gerar(CONVERSA_INDIVIDUAL);
    expect(rel.seletores.map((s) => s.nome).sort()).toEqual(Object.keys(SELETORES).sort());
    const painel = rel.seletores.find((s) => s.nome === "painelConversa")!;
    expect(painel).toMatchObject({ encontrou: "sim", elementos: 1, fallback_que_bateu: 0 });
    const msgs = rel.seletores.find((s) => s.nome === "mensagem")!;
    expect(msgs.elementos).toBeGreaterThan(0);
    expect(rel.seletores.find((s) => s.nome === "remetenteNaMensagem")!.encontrou).toBe("não");
  });

  it("indica qual fallback bateu quando o principal falha", () => {
    const rel = gerar(SEM_DATA_ID_COM_PRESENCA);
    const sem = rel.seletores.find((s) => s.nome === "mensagemSemId")!;
    expect(sem).toMatchObject({ encontrou: "sim", fallback_que_bateu: 0 });
    expect(rel.seletores.find((s) => s.nome === "mensagem")!.encontrou).toBe("não");
  });

  it("registra sinais de grupo, verificações positivas e a decisão final", () => {
    const ok = gerar(CONVERSA_INDIVIDUAL).deteccao;
    expect(ok.decisao).toBe("le");
    expect(ok.sinais_de_grupo.sinal_remetente_nas_mensagens).toBe("não");
    expect(ok.verificacoes_positivas.verif_subtitulo_de_presenca).toBe("sim");
    const g = gerar(GRUPO).deteccao;
    expect(g.decisao).toBe("nao_le");
    expect(g.sinais_de_grupo.sinal_id_do_chat_nao_individual).toBe("sim");
  });

  it("cabeçalho não encontrado e sem conversa ficam registrados", () => {
    const semHeader = gerar(pagina({ nome: "x", semHeader: true, mensagens: msg({ saiu: false, texto: "oi" }, 1) }));
    expect(semHeader.cabecalho.encontrado).toBe(false);
    expect(semHeader.deteccao.motivo_codigo).toBe("cabecalho_nao_encontrado");
    const semMain = gerar(pagina({ nome: "x", mensagens: "", semMain: true }));
    expect(semMain.deteccao.motivo_codigo).toBe("sem_conversa");
  });

  it("árvore tem no máximo 4 níveis e traz tag e role", () => {
    const prof = (n: { filhos?: unknown[] } | null | undefined, d = 1): number =>
      !n || !n.filhos?.length ? d : Math.max(...(n.filhos as { filhos?: unknown[] }[]).map((f) => prof(f, d + 1)));
    const rel = gerar(COM_DADOS);
    expect(prof(rel.cabecalho.arvore)).toBeLessThanOrEqual(4);
    expect(prof(rel.area_de_mensagens.arvore)).toBeLessThanOrEqual(4);
    expect(JSON.stringify(rel.area_de_mensagens.arvore)).toContain('"role":"application"');
    expect(rel.area_de_mensagens).toMatchObject({ total: 2, recebidas: 1, enviadas: 1 });
  });

  it("traz versão da extensão e domínio, sem URL completa", () => {
    const rel = gerar(CONVERSA_INDIVIDUAL);
    expect(rel.extensao.versao).toBe("0.1.0");
    expect(rel.aba).toEqual({ dominio: "web.whatsapp.com", content_script_presente: true });
  });
});
