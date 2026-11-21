import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONVERSA_INDIVIDUAL } from "./fixtures/whatsapp";
import { chaveDoContato } from "../src/lib/mensagens";
import { hashContato } from "../src/lib/numeros";

type Ouvinte = (msg: unknown, sender: unknown, responder: (r: unknown) => void) => boolean | void;
let ouvinte: Ouvinte;
let pausada = false;

async function pedir(pedido: unknown): Promise<any> {
  return new Promise((res) => { ouvinte(pedido, {}, res); });
}

beforeEach(async () => {
  pausada = false;
  vi.resetModules();
  (globalThis as any).chrome = {
    storage: { local: { get: async () => ({ omnia_pausada: pausada }) } },
    runtime: { onMessage: { addListener: (f: Ouvinte) => { ouvinte = f; } } },
  };
  document.body.innerHTML = CONVERSA_INDIVIDUAL;
  await import("../src/content/whatsapp");
});

describe("content script: pausa e contatos ignorados", () => {
  it("pausada: não identifica nem lê nada", async () => {
    pausada = true;
    expect(await pedir({ tipo: "omnia:identificar" })).toMatchObject({ ok: false, naoLe: true });
    expect(await pedir({ tipo: "omnia:ler", usuarioId: "u1", hashesIgnorados: [] })).toMatchObject({ ok: false, naoLe: true });
  });
  it("não pausada: lê a conversa individual", async () => {
    const r = await pedir({ tipo: "omnia:ler", usuarioId: "u1", hashesIgnorados: [] });
    expect(r.ok).toBe(true);
    expect(r.conversa.mensagens.length).toBeGreaterThan(0);
  });
  it("contato ignorado: nunca é lido, mesmo com clique", async () => {
    const hash = await hashContato("u1", chaveDoContato({ nome: "Marlene R.", numero: "5531991234567" }));
    const r = await pedir({ tipo: "omnia:ler", usuarioId: "u1", hashesIgnorados: [hash] });
    expect(r).toEqual({ ok: false, motivo: "Este contato está ignorado.", naoLe: true });
  });
  it("hash de outro usuário não bloqueia", async () => {
    const hash = await hashContato("u2", chaveDoContato({ nome: "Marlene R.", numero: "5531991234567" }));
    expect((await pedir({ tipo: "omnia:ler", usuarioId: "u1", hashesIgnorados: [hash] })).ok).toBe(true);
  });
  it("ignora mensagens que não são da extensão", () => {
    expect(ouvinte({ tipo: "outra" }, {}, () => undefined)).toBe(false);
  });
});
