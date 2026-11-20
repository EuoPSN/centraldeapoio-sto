import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { prepararConversaTxt, type ConversaPreparada, type UsoStatus } from "@/lib/cerebro";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { Overline } from "@/components/cliente-disse/shared";
import { cn } from "@/lib/utils";

// Campo "CONVERSA" do Copiloto e do Raio-X: prints colados com Ctrl+V (até 4) e/ou
// o .txt exportado do WhatsApp. Nada sobe para o servidor antes de "Analisar":
// o .txt é limpo aqui (telefone, CPF, e-mail) e os prints só vão para o Storage
// na hora da análise, de onde o servidor os apaga logo depois.

const MAX_IMAGENS = 4;
const BUCKET = "chat-images";

export interface ImagemColada { id: string; file: File; url: string }

export function useConversa(atendente: string) {
  const [imagens, setImagens] = useState<ImagemColada[]>([]);
  const [txt, setTxt] = useState<{ nome: string; preparada: ConversaPreparada } | null>(null);
  const imagensRef = useRef<ImagemColada[]>([]);
  imagensRef.current = imagens;

  const addImagens = useCallback((arquivos: File[]) => {
    const validos: File[] = [];
    for (const f of arquivos) {
      if (!f.type.startsWith("image/")) { toast.error(`${f.name || "Arquivo"} não é uma imagem.`); continue; }
      if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name || "Imagem"} passa de 8 MB.`); continue; }
      validos.push(f);
    }
    if (!validos.length) return;
    setImagens((atual) => {
      const vaga = MAX_IMAGENS - atual.length;
      if (vaga <= 0) { toast.error("Máximo de 4 imagens."); return atual; }
      if (validos.length > vaga) toast.error("Máximo de 4 imagens.");
      return [...atual, ...validos.slice(0, vaga).map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))];
    });
  }, []);

  // Ctrl+V em qualquer lugar da página.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const arquivos = [...(e.clipboardData?.items ?? [])].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()).filter((f): f is File => !!f);
      if (!arquivos.length) return;
      e.preventDefault();
      addImagens(arquivos);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addImagens]);

  useEffect(() => () => imagensRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const removerImagem = (id: string) => setImagens((a) => {
    const alvo = a.find((i) => i.id === id);
    if (alvo) URL.revokeObjectURL(alvo.url);
    return a.filter((i) => i.id !== id);
  });

  const lerTxt = async (arquivo: File) => {
    if (arquivo.size > 5 * 1024 * 1024) { toast.error("Arquivo grande demais."); return; }
    const preparada = prepararConversaTxt(await arquivo.text(), atendente);
    if (!preparada.mensagens) { toast.error("Não achei mensagens nesse arquivo."); return; }
    setTxt({ nome: arquivo.name, preparada });
  };

  const removerTxt = () => setTxt(null);

  const limpar = () => {
    imagensRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    setImagens([]);
    setTxt(null);
  };

  /** Sobe os prints para a pasta do usuário (o servidor apaga depois da análise). */
  const subirImagens = async (): Promise<string[]> => {
    if (!imagens.length) return [];
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) throw new Error("Sem sessão.");
    const caminhos: string[] = [];
    try {
      for (const img of imagens) {
        const ext = (img.file.type.split("/")[1] ?? "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
        const path = `${uid}/analise/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, img.file, { contentType: img.file.type, upsert: false });
        if (error) throw error;
        caminhos.push(path);
      }
    } catch (e) {
      await apagarImagens(caminhos);
      throw e;
    }
    return caminhos;
  };

  return {
    imagens, txt, addImagens, removerImagem, lerTxt, removerTxt, limpar, subirImagens,
    vazio: imagens.length === 0 && !txt,
  };
}

/** Segurança extra: tenta apagar os prints do Storage se a chamada falhar no meio. */
export async function apagarImagens(caminhos: string[]) {
  if (!caminhos.length) return;
  try { await supabase.storage.from(BUCKET).remove(caminhos); } catch { /* o servidor também apaga */ }
}

