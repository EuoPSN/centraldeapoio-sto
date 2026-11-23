import { test } from "node:test";
import assert from "node:assert/strict";
import { partesDoRoteiro, erroDoArquivoDeAudio, nomeSeguroDeArquivo } from "../src/lib/roteiros.ts";

test("destaca marcações do roteiro", () => {
  const p = partesDoRoteiro("Oi, [nome], tudo bem? (pausa curta) Posso explicar? (sorria)");
  assert.deepEqual(p.filter((x) => x.marca).map((x) => x.texto), ["[nome]", "(pausa curta)", "(sorria)"]);
  assert.equal(p.map((x) => x.texto).join(""), "Oi, [nome], tudo bem? (pausa curta) Posso explicar? (sorria)");
});
test("texto sem marcação vira um pedaço só", () => {
  assert.deepEqual(partesDoRoteiro("Só texto."), [{ texto: "Só texto.", marca: false }]);
  assert.deepEqual(partesDoRoteiro(""), []);
});
test("valida o arquivo de áudio", () => {
  assert.equal(erroDoArquivoDeAudio({ name: "a.MP3", size: 1000 }), null);
  assert.ok(erroDoArquivoDeAudio({ name: "a.mp4", size: 1000 }));
  assert.ok(erroDoArquivoDeAudio({ name: "a.wav", size: 6 * 1024 * 1024 }));
});
test("nome seguro", () => {
  assert.equal(nomeSeguroDeArquivo("Áudio do Dia 7!.mp3"), "Audio_do_Dia_7_.mp3");
});
