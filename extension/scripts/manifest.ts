// Gera dist/manifest.json a partir de manifest.json + package.json (versão) + src/config.ts (hosts).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "../src/config.ts";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(raiz, "package.json"), "utf8"));
const base = JSON.parse(readFileSync(resolve(raiz, "manifest.json"), "utf8"));

const origem = (url: string) => `${new URL(url).origin}/*`;
// Só estes hosts, nada além: WhatsApp Web, o backend e o endereço da Omnia.
const hosts = Array.from(new Set(["https://web.whatsapp.com/*", origem(CONFIG.SUPABASE_URL), origem(CONFIG.OMNIA_URL)]));

const manifest = { ...base, version: pkg.version, host_permissions: hosts };
mkdirSync(resolve(raiz, "dist"), { recursive: true });
writeFileSync(resolve(raiz, "dist/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest.json v${pkg.version} · hosts: ${hosts.join(", ")}`);
