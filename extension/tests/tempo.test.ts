import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO, formatarMinutos, horaDeHoje, minutosUteis, pareceAutomatica, processarVarredura, type ItemChave } from "../src/lib/tempo";

const H = CONFIG_PADRAO.horario;
// Sábado 21/11/2026 (BRT) . 11:00 BRT = 14:00 UTC
const utc = (iso: string) => Date.parse(iso);
const brt = (dia: string, hhmm: string) => Date.parse(`${dia}T${hhmm}:00.000-03:00`);

describe("minutos úteis", () => {
  it("dentro do horário: diferença simples", () => {
    expect(minutosUteis(brt("2026-11-18", "10:00"), brt("2026-11-18", "10:05"), H)).toBe(5); // quarta
  });
  it("fora do horário não conta: cliente às 17:55, resposta às 08:05 do dia seguinte = 10 min", () => {
    expect(minutosUteis(brt("2026-11-18", "17:55"), brt("2026-11-19", "08:05"), H)).toBe(10);
  });
  it("sábado só até 12:00; domingo não conta", () => {
    expect(minutosUteis(brt("2026-11-21", "11:50"), brt("2026-11-23", "08:10"), H)).toBe(20); // sáb 10 + seg 10
  });
  it("só fora do expediente = 0", () => {
    expect(minutosUteis(brt("2026-11-22", "10:00"), brt("2026-11-22", "15:00"), H)).toBe(0);
  });
  it("horário configurável", () => {
    const h = { ...H, "3": [{ de: "09:00", ate: "10:00" }] };
    expect(minutosUteis(brt("2026-11-18", "08:00"), brt("2026-11-18", "12:00"), h)).toBe(60);
  });
  it("fim antes do início = 0", () => {
    expect(minutosUteis(10, 5, H)).toBe(0);
  });
});

describe("horário de hoje", () => {
  const agora = utc("2026-11-18T18:00:00.000Z"); // 15:00 BRT
  it("converte HH:MM de hoje; futuro vira nulo", () => {
    expect(horaDeHoje("14:32", agora)).toBe(brt("2026-11-18", "14:32"));
    expect(horaDeHoje("16:00", agora)).toBeNull();
    expect(horaDeHoje(null, agora)).toBeNull();
    expect(horaDeHoje("99:99", agora)).toBeNull();
  });
});

const it_ = (o: Partial<ItemChave> & { chave: string }): ItemChave => ({
  nome: "Cliente", previa: "oi", hora: "10:00", horaTexto: "10:00", naoLida: true, direcao: "cliente", ...o,
});
const agora = (hhmm: string) => brt("2026-11-18", hhmm);