export type Conversa = ReturnType<typeof useConversa>;

export function ConversaCard({
  conversa, onAnalisar, analisando, rotuloBotao = "Analisar", uso, children, className,
}: {
  conversa: Conversa;
  onAnalisar: () => void;
  analisando: boolean;
  rotuloBotao?: string;
  uso?: UsoStatus;
  children?: ReactNode;
  className?: string;
}) {
  const imgInput = useRef<HTMLInputElement>(null);
  const txtInput = useRef<HTMLInputElement>(null);
  const { imagens, txt } = conversa;
  const linhas = txt ? txt.preparada.texto.split("\n").slice(-12) : [];

  return (
    <section aria-label="Conversa" className={cn("flex flex-col rounded-2xl border border-dashed border-line-strong p-4", className)}>
      <Overline>Conversa</Overline>

      <div className="mt-3 min-h-[200px] flex-1 rounded-xl bg-surface-2 p-3">
        {conversa.vazio && (
          <p className="py-10 text-center text-[14px] leading-6 text-ink-muted">Cole um print aqui com Ctrl+V<br />ou anexe a conversa exportada (.txt).</p>
        )}

        {imagens.length > 0 && (
          <ul className="grid grid-cols-2 gap-2">
            {imagens.map((img, i) => (
              <li key={img.id} className="relative overflow-hidden rounded-lg border border-line bg-surface">
                <img src={img.url} alt={`Print ${i + 1}`} className="h-28 w-full object-cover object-top" />
                <button
                  type="button" onClick={() => conversa.removerImagem(img.id)} aria-label={`Remover print ${i + 1}`}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-surface/90 text-ink shadow hover:bg-surface"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {txt && (
          <div className={cn(imagens.length && "mt-3")}>
            <p className="mb-2 flex items-center justify-between gap-2 text-[12.5px] text-ink-muted">
              <span className="truncate">{txt.nome} · {txt.preparada.mensagens} mensagens</span>
              <button type="button" onClick={conversa.removerTxt} className="shrink-0 hover:text-ink">Remover</button>
            </p>
            <ul className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
              {linhas.map((l, i) => {
                const meu = l.startsWith("Atendente:");
                return (
                  <li key={i} className={cn("max-w-[88%] whitespace-pre-wrap break-words rounded-lg border border-line px-2.5 py-1.5 text-[13.5px] leading-5 text-ink", meu ? "ml-auto bg-line/40" : "bg-surface")}>
                    {l.replace(/^(Atendente|Cliente|Pessoa [A-Z]): /, "")}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-5 text-ink-muted">
        {imagens.length > 0 ? `Print colado com Ctrl+V · ${imagens.length} ${imagens.length === 1 ? "imagem" : "imagens"}. ` : ""}
        Também aceita o .txt exportado do WhatsApp. Telefone, CPF e e-mail são apagados antes da análise.
      </p>

      {children}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OutlineButton className="h-10 px-3.5 text-[14px]" onClick={() => imgInput.current?.click()} disabled={imagens.length >= MAX_IMAGENS || analisando}>
          <ImagePlus className="h-4 w-4" strokeWidth={1.5} /> Outro print
        </OutlineButton>
        <OutlineButton className="h-10 px-3.5 text-[14px]" onClick={() => txtInput.current?.click()} disabled={analisando}>Anexar .txt</OutlineButton>
        <GoldButton className="ml-auto h-10 px-6" onClick={onAnalisar} disabled={conversa.vazio || analisando || !!uso?.bloqueado}>{rotuloBotao}</GoldButton>
      </div>

      <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={(e) => { conversa.addImagens([...(e.target.files ?? [])]); e.target.value = ""; }} />
      <input ref={txtInput} type="file" accept=".txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void conversa.lerTxt(f); e.target.value = ""; }} />
    </section>
  );
}
