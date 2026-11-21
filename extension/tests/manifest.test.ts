import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve(__dirname, "../manifest.json"), "utf8"));

describe("manifest.json", () => {
  it("pede só as permissões mínimas", () => {
    expect([...manifest.permissions].sort()).toEqual(["sidePanel", "storage"]);
  });
  it("não usa <all_urls>, tabs, scripting nem código remoto", () => {
    const texto = JSON.stringify(manifest);
    expect(texto).not.toMatch(/all_urls|"tabs"|"scripting"|unsafe-eval|content_security_policy/);
  });
  it("content script só no WhatsApp Web", () => {
    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts[0].matches).toEqual(["https://web.whatsapp.com/*"]);
  });
  it("é Manifest V3 com service worker e painel lateral", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe("background.js");
    expect(manifest.side_panel.default_path).toBe("index.html");
  });
});