describe("conversa nova e primeira resposta", () => {
  it("cliente escreve; atendente responde → registro com minutos úteis e dentro da meta", () => {
    let r = processarVarredura({}, [it_({ chave: "a", hora: "10:00" })], agora("10:01"), CONFIG_PADRAO);
    expect(r.registros).toEqual([{ chave: "a", inicio: agora("10:00"), resposta: null, minutos: null, dentro: null }]);
    r = processarVarredura(r.estado, [it_({ chave: "a", hora: "10:03", direcao: "atendente", previa: "Olá! Posso ajudar" })], agora("10:04"), CONFIG_PADRAO);
    expect(r.registros).toHaveLength(1);
    expect(r.registros[0]).toMatchObject({ inicio: agora("10:00"), resposta: agora("10:03"), minutos: 3, dentro: true });
    expect(r.estado.a.aguarda).toBeNull();
  });
  it("acima da meta: dentro = false", () => {
    let r = processarVarredura({}, [it_({ chave: "a", hora: "10:00" })], agora("10:01"), CONFIG_PADRAO);
    r = processarVarredura(r.estado, [it_({ chave: "a", hora: "10:09", direcao: "atendente" })], agora("10:10"), CONFIG_PADRAO);
    expect(r.registros[0]).toMatchObject({ minutos: 9, dentro: false });
  });
  it("várias mensagens seguidas do cliente: o relógio começa na primeira", () => {
    let r = processarVarredura({}, [it_({ chave: "a", hora: "10:00" })], agora("10:01"), CONFIG_PADRAO);
    r = processarVarredura(r.estado, [it_({ chave: "a", hora: "10:02" })], agora("10:03"), CONFIG_PADRAO);
    expect(r.registros).toEqual([]); // sem nova linha
    r = processarVarredura(r.estado, [it_({ chave: "a", hora: "10:04", direcao: "atendente" })], agora("10:05"), CONFIG_PADRAO);
    expect(r.registros[0]).toMatchObject({ inicio: agora("10:00"), minutos: 4 });
  });
  it("mensagem automática NÃO conta como resposta", () => {
    let r = processarVarredura({}, [it_({ chave: "a", hora: "10:00" })], agora("10:01"), CONFIG_PADRAO);
    r = processarVarredura(r.estado, [it_({ chave: "a", hora: "10:01", direcao: "atendente", previa: "Mensagem automática: já vamos te atender" })], agora("10:02"), CONFIG_PADRAO);
    expect(r.registros).toEqual([]);
    expect(r.estado.a.aguarda).toBe(agora("10:00"));
    r = processarVarredura(r.estado, [it_({ chave: "a", hora: "10:04", direcao: "atendente", previa: "Oi, sou a Ana" })], agora("10:05"), CONFIG_PADRAO);
    expect(r.registros[0]).toMatchObject({ resposta: agora("10:04"), minutos: 4 });
  });
  it("conversa em andamento (menos de 12 h de silêncio) não é nova", () => {
    let r = processarVarredura({}, [it_({ chave: "a", hora: "09:00", direcao: "atendente" })], agora("09:01"), CONFIG_PADRAO);
    r = processarVarredura(r.estado, [it_({ chave: "a", hora: "10:00" })], agora("10:01"), CONFIG_PADRAO);
    expect(r.registros).toEqual([]);
    expect(r.estado.a.aguarda).toBeNull();
  });
  it("depois de 12 h (configurável) sem mensagens, o cliente abre conversa nova", () => {
    const estado = { a: { atividade: agora("10:00") - 13 * 3600_000, aguarda: null } };
    const r = processarVarredura(estado, [it_({ chave: "a", hora: "10:00" })], agora("10:01"), CONFIG_PADRAO);
    expect(r.registros).toHaveLength(1);
    const cfg = { ...CONFIG_PADRAO, nova_conversa_horas: 24 };
    expect(processarVarredura(estado, [it_({ chave: "a", hora: "10:00" })], agora("10:01"), cfg).registros).toEqual([]);
  });
  it('itens de "ontem" ou sem horário não são medidos', () => {
    const r = processarVarredura({}, [it_({ chave: "a", hora: null, horaTexto: "ontem" })], agora("10:01"), CONFIG_PADRAO);
    expect(r.registros).toEqual([]);
    expect(r.estado).toEqual({});
  });
  it("lista de espera: só passa da meta, em minutos úteis, e só o que está na tela", () => {
    const r1 = processarVarredura({}, [it_({ chave: "a", hora: "10:00", nome: "Cliente 2", previa: "Qual o valor?" })], agora("10:03"), CONFIG_PADRAO);
    expect(r1.espera).toEqual([]);
    const r2 = processarVarredura(r1.estado, [it_({ chave: "a", hora: "10:00", nome: "Cliente 2", previa: "Qual o valor?" })], agora("10:08"), CONFIG_PADRAO);
    expect(r2.espera).toMatchObject([{ chave: "a", nome: "Cliente 2", previa: "Qual o valor?" }]);
    const r3 = processarVarredura(r2.estado, [], agora("10:09"), CONFIG_PADRAO);
    expect(r3.espera).toEqual([]);
  });
  it("fora do expediente não vence a meta", () => {
    const t = brt("2026-11-18", "17:59"); // quarta, fecha 18:00
    const r = processarVarredura({ a: { atividade: t, aguarda: t } }, [it_({ chave: "a", hora: "17:59" })], brt("2026-11-18", "17:59") + 60_000, CONFIG_PADRAO);
    expect(r.espera).toEqual([]);
  });
});

describe("mensagem automática (limitação)", () => {
  it("reconhece só padrões fortes", () => {
    expect(pareceAutomatica("Mensagem automática")).toBe(true);
    expect(pareceAutomatica("No momento não estamos atendendo")).toBe(true);
    expect(pareceAutomatica("Oi Marlene, tudo bem?")).toBe(false);
  });
});

describe("formatar minutos", () => {
  it("min e s", () => {
    expect(formatarMinutos(3 + 20 / 60)).toBe("3 min 20 s");
    expect(formatarMinutos(5)).toBe("5 min");
    expect(formatarMinutos(0.5)).toBe("30 s");
    expect(formatarMinutos(null)).toBe("—");
  });
});
