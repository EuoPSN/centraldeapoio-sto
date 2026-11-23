import { test } from "node:test";
import assert from "node:assert/strict";
import { maisPerguntadas, normalizarPergunta } from "../src/lib/duvidas.ts";

test("normaliza acento, caixa e pontuação", () => {
  assert.equal(normalizarPergunta("  Tem Carência?? "), "tem carencia");
});

test("agrupa iguais, exige 2 pessoas e conta vezes", () => {
  const r = maisPerguntadas([
    { texto: "Tem carência?", usuario: "a" },
    { texto: "tem carencia", usuario: "b" },
    { texto: "Tem carência?", usuario: "a" },
    { texto: "Quem pode ser dependente?", usuario: "a" },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].vezes, 3);
  assert.equal(r[0].pessoas, 2);
});

test("descarta o que parece dado de cliente", () => {
  const msgs = ["O cliente 31 99999-1234 quer cancelar", "Mande para joao@email.com agora", "CPF 123.456.789-09 pode aderir?", "Protocolo 123456 vale?"];
  const r = maisPerguntadas(msgs.flatMap((t) => [{ texto: t, usuario: "a" }, { texto: t, usuario: "b" }]));
  assert.deepEqual(r, []);
});
test("pergunta de uma pessoa só não aparece", () => {
  assert.deepEqual(maisPerguntadas([{ texto: "Como funciona o pagamento?", usuario: "a" }, { texto: "Como funciona o pagamento?", usuario: "a" }]), []);
});
