// Gera dist/omnia-extensao-<versao>.zip só com os arquivos finais (sem mapas nem o próprio zip).
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { CONFIG } from "../src/config.ts";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(raiz, "dist");
const pkg = JSON.parse(readFileSync(resolve(raiz, "package.json"), "utf8"));

if (/CONFIGURAR/.test(CONFIG.OMNIA_URL)) {
  console.error("ATENÇÃO: defina OMNIA_URL em src/config.ts antes de publicar (ainda está com o valor de exemplo).");
}

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : [p];
  });
}
const arquivos: Record<string, Uint8Array> = {};
for (const f of listar(dist)) {
  const rel = relative(dist, f).split(sep).join("/");
  if (rel.endsWith(".zip") || rel.endsWith(".map")) continue;
  arquivos[rel] = new Uint8Array(readFileSync(f));
}
if (!arquivos["manifest.json"]) throw new Error("Rode `npm run build` antes de `npm run zip`.");
const saida = resolve(dist, `omnia-extensao-${pkg.version}.zip`);
writeFileSync(saida, zipSync(arquivos, { level: 9 }));
console.log(`${saida} (${Object.keys(arquivos).length} arquivos)`);
