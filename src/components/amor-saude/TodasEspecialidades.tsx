import { useEffect, useMemo, useState } from "react";
import { Download, LayoutList } from "lucide-react";
import logoCdt from "@/assets/logo.png.asset.json";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WhatsAppMessage, useCopy } from "@/components/scripts/shared";
import { cn } from "@/lib/utils";
import { especialidadesPorArea, menorValor, reais, textoTodasEspecialidades, type Consulta } from "./model";

// "Todas as especialidades": texto e imagem para mandar ao CLIENTE.
// A imagem usa a identidade do Cartão de TODOS (logo e o verde/amarelo do
// antigo tema "Verde Cartão de Todos"), não a marca OMNIA.

const CDT = {
  verde: "#00a39b", // hsl(177 100% 32%), cor principal do tema "Verde Cartão de Todos"
  verdeTexto: "#00807a", // mesmo verde, mais escuro, para texto sobre fundo claro (contraste ≥ 4:1)
  amarelo: "#ffd400",
  fundo: "#f3f8f6",
  fio: "#d3e4df",
  tinta: "#1c221f",
  tintaSuave: "#3a443f",
};
const W = 1080;
const H = 1350;
const PAD = 72;

export function TodasEspecialidadesButton({ consultas }: { consultas: Consulta[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!consultas.length}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      >
        <LayoutList className="h-4 w-4 text-gold-text" strokeWidth={1.5} aria-hidden />
        Todas as especialidades
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[860px] overflow-y-auto">
          {open && <Painel consultas={consultas} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Painel({ consultas }: { consultas: Consulta[] }) {
  const texto = useMemo(() => textoTodasEspecialidades(consultas), [consultas]);
  const grupos = useMemo(() => especialidadesPorArea(consultas), [consultas]);
  const menor = useMemo(() => menorValor(consultas), [consultas]);
  const { copied, copy } = useCopy();
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let cancel = false;
    let url: string | null = null;
    gerarImagem(grupos, menor)
      .then((blob) => {
        if (cancel) return;
        url = URL.createObjectURL(blob);
        setImg({ url, blob });
      })
      .catch(() => !cancel && setErro(true));
    return () => {
      cancel = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [grupos, menor]);

  const baixar = () => {
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.url;
    a.download = "especialidades-cartao-de-todos.png";
    a.click();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Todas as especialidades</DialogTitle>
        <DialogDescription>Para mandar ao cliente: o texto ou a imagem, com as especialidades agrupadas por área.</DialogDescription>
      </DialogHeader>
      <div className="mt-2 grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-label="Texto">
          <div className="rounded-xl bg-surface-2 px-5 py-4">
            <WhatsAppMessage content={texto} className="text-[14.5px]" />
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => copy(texto)}
              aria-live="polite"
              className="inline-grid h-10 items-center justify-items-center rounded-lg bg-gold px-[18px] text-[15px] font-semibold text-on-gold transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className={cn("col-start-1 row-start-1", copied && "invisible")}>Copiar texto</span>
              <span className={cn("col-start-1 row-start-1", !copied && "invisible")}>Copiado</span>
            </button>
          </div>
        </section>
        <section aria-label="Imagem">
          <div className="aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface-2">
            {img ? (
              <img src={img.url} alt="Prévia da imagem com as especialidades do Cartão de TODOS" className="h-full w-full object-contain" />
            ) : (
              <p className="grid h-full place-items-center px-6 text-center text-sm text-ink-muted">
                {erro ? "Não foi possível gerar a imagem neste navegador." : "Gerando a imagem…"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={baixar}
            disabled={!img}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-[18px] text-[15px] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Baixar imagem
          </button>
          <p className="mt-2 text-[12.5px] leading-[18px] text-ink-muted">PNG 1080×1350, para mandar no WhatsApp.</p>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Imagem (canvas)
// ---------------------------------------------------------------------------

/** Montserrat 700/800 só para a imagem: carregada quando o painel abre. */
async function carregarFontes() {
  const id = "cdt-image-fonts";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700;800&display=swap";
    document.head.appendChild(link);
    await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 2500); });
  }
  await Promise.all(
    ["400 32px Montserrat", "500 32px Montserrat", "700 32px Montserrat", "800 64px Montserrat"].map((f) => document.fonts.load(f).catch(() => null)),
  );
}

function carregarLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoCdt.url;
    setTimeout(() => resolve(img.complete && img.naturalWidth ? img : null), 4000);
  });
}

