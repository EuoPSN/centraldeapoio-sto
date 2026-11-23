import { test } from "node:test";
import assert from "node:assert/strict";
import { linhasDoColar } from "../src/lib/telemedicina.ts";

test("uma especialidade por linha, sem marcadores nem repetidas", () => {
  const r = linhasDoColar("Cardiologia\n- Clínico geral\n  2) Dermatologia  \n\ncardiologia\r\n• Pediatria");
  assert.deepEqual(r, ["Cardiologia", "Clínico geral", "Dermatologia", "Pediatria"]);
});
test("vazio devolve lista vazia", () => {
  assert.deepEqual(linhasDoColar("  \n \n"), []);
});
