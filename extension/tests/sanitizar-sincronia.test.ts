import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("sanitização: as duas cópias são iguais", () => {
  it("extension/src/lib/sanitizar.ts == src/lib/extensao-sanitizar.ts (fora o aviso)", () => {
    const app = readFileSync(resolve(__dirname, "../../src/lib/extensao-sanitizar.ts"), "utf8");
    const ext = readFileSync(resolve(__dirname, "../src/lib/sanitizar.ts"), "utf8");
    expect(ext.endsWith(app)).toBe(true);
  });
});
