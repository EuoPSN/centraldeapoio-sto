import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { identificarConversa } from "../src/lib/conteudo";
import { gerarDiagnostico } from "../src/lib/diagnostico";
import { registrarResultado } from "../src/lib/diagnostico-estado";
import { MOTIVO_DUVIDA, MOTIVO_SEM_CONVERSA, identificar } from "../src/content/ler";
import { MOTIVO_SEM_CONTENT_SCRIPT } from "../src/lib/textos";
import { msg, pagina } from "./fixtures/whatsapp";

afterEach(() => vi.unstubAllGlobals());
const chromeCom = (sendMessage: unknown) => vi.stubGlobal("chrome", { runtime: { sendMessage, getManifest: () => ({ version: "0.1.0" }) } });

describe("três mensagens de erro distintas", () => {
  it("(a) content script não responde: pede para recarregar o WhatsApp Web (F5)", async () => {
    chromeCom(vi.fn().mockRejectedValue(new Error("Could not establish connection")));
    const r = await identificarConversa();
    expect(r).toMatchObject({ ok: false, codigo: "sem_content_script", motivo: "A Omnia não está ativa nesta aba. Recarregue o WhatsApp Web (F5) e tente de novo." });
    expect(MOTIVO_SEM_CONTENT_SCRIPT).toContain("(F5)");
  });

  it("(b) nenhuma conversa aberta: 'Abra uma conversa no WhatsApp Web.'", () => {
    document.body.innerHTML = pagina({ nome: "x", mensagens: "", semMain: true });
    expect(identificar(document)).toMatchObject({ ok: false, codigo: "sem_conversa", motivo: "Abra uma conversa no WhatsApp Web." });
    expect(MOTIVO_SEM_CONVERSA).toBe("Abra uma conversa no WhatsApp Web.");
  });

  it("(c) não confirmou conversa individual: mensagem de segurança e código do motivo", () => {
    document.body.innerHTML = pagina({ nome: "Alguém", mensagens: msg({ saiu: false, texto: "oi", chat: "abc@novo.tipo" }, 1) });
    const r = identificar(document);
    expect(r).toMatchObject({ ok: false, naoLe: true, motivo: MOTIVO_DUVIDA });
    expect(MOTIVO_DUVIDA).toBe("Não consegui confirmar que esta é uma conversa individual; por segurança a Omnia não lê.");
  });

  it("o painel mostra o link 'Ver diagnóstico' nos casos de dúvida", () => {
    const codigo = readFileSync(resolve(__dirname, "../src/panel/Conversa.tsx"), "utf8");
    expect(codigo).toContain("Ver diagnóstico");
    expect(codigo).toContain("registrarResultado(codigo, motivo)");
  });
});

describe("cada caso grava o motivo no diagnóstico", () => {
  it("sem content script: o relatório diz isso e leva o último resultado do painel", async () => {
    chromeCom(vi.fn().mockResolvedValue({ ok: false, codigo: "sem_content_script", dominio: "indisponível" }));
    registrarResultado("sem_content_script", MOTIVO_SEM_CONTENT_SCRIPT);
    const rel = await gerarDiagnostico();
    expect(rel.aba.content_script_presente).toBe(false);
    expect(rel.deteccao.motivo_codigo).toBe("sem_content_script");
    expect(rel.ultimo_resultado_no_painel).toEqual({ codigo: "sem_content_script", motivo: MOTIVO_SEM_CONTENT_SCRIPT });
  });
  it("erro ao falar com o service worker também vira 'sem content script'", async () => {
    chromeCom(vi.fn().mockRejectedValue(new Error("x")));
    expect((await gerarDiagnostico()).deteccao.motivo_codigo).toBe("sem_content_script");
  });
});
