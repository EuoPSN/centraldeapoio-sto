import { test } from "node:test";
import assert from "node:assert/strict";
import { casarClinicas, dividirEmLotes, extrairJsonArray, jaExiste, normalizarNome, rodarEmLotes } from "../src/lib/ia-importacao.ts";

test("lotes: texto vazio devolve []", () => {
  assert.deepEqual(dividirEmLotes(""), []);
  assert.deepEqual(dividirEmLotes("  \n \n"), []);
});
test("lotes: texto curto vira um lote só", () => {
  assert.deepEqual(dividirEmLotes("a\nb", 100), ["a\nb"]);
});
test("lotes: corta só em fim de linha e nunca parte linha", () => {
  const linhas = Array.from({ length: 10 }, (_, i) => `linha-${i}-xxxxx`);
  const lotes = dividirEmLotes(linhas.join("\n"), 50);
  assert.ok(lotes.length > 1);
  assert.deepEqual(lotes.join("\n").split("\n"), linhas);
  for (const l of lotes) assert.ok(l.length <= 50);
});
test("lotes: prefere cortar em linha em branco", () => {
  const texto = "aaaa\nbbbb\n\ncccc\ndddd";
  const lotes = dividirEmLotes(texto, 15);
  assert.deepEqual(lotes, ["aaaa\nbbbb", "cccc\ndddd"]);
});
test("lotes: linha maior que o máximo vira lote sozinha", () => {
  const gigante = "x".repeat(200);
  const lotes = dividirEmLotes(`a\n${gigante}\nb`, 50);
  assert.deepEqual(lotes, ["a", gigante, "b"]);
});

test("json: cercas de markdown e texto em volta", () => {
  const r = extrairJsonArray('Aqui:\n```json\n[{"a":1},{"a":2}]\n```\nfim');
  assert.deepEqual(r, { itens: [{ a: 1 }, { a: 2 }], truncado: false });
});
test("json: sem array devolve vazio", () => {
  assert.deepEqual(extrairJsonArray("nada"), { itens: [], truncado: false });
});
test("json: truncado recupera os objetos completos", () => {
  const r = extrairJsonArray('[{"nome":"A, B"},{"nome":"C \\"x\\" }"},{"nome":"cort');
  assert.equal(r.truncado, true);
  assert.deepEqual(r.itens, [{ nome: "A, B" }, { nome: 'C "x" }' }]);
});

const clin = [
  { id: "1", nome_regiao: "Centro BH" },
  { id: "2", nome_regiao: "Neves" },
  { id: "3", nome_regiao: "Centro Betim" },
  { id: "4", nome_regiao: "Contagem" },
];
test("clínicas: igualdade ignora acento e caixa", () => {
  assert.deepEqual(casarClinicas(["CONTAGEM", "névês"], clin), { ids: ["4", "2"], naoEncontradas: [] });
});
test("clínicas: parcial único casa", () => {
  assert.deepEqual(casarClinicas(["Clínica Neves - Rua X"], clin), { ids: ["2"], naoEncontradas: [] });
});
test("clínicas: ambíguo não casa", () => {
  const r = casarClinicas(["Centro"], clin);
  assert.deepEqual(r.ids, []);
  assert.deepEqual(r.naoEncontradas, ["Centro"]);
});
test("clínicas: 'todas' vira todas, sem duplicar", () => {
  const r = casarClinicas(["Todas as clínicas", "Neves"], clin);
  assert.deepEqual(r.ids.sort(), ["1", "2", "3", "4"]);
});
test("clínicas: não encontrada vai para a lista", () => {
  assert.deepEqual(casarClinicas(["Xyzw"], clin), { ids: [], naoEncontradas: ["Xyzw"] });
});

test("jaExiste compara normalizado", () => {
  assert.equal(jaExiste("Cardiologia ", ["cardiologia"]), true);
  assert.equal(jaExiste("Raio-X", ["Raio X"]), true);
  assert.equal(jaExiste("Pediatria", ["Cardiologia"]), false);
  assert.equal(normalizarNome("  Ação  Rápida! "), "acao rapida");
});

test("rodarEmLotes: sequencial, mantém o que veio e lista falhas", async () => {
  const ordem: number[] = [];
  const prog: string[] = [];
  const r = await rodarEmLotes<string>(
    ["a", "b", "c"],
    async (l, i) => {
      ordem.push(i);
      if (l === "b") throw new Error("x");
      return { itens: [l], truncado: l === "c" };
    },
    (a, t) => prog.push(`${a}/${t}`),
  );
  assert.deepEqual(ordem, [0, 1, 2]);
  assert.deepEqual(r, { itens: ["a", "c"], falhas: [1], truncados: [2] });
  assert.deepEqual(prog, ["1/3", "2/3", "3/3"]);
});

import { listaDeTextos, numeroOuNull } from "../src/lib/ia-importacao.ts";
test("numeroOuNull aceita formato brasileiro e rejeita lixo", () => {
  assert.equal(numeroOuNull("R$ 1.234,56"), 1234.56);
  assert.equal(numeroOuNull("80"), 80);
  assert.equal(numeroOuNull(12.5), 12.5);
  assert.equal(numeroOuNull("abc"), null);
  assert.equal(numeroOuNull(null), null);
  assert.equal(numeroOuNull(-1), null);
});
test("listaDeTextos tira marcadores e vazios", () => {
  assert.deepEqual(listaDeTextos("- a\n\n2) b"), ["a", "b"]);
  assert.deepEqual(listaDeTextos(["• x", " "]), ["x"]);
  assert.deepEqual(listaDeTextos(undefined), []);
});
