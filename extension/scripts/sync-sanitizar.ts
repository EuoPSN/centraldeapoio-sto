// Copia src/lib/extensao-sanitizar.ts (app) para src/lib/sanitizar.ts (extensão), com um aviso no topo.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const AVISO = "// CÓPIA GERADA de src/lib/extensao-sanitizar.ts (app da Omnia). Não edite aqui:\n// edite lá e rode `npm run sync:sanitizar`. O teste de sincronia falha se divergirem.\n";
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origem = readFileSync(resolve(raiz, "../src/lib/extensao-sanitizar.ts"), "utf8");
writeFileSync(resolve(raiz, "src/lib/sanitizar.ts"), AVISO + origem);
console.log("sanitizar.ts sincronizado");