function quebrar(ctx: CanvasRenderingContext2D, palavras: string[], largura: number, sep: string) {
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const tentativa = atual ? atual + sep + p : p;
    if (atual && ctx.measureText(tentativa).width > largura) {
      linhas.push(atual);
      atual = p;
    } else atual = tentativa;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function retangulo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

async function gerarImagem(grupos: { area: string; nomes: string[] }[], menor: number | null): Promise<Blob> {
  await carregarFontes();
  const logo = await carregarLogo();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const font = (peso: number, px: number) => `${peso} ${px}px Montserrat, "Segoe UI", Arial, sans-serif`;
  const espaco = (px: number) => { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`; };

  // Faixa verde
  ctx.fillStyle = CDT.verde;
  ctx.fillRect(0, 0, W, H);

  // Logo sobre placa branca (o logo é colorido e precisa de fundo claro)
  ctx.fillStyle = "#ffffff";
  const plateH = 84;
  let plateW = 300;
  if (logo) {
    const lh = 56;
    const lw = Math.min(380, (logo.naturalWidth / logo.naturalHeight) * lh);
    plateW = lw + 40;
    retangulo(ctx, PAD, 60, plateW, plateH, 14);
    ctx.drawImage(logo, PAD + 20, 60 + (plateH - lh) / 2, lw, lh);
  } else {
    ctx.font = font(800, 30);
    plateW = ctx.measureText("Cartão de TODOS").width + 48;
    retangulo(ctx, PAD, 60, plateW, plateH, 14);
    ctx.fillStyle = CDT.verdeTexto;
    ctx.textBaseline = "middle";
    ctx.fillText("Cartão de TODOS", PAD + 24, 60 + plateH / 2);
  }

  // Título
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = font(800, 66);
  espaco(-0.5);
  const titulo = quebrar(ctx, "Especialidades para você e sua família".split(" "), W - PAD * 2, " ");
  let y = 60 + plateH + 40 + 60;
  titulo.forEach((l) => { ctx.fillText(l, PAD, y); y += 74; });
  espaco(0);

  // "Consultas a partir de R$ X"
  y += 6;
  ctx.font = font(500, 34);
  const sub = menor != null ? "Consultas a partir de" : "Consultas com desconto no Cartão de TODOS";
  ctx.fillText(sub, PAD, y);
  if (menor != null) {
    const x0 = PAD + ctx.measureText(sub).width + 16;
    ctx.font = font(800, 36);
    const preco = reais(menor);
    const pw = ctx.measureText(preco).width + 28;
    ctx.fillStyle = CDT.amarelo;
    retangulo(ctx, x0, y - 38, pw, 52, 10);
    ctx.fillStyle = CDT.tinta;
    ctx.fillText(preco, x0 + 14, y);
  }
  const faixaFim = y + 54;

  // Corpo claro
  const rodapeTopo = H - 150;
  ctx.fillStyle = CDT.fundo;
  ctx.fillRect(0, faixaFim, W, H - faixaFim);
  ctx.fillStyle = CDT.fio;
  ctx.fillRect(0, rodapeTopo, W, 2);

  // Áreas em duas colunas, por linhas. Lista grande: a fonte diminui, nada é cortado.
  const colW = (W - PAD * 2 - 56) / 2;
  const colX = [PAD, PAD + colW + 56];
  const topo = faixaFim + 56;
  const disponivel = rodapeTopo - 40 - topo;
  let nomePx = 32;
  let layout: { linhas: string[][]; alturas: number[] } = { linhas: [], alturas: [] };
  const medir = (px: number) => {
    const rotuloPx = Math.round(px * 0.8);
    const lh = Math.round(px * 1.25);
    ctx.font = font(400, px);
    const linhas = grupos.map((g) => quebrar(ctx, g.nomes, colW, " · "));
    const alturas = grupos.map((_, i) => rotuloPx + 16 + linhas[i].length * lh);
    let total = 0;
    for (let i = 0; i < grupos.length; i += 2) total += Math.max(alturas[i], alturas[i + 1] ?? 0) + Math.round(px * 1.1);
    return { linhas, alturas, total };
  };
  for (;;) {
    const m = medir(nomePx);
    layout = m;
    if (m.total <= disponivel || nomePx <= 14) break;
    nomePx -= 1;
  }
  const rotuloPx = Math.round(nomePx * 0.8);
  const lh = Math.round(nomePx * 1.25);
  let rowY = topo;
  for (let i = 0; i < grupos.length; i += 2) {
    [i, i + 1].forEach((k, col) => {
      const g = grupos[k];
      if (!g) return;
      const x = colX[col];
      ctx.fillStyle = CDT.amarelo;
      ctx.beginPath();
      ctx.arc(x + 6, rowY + rotuloPx * 0.38 - 2, Math.max(4, rotuloPx * 0.26), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CDT.verdeTexto;
      ctx.font = font(700, rotuloPx);
      espaco(rotuloPx * 0.06);
      ctx.textBaseline = "alphabetic";
      ctx.fillText(g.area.toLocaleUpperCase("pt-BR"), x + 22, rowY + rotuloPx * 0.78);
      espaco(0);
      ctx.fillStyle = CDT.tinta;
      ctx.font = font(400, nomePx);
      layout.linhas[k].forEach((l, j) => ctx.fillText(l, x, rowY + rotuloPx + 16 + (j + 1) * lh - lh * 0.22));
    });
    rowY += Math.max(layout.alturas[i], layout.alturas[i + 1] ?? 0) + Math.round(nomePx * 1.1);
  }

  // Rodapé
  ctx.fillStyle = CDT.tinta;
  ctx.font = font(400, 28);
  ctx.fillText("Quer saber o valor de alguma?", PAD, rodapeTopo + 64);
  ctx.fillStyle = CDT.verdeTexto;
  ctx.font = font(800, 31);
  ctx.fillText("Fale comigo aqui no WhatsApp", PAD, rodapeTopo + 104);
  ctx.fillStyle = CDT.tintaSuave;
  ctx.font = font(400, 25);
  const dx = W - PAD - 370;
  ctx.fillText("Valores exclusivos para clientes", dx, rodapeTopo + 64);
  ctx.fillText("do Cartão de TODOS", dx, rodapeTopo + 98);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}
