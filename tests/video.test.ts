import { test } from "node:test";
import assert from "node:assert/strict";
import { lerVideo, erroDoVideo, duracaoValida } from "../src/lib/video.ts";

test("YouTube vira embed nocookie", () => {
  for (const u of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
  ]) {
    const r = lerVideo(u);
    assert.ok(r.ok && r.tipo === "youtube", u);
    if (r.ok && r.tipo === "youtube") assert.match(r.embed, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  }
});
test("Vimeo, inclusive não listado", () => {
  const a = lerVideo("https://vimeo.com/123456789");
  assert.ok(a.ok && a.tipo === "vimeo" && a.embed === "https://player.vimeo.com/video/123456789");
  const b = lerVideo("https://vimeo.com/123456789/abcdef1234");
  assert.ok(b.ok && b.tipo === "vimeo" && b.embed.endsWith("?h=abcdef1234"));
});
test("arquivo direto só .mp4/.webm", () => {
  assert.ok(lerVideo("https://exemplo.com/a/video.mp4?x=1").ok);
  assert.ok(lerVideo("https://exemplo.com/video.WEBM").ok);
  assert.equal(lerVideo("https://exemplo.com/video.avi").ok, false);
});
test("recusa http, outros domínios e lixo", () => {
  assert.equal(lerVideo("http://youtu.be/dQw4w9WgXcQ").ok, false);
  assert.equal(lerVideo("https://evil.com/watch?v=dQw4w9WgXcQ").ok, false);
  assert.equal(lerVideo("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ").ok, false);
  assert.equal(lerVideo("javascript:alert(1)").ok, false);
  assert.equal(lerVideo("https://www.youtube.com/watch?v=curto").ok, false);
});
test("vazio é permitido; duração", () => {
  assert.equal(erroDoVideo(""), null);
  assert.equal(erroDoVideo("  "), null);
  assert.ok(erroDoVideo("abc"));
  assert.ok(duracaoValida("") && duracaoValida("2:30") && duracaoValida("12:05") && duracaoValida("1:02:03"));
  assert.ok(!duracaoValida("2:75") && !duracaoValida("abc"));
});
