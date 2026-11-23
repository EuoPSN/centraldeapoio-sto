// Verificação dos tutoriais (sem runner de testes): npm run verificar:tours
// Lê src/lib/tours.ts (Node >= 22.6 entende TypeScript sem tipos complexos).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const erros = [];
const falha = (m) => erros.push(m);

const mod = await import(pathToFileURL(join(raiz, "src/lib/tours.ts")).href);
const { TOURS, filtrarPassos, situacaoDoTour } = mod;

// --- arquivos .tsx de src/ ---
function listar(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : p.endsWith(".tsx") ? [p] : [];
  });
}
const fontes = listar(join(raiz, "src")).map((p) => readFileSync(p, "utf8")).join("\n");
const textos = readFileSync(join(raiz, "docs/tutoriais/tours-textos.md"), "utf8");

// (a) e (b): âncoras
const alvos = TOURS.flatMap((t) => t.passos.filter((p) => p.alvo).map((p) => ({ tour: t.id, alvo: p.alvo })));
const vistos = new Set();
for (const { tour, alvo } of alvos) {
  const m = alvo.match(/^\[data-tour="([a-z0-9-]+-\d+)"\]$/);
  if (!m) { falha(`${tour}: alvo fora do padrão: ${alvo}`); continue; }
  if (vistos.has(m[1])) falha(`${tour}: alvo repetido em tours.ts: ${m[1]}`);
  vistos.add(m[1]);
  const n = fontes.split(`"${m[1]}"`).length - 1;
  if (n < 1) falha(`${tour}: âncora ${m[1]} não aparece em src/*.tsx`);
}

// (c), (d), (e)
const frases = (t) => (t.match(/[^.?!…]+[.?!…]+/g) ?? [t]).length;
for (const t of TOURS) {
  if (t.passos.length < 3 || t.passos.length > 7) falha(`${t.id}: ${t.passos.length} passos (esperado 3 a 7)`);
  if (!textos.includes("`" + t.id + "`")) falha(`${t.id}: id não aparece em tours-textos.md`);
  for (const p of [...t.passos, ...(t.semResultado ? [t.semResultado] : [])]) {
    // "O cliente disse…" nos textos conta como parte da frase, não como fim.
    const limpo = p.texto.replace(/…/g, "");
    if (frases(limpo) > 2) falha(`${t.id}: texto com mais de 2 frases em "${p.titulo}"`);
  }
}
if (TOURS.length !== 16) falha(`esperado 16 tours, achei ${TOURS.length}`);

// --- funções puras ---
const igual = (a, b, m) => JSON.stringify(a) !== JSON.stringify(b) && falha(m + ` (obtido ${JSON.stringify(a)})`);
const demo = {
  id: "demo", versao: 2, rotas: ["/"], titulo: "Demo",
  passos: [
    { alvo: "[a]", titulo: "A", texto: "a." },
    { alvo: "[b]", titulo: "B", texto: "b.", exigeResultado: true },
    { alvo: "[c]", titulo: "C", texto: "c.", exigeResultado: true },
    { titulo: "Central", texto: "d." },
  ],
  semResultado: { titulo: "Sem", texto: "s." },
};
igual(filtrarPassos(demo, () => true).map((p) => p.titulo), ["A", "B", "C", "Central"], "filtro: tudo visível");
igual(filtrarPassos(demo, (s) => s === "[a]").map((p) => p.titulo), ["A", "Sem", "Central"], "semResultado entra uma única vez");
igual(filtrarPassos(demo, (s) => s === "[a]" || s === "[c]").map((p) => p.titulo), ["A", "Sem", "C", "Central"], "semResultado no lugar do 1º removido");
igual(filtrarPassos({ ...demo, passos: [demo.passos[0]] }, () => false), [], "tudo sem alvo: vazio");
igual(situacaoDoTour(demo, []), "nao_visto", "versão: sem linha");
igual(situacaoDoTour(demo, [{ tour_id: "demo", versao: 1 }]), "novo", "versão: antiga");
igual(situacaoDoTour(demo, [{ tour_id: "demo", versao: 2 }]), "visto", "versão: igual");
igual(situacaoDoTour(demo, [{ tour_id: "demo", versao: 3 }]), "visto", "versão: maior");

if (erros.length) {
  console.error("verificar:tours FALHOU\n - " + erros.join("\n - "));
  process.exit(1);
}
console.log(`verificar:tours OK (${TOURS.length} tours, ${alvos.length} âncoras)`);
